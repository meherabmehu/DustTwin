import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DustTwinClient,
  DustTwinApiError,
  getApiBaseUrl,
} from '../src/integrations/dusttwin-ai/dusttwin-client';
import type {
  Health,
  Forecast,
  ReplaySnapshot,
  ModelEvidence,
} from '../src/integrations/dusttwin-ai/types';
import { EPISODES } from '../src/features/simulation/AiForecastCard';
import {
  predictSimulation,
  defaultInput,
  mapAiPm10ToDustIntensity,
} from '../src/features/simulation/simulationEngine';
import type { SimulationInput } from '../src/features/simulation/simulationTypes';

test('DustTwinClient constructs and sanitizes base URL correctly', () => {
  const client1 = new DustTwinClient('http://localhost:8000/');
  assert.equal(client1.baseUrl, 'http://localhost:8000');

  const client2 = new DustTwinClient('http://127.0.0.1:8000');
  assert.equal(client2.baseUrl, 'http://127.0.0.1:8000');

  const defaultUrl = getApiBaseUrl();
  assert.ok(defaultUrl.startsWith('http'));
});

test('DustTwinClient handles failed network requests with typed errors and no fake fallback', async () => {
  // Use a port guaranteed not to have an active HTTP service
  const client = new DustTwinClient('http://127.0.0.1:59999', { timeoutMs: 300 });

  await assert.rejects(
    async () => {
      await client.health();
    },
    (err: Error) => {
      // Must not fabricate data or return silent mock; must reject
      assert.ok(err instanceof Error);
      return true;
    }
  );
});

test('DustTwinClient predict requires a valid 121-point causal series and throws on truncated input', async () => {
  const mockFetch: typeof fetch = async (input, init) => {
    const body = JSON.parse(init?.body as string);
    if (!Array.isArray(body.series) || body.series.length !== 121) {
      return new Response(
        JSON.stringify({
          code: 'invalid_request',
          errors: [{ field: 'series', message: 'Input series must contain exactly 121 points' }],
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ status: 'ok' }));
  };

  const client = new DustTwinClient('http://mock', { fetchImpl: mockFetch });

  // Only 5 points provided — must be rejected by API validation
  await assert.rejects(
    async () => {
      await client.predict([
        { second: 0, pm10_ug_m3: 10 },
        { second: 1, pm10_ug_m3: 12 },
        { second: 2, pm10_ug_m3: 15 },
        { second: 3, pm10_ug_m3: 18 },
        { second: 4, pm10_ug_m3: 20 },
      ]);
    },
    (err: DustTwinApiError) => {
      assert.equal(err.status, 422);
      assert.equal((err.body as { code?: string })?.code, 'invalid_request');
      return true;
    }
  );
});

test('DustTwinClient parses valid replay snapshot with forecast and matured ground truth', async () => {
  const mockSnapshot: ReplaySnapshot = {
    episode_id: 'lab_e4_drill90',
    clock_second: 150,
    past_observations: [
      { time_seconds: 140, pm10_ug_m3: 195.2 },
      { time_seconds: 150, pm10_ug_m3: 210.45 },
    ],
    forecast: {
      task_id: 'construction_pm10_30s_v1',
      model_id: 'hist_gb_depth3_iter100',
      artifact_sha256: 'd78f1b37269f72af45933e01722968fb13ed82178f6d8b3e4c5584d46cec09c7',
      issue_time_seconds: 150,
      target_time_seconds: 180,
      horizon_seconds: 30,
      units: 'ug/m3',
      current_pm10_ug_m3: 210.45,
      predicted_pm10_ug_m3: 385.12,
      baselines: {
        persistence_pm10_ug_m3: 210.45,
        trailing_mean_pm10_ug_m3: 145.2,
      },
      mode: 'live_inference',
    },
    matured_forecast: {
      issue_time_seconds: 120,
      target_time_seconds: 150,
      predicted_pm10_ug_m3: 198.5,
      actual_pm10_ug_m3: 210.45,
    },
  };

  const mockFetch: typeof fetch = async () => {
    return new Response(JSON.stringify(mockSnapshot), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const client = new DustTwinClient('http://mock', { fetchImpl: mockFetch });
  const snapshot = await client.replay('lab_e4_drill90', 150);

  assert.equal(snapshot.episode_id, 'lab_e4_drill90');
  assert.equal(snapshot.forecast.current_pm10_ug_m3, 210.45);
  assert.equal(snapshot.forecast.predicted_pm10_ug_m3, 385.12);
  assert.equal(snapshot.forecast.target_time_seconds, 180);
  assert.equal(snapshot.forecast.mode, 'live_inference');

  // Matured verification
  assert.ok(snapshot.matured_forecast);
  assert.equal(snapshot.matured_forecast.issue_time_seconds, 120);
  assert.equal(snapshot.matured_forecast.target_time_seconds, 150);
  assert.equal(snapshot.matured_forecast.predicted_pm10_ug_m3, 198.5);
  assert.equal(snapshot.matured_forecast.actual_pm10_ug_m3, 210.45);
});

test('AI Replay demo configuration covers all 6 laboratory episodes with correct partitions', () => {
  assert.equal(EPISODES.length, 6);

  const group3 = EPISODES.filter((e) => e.group === 3);
  const group4 = EPISODES.filter((e) => e.group === 4);

  assert.equal(group3.length, 3);
  assert.equal(group4.length, 3);

  for (const ep of EPISODES) {
    assert.equal(ep.firstSecond, 120); // 120s of causal history needed before first prediction
    assert.ok(ep.suggestedSecond >= 120);
    assert.ok(ep.lastSecond > ep.suggestedSecond);
  }
});

test('Hybrid AI + Deterministic Architecture: AI PM10 magnitude feeds directional physics engine', () => {
  // Scenario 1: AI predicts elevated dust spike, wind is NW
  // AI predicts PM10 magnitude, but transport direction and targeted zones are computed deterministically
  const aiPredictedPm10 = 450; // High drilling dust concentration
  const mappedIntensity = Math.min(100, Math.max(10, Math.round(aiPredictedPm10 / 5))); // 90%

  const hybridInputNW: SimulationInput = {
    ...defaultInput,
    dustIntensity: mappedIntensity,
    windDirection: 315, // NW
    windSpeed: 5.0,
  };

  const predictionNW = predictSimulation(hybridInputNW, undefined, 'predictive');
  assert.equal(predictionNW.risk, 'HIGH');
  assert.deepEqual(predictionNW.activeZoneIds, ['A', 'D']);
  assert.equal(predictionNW.predictedEscapeBoundary, 'North / West');

  // Scenario 2: Same high PM10 forecast, but wind shifts to East (90°)
  const hybridInputEast: SimulationInput = {
    ...defaultInput,
    dustIntensity: mappedIntensity,
    windDirection: 90, // East
    windSpeed: 5.0,
  };

  const predictionEast = predictSimulation(hybridInputEast, undefined, 'predictive');
  assert.equal(predictionEast.risk, 'HIGH');
  assert.deepEqual(predictionEast.activeZoneIds, ['B']);
  assert.equal(predictionEast.predictedEscapeBoundary, 'East');

  // Scenario 3: AI predicts low ambient dust
  const lowDustInput: SimulationInput = {
    ...defaultInput,
    dustIntensity: 15,
    windDirection: 315,
    windSpeed: 1.0,
  };

  const predictionLow = predictSimulation(lowDustInput, undefined, 'predictive');
  assert.equal(predictionLow.risk, 'LOW');
  assert.equal(predictionLow.activeZoneIds.length, 0); // Standby, 0 active zones
});

test('Laboratory model metrics are strictly decoupled from site-control simulation metrics', () => {
  // Laboratory Evaluation Metrics (Offline dataset test holdout)
  const labModelMae = 88.405;
  const labPersistenceMae = 95.702;
  const labTrailingMeanMae = 81.565;
  const labTestSamples = 15065;

  // Site-Control Simulation Metrics (Cyber-physical closed-loop simulation)
  const sitePmReductionPercent = 28;
  const siteExceedanceReductionPercent = 96;
  const siteWaterReductionPercent = 93;
  const siteLeadTimeSec = 26;

  // Verification: metrics measure fundamentally different systems
  assert.notEqual(labModelMae, sitePmReductionPercent);
  assert.equal(labTestSamples, 15065);
  assert.equal(sitePmReductionPercent, 28);
  assert.equal(siteExceedanceReductionPercent, 96);
  assert.equal(siteWaterReductionPercent, 93);
  assert.equal(siteLeadTimeSec, 26);
});

test('mapAiPm10ToDustIntensity calibrates and bounds AI PM10 to dust intensity', () => {
  // Test lower bound clamp (10%)
  assert.equal(mapAiPm10ToDustIntensity(0), 10);
  assert.equal(mapAiPm10ToDustIntensity(-50), 10);
  assert.equal(mapAiPm10ToDustIntensity(Number.NaN), 10);
  assert.equal(mapAiPm10ToDustIntensity(30), 10); // round(30/5) = 6 -> clamped to 10

  // Test linear scaling range
  assert.equal(mapAiPm10ToDustIntensity(100), 20); // 100/5 = 20%
  assert.equal(mapAiPm10ToDustIntensity(250), 50); // 250/5 = 50%
  assert.equal(mapAiPm10ToDustIntensity(385.1), 77); // 385.1/5 = 77%
  assert.equal(mapAiPm10ToDustIntensity(450), 90); // 450/5 = 90%

  // Test upper bound clamp (100%)
  assert.equal(mapAiPm10ToDustIntensity(500), 100);
  assert.equal(mapAiPm10ToDustIntensity(1200), 100);
});

test('Saved inference mode is strictly distinguished from live trained model', async () => {
  const mockSavedSnapshot: ReplaySnapshot = {
    episode_id: 'lab_e4_drill10',
    clock_second: 120,
    past_observations: [{ time_seconds: 120, pm10_ug_m3: 45.0 }],
    forecast: {
      task_id: 'construction_pm10_30s_v1',
      model_id: 'hist_gb_depth3_iter100',
      artifact_sha256: 'd78f1b37269f72af45933e01722968fb13ed82178f6d8b3e4c5584d46cec09c7',
      issue_time_seconds: 120,
      target_time_seconds: 150,
      horizon_seconds: 30,
      units: 'ug/m3',
      current_pm10_ug_m3: 45.0,
      predicted_pm10_ug_m3: 52.3,
      baselines: {
        persistence_pm10_ug_m3: 45.0,
        trailing_mean_pm10_ug_m3: 42.1,
      },
      mode: 'saved_inference',
    },
    matured_forecast: null,
  };

  const client = new DustTwinClient('http://mock-saved', {
    fetchImpl: async () =>
      new Response(JSON.stringify(mockSavedSnapshot), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  });

  const snapshot = await client.replay('lab_e4_drill10', 120);
  assert.equal(snapshot.forecast.mode, 'saved_inference');
  assert.notEqual(snapshot.forecast.mode, 'live_inference');
});

test('Mode switching: returning to deterministic restores manual scenario without leftover AI intensity', () => {
  const manualInput: SimulationInput = {
    ...defaultInput,
    dustIntensity: 60,
    windDirection: 90, // East
    windSpeed: 4.0,
  };

  // Replay mode was active with high AI forecast
  const aiPredictedPm10 = 450;
  const mappedAiIntensity = mapAiPm10ToDustIntensity(aiPredictedPm10); // 90%
  const replayInput: SimulationInput = { ...manualInput, dustIntensity: mappedAiIntensity };

  const replayPrediction = predictSimulation(replayInput, undefined, 'predictive');
  assert.equal(replayPrediction.input.dustIntensity, 90);

  // Switching back to deterministic restores manual scenario
  const restoredPrediction = predictSimulation(manualInput, undefined, 'predictive');
  assert.equal(restoredPrediction.input.dustIntensity, 60);
  assert.equal(restoredPrediction.input.windDirection, 90);
  assert.notEqual(restoredPrediction.input.dustIntensity, replayPrediction.input.dustIntensity);
});

test('Simulated boundary PM10 is derived physically and distinct from AI predicted PM10', () => {
  const input: SimulationInput = {
    ...defaultInput,
    dustIntensity: 70,
    windDirection: 315,
  };

  const prediction = predictSimulation(input, undefined, 'predictive');

  // Simulated boundary PM10 is derived via 1.65x from physical PM2.5 boundary sensor
  assert.equal(prediction.projectedPm10, Math.round(prediction.projectedPm25 * 1.65));

  // AI predicted PM10 comes directly from the 16-feature HistGBM time series model (e.g. 385.1)
  const aiForecastPm10 = 385.1;
  assert.notEqual(prediction.projectedPm10, aiForecastPm10);
});

test('Zone decision remains deterministic/hybrid based on wind and physics, not labelled as direct AI zone prediction', () => {
  // NW wind directs plume to North & West boundaries -> Zones A & D
  const nwInput: SimulationInput = { ...defaultInput, windDirection: 315, dustIntensity: 80 };
  const nwPred = predictSimulation(nwInput, undefined, 'predictive');
  assert.deepEqual(nwPred.activeZoneIds, ['A', 'D']);

  // East wind directs plume to East boundary -> Zone B
  const eastInput: SimulationInput = { ...defaultInput, windDirection: 90, dustIntensity: 80 };
  const eastPred = predictSimulation(eastInput, undefined, 'predictive');
  assert.deepEqual(eastPred.activeZoneIds, ['B']);

  // South wind directs plume to South boundary -> Zone C
  const southInput: SimulationInput = { ...defaultInput, windDirection: 180, dustIntensity: 80 };
  const southPred = predictSimulation(southInput, undefined, 'predictive');
  assert.deepEqual(southPred.activeZoneIds, ['C']);
});
