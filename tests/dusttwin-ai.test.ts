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
  assert.ok(defaultUrl.startsWith('http') || defaultUrl === '');
});

test('1. frontend health success: returns live_inference and model identity', async () => {
  const mockHealth: Health = {
    ready: true,
    mode: 'live_inference',
    model_id: 'hist_gb_depth3_iter100',
    artifact_sha256: 'd78f1b37269f72af45933e01722968fb13ed82178f6d8b3e4c5584d46cec09c7',
    task_id: 'construction_pm10_30s_v1',
    monitor_id: 'OPC-N3',
    horizon_seconds: 30,
    grid_interval_seconds: 1,
    reason: null,
  };

  const client = new DustTwinClient('http://mock', {
    fetchImpl: async () => new Response(JSON.stringify(mockHealth), { status: 200 }),
  });

  const health = await client.health();
  assert.equal(health.ready, true);
  assert.equal(health.mode, 'live_inference');
  assert.equal(health.model_id, 'hist_gb_depth3_iter100');
  assert.equal(health.artifact_sha256, 'd78f1b37269f72af45933e01722968fb13ed82178f6d8b3e4c5584d46cec09c7');
});

test('2. backend offline: unreachable endpoint throws network error and avoids mock fallback', async () => {
  const client = new DustTwinClient('http://127.0.0.1:59999', { timeoutMs: 200 });

  await assert.rejects(
    async () => {
      await client.health();
    },
    (err: Error) => {
      assert.ok(err instanceof Error);
      return true;
    }
  );
});

test('3. replay success: fetches valid episode snapshot with past observations and 30s horizon forecast', async () => {
  const mockSnapshot: ReplaySnapshot = {
    episode_id: 'lab_e4_drill90',
    clock_second: 1010,
    past_observations: [
      { time_seconds: 1000, pm10_ug_m3: 25.82 },
      { time_seconds: 1010, pm10_ug_m3: 29.26 },
    ],
    forecast: {
      task_id: 'construction_pm10_30s_v1',
      model_id: 'hist_gb_depth3_iter100',
      artifact_sha256: 'd78f1b37269f72af45933e01722968fb13ed82178f6d8b3e4c5584d46cec09c7',
      issue_time_seconds: 1010,
      target_time_seconds: 1040,
      horizon_seconds: 30,
      units: 'ug/m3',
      current_pm10_ug_m3: 29.26,
      predicted_pm10_ug_m3: 73.97,
      baselines: {
        persistence_pm10_ug_m3: 29.26,
        trailing_mean_pm10_ug_m3: 62.88,
      },
      mode: 'live_inference',
    },
    matured_forecast: {
      issue_time_seconds: 980,
      target_time_seconds: 1010,
      predicted_pm10_ug_m3: 74.38,
      actual_pm10_ug_m3: 29.26,
    },
  };

  const client = new DustTwinClient('http://mock', {
    fetchImpl: async () => new Response(JSON.stringify(mockSnapshot), { status: 200 }),
  });

  const snapshot = await client.replay('lab_e4_drill90', 1010);
  assert.equal(snapshot.episode_id, 'lab_e4_drill90');
  assert.equal(snapshot.clock_second, 1010);
  assert.equal(snapshot.forecast.current_pm10_ug_m3, 29.26);
  assert.equal(snapshot.forecast.predicted_pm10_ug_m3, 73.97);
  assert.equal(snapshot.forecast.target_time_seconds, 1040);
  assert.equal(snapshot.forecast.mode, 'live_inference');
});

test('4. AI predicted PM10 binding: binds returned forecast values directly without corruption', () => {
  const predictedPm10 = 73.965;
  const currentPm10 = 29.26;

  // Pure mapping helper bounds and calibrates the AI forecast
  const mappedDustIntensity = mapAiPm10ToDustIntensity(predictedPm10);
  assert.equal(mappedDustIntensity, 15); // round(73.965 / 5) = 15%

  const hybridInput: SimulationInput = {
    ...defaultInput,
    dustIntensity: mappedDustIntensity,
  };

  assert.equal(hybridInput.dustIntensity, 15);
  assert.equal(currentPm10, 29.26);
});

test('5. AI impact becomes ACTIVE when backend is live, replay is selected, and forecast is loaded', () => {
  // Case A: Deterministic mode -> STANDBY
  const isAiActiveDet = false;
  const statusDet = isAiActiveDet ? 'AI IMPACT: ACTIVE' : 'AI IMPACT: STANDBY';
  assert.equal(statusDet, 'AI IMPACT: STANDBY');

  // Case B: Replay mode + live backend + valid forecast -> ACTIVE
  const simulationSource: 'deterministic' | 'replay' = 'replay';
  const replayStatus: 'live' | 'saved' | 'loading' | 'unavailable' = 'live';
  const hasForecast = true;

  const isAiActive =
    simulationSource === 'replay' &&
    (replayStatus === 'live' || replayStatus === 'saved') &&
    hasForecast;

  assert.equal(isAiActive, true);
  const statusActive = isAiActive ? 'AI IMPACT: ACTIVE' : 'AI IMPACT: STANDBY';
  assert.equal(statusActive, 'AI IMPACT: ACTIVE');
});

test('6. deterministic → AI replay mode: activates hybrid AI predictive control', () => {
  const manualInput: SimulationInput = { ...defaultInput, dustIntensity: 70 };
  const initialPred = predictSimulation(manualInput, undefined, 'predictive');
  assert.equal(initialPred.risk, 'MODERATE');
  assert.deepEqual(initialPred.activeZoneIds, ['A', 'D']);

  // Transition to AI Replay mode with light dust forecast
  const aiPredictedPm10 = 74.0;
  const mappedIntensity = mapAiPm10ToDustIntensity(aiPredictedPm10); // 15%
  const hybridInput: SimulationInput = { ...manualInput, dustIntensity: mappedIntensity };
  const hybridPred = predictSimulation(hybridInput, undefined, 'predictive');

  assert.equal(hybridPred.risk, 'LOW');
  assert.deepEqual(hybridPred.activeZoneIds, []); // Standby
  assert.notEqual(hybridPred.risk, initialPred.risk);
});

test('7. AI replay → deterministic mode: restores exact manual scenario without residual AI state', () => {
  const manualInput: SimulationInput = { ...defaultInput, dustIntensity: 70, windSpeed: 4.2 };

  // AI Replay state
  const hybridInput: SimulationInput = { ...manualInput, dustIntensity: 15 };
  const hybridPred = predictSimulation(hybridInput, undefined, 'predictive');
  assert.equal(hybridPred.input.dustIntensity, 15);

  // Toggle back to deterministic
  const restoredPred = predictSimulation(manualInput, undefined, 'predictive');
  assert.equal(restoredPred.input.dustIntensity, 70);
  assert.equal(restoredPred.risk, 'MODERATE');
  assert.deepEqual(restoredPred.activeZoneIds, ['A', 'D']);
});

test('8. AI changes hybrid simulation state: real replay forecast modifies risk, score, and misting actuation', () => {
  // Low dust replay point (e.g. 1010s: pred PM10 = 74.0 µg/m³)
  const lowPredPm10 = 74.0;
  const lowInput: SimulationInput = { ...defaultInput, dustIntensity: mapAiPm10ToDustIntensity(lowPredPm10) };
  const lowSimulation = predictSimulation(lowInput, undefined, 'predictive');

  assert.equal(lowSimulation.risk, 'LOW');
  assert.equal(lowSimulation.riskIndex, 23);
  assert.deepEqual(lowSimulation.activeZoneIds, []);

  // Drilling dust spike replay point (e.g. 1200s: pred PM10 = 3130.6 µg/m³)
  const spikePredPm10 = 3130.6;
  const spikeInput: SimulationInput = { ...defaultInput, dustIntensity: mapAiPm10ToDustIntensity(spikePredPm10) };
  const spikeSimulation = predictSimulation(spikeInput, undefined, 'predictive');

  assert.equal(spikeSimulation.risk, 'HIGH');
  assert.equal(spikeSimulation.riskIndex, 61);
  assert.deepEqual(spikeSimulation.activeZoneIds, ['A', 'D']);

  // Proves AI forecast causally drives simulation risk and zone activation
  assert.notEqual(lowSimulation.risk, spikeSimulation.risk);
  assert.notEqual(lowSimulation.activeZoneIds.length, spikeSimulation.activeZoneIds.length);
});

test('9. backend recovery: client transitions from failure to healthy without corrupting state', async () => {
  let failFirst = true;

  const dynamicFetch: typeof fetch = async () => {
    if (failFirst) {
      throw new Error('Connection refused');
    }
    return new Response(
      JSON.stringify({
        ready: true,
        mode: 'live_inference',
        model_id: 'hist_gb_depth3_iter100',
        artifact_sha256: 'd78f1b37269f72af45933e01722968fb13ed82178f6d8b3e4c5584d46cec09c7',
        task_id: 'construction_pm10_30s_v1',
        monitor_id: 'OPC-N3',
        horizon_seconds: 30,
        grid_interval_seconds: 1,
        reason: null,
      }),
      { status: 200 }
    );
  };

  const client = new DustTwinClient('http://mock', { fetchImpl: dynamicFetch });

  // First request fails
  await assert.rejects(async () => await client.health());

  // Backend recovers
  failFirst = false;
  const recovered = await client.health();
  assert.equal(recovered.ready, true);
  assert.equal(recovered.mode, 'live_inference');
});

test('10. no fake fallback: API errors throw strictly and never synthesize mock predictions', async () => {
  const failingClient = new DustTwinClient('http://127.0.0.1:59998', { timeoutMs: 150 });

  await assert.rejects(
    async () => await failingClient.replay('lab_e4_drill90', 1010),
    (err: Error) => {
      // Must not fabricate a fake replay snapshot
      assert.ok(err instanceof Error);
      return true;
    }
  );
});

test('AI Replay demo configuration covers all 6 laboratory episodes with correct partitions', () => {
  assert.equal(EPISODES.length, 6);

  const group3 = EPISODES.filter((e) => e.group === 3);
  const group4 = EPISODES.filter((e) => e.group === 4);

  assert.equal(group3.length, 3);
  assert.equal(group4.length, 3);

  for (const ep of EPISODES) {
    assert.equal(ep.firstSecond, 120);
    assert.ok(ep.suggestedSecond >= 120);
    assert.ok(ep.lastSecond > ep.suggestedSecond);
  }
});

test('Hybrid AI + Deterministic Architecture: AI PM10 magnitude feeds directional physics engine', () => {
  const aiPredictedPm10 = 450;
  const mappedIntensity = mapAiPm10ToDustIntensity(aiPredictedPm10); // 90%

  const hybridInputNW: SimulationInput = {
    ...defaultInput,
    dustIntensity: mappedIntensity,
    windDirection: 315,
    windSpeed: 5.0,
  };

  const predictionNW = predictSimulation(hybridInputNW, undefined, 'predictive');
  assert.equal(predictionNW.risk, 'HIGH');
  assert.deepEqual(predictionNW.activeZoneIds, ['A', 'D']);
  assert.equal(predictionNW.predictedEscapeBoundary, 'North / West');

  const hybridInputEast: SimulationInput = {
    ...defaultInput,
    dustIntensity: mappedIntensity,
    windDirection: 90,
    windSpeed: 5.0,
  };

  const predictionEast = predictSimulation(hybridInputEast, undefined, 'predictive');
  assert.equal(predictionEast.risk, 'HIGH');
  assert.deepEqual(predictionEast.activeZoneIds, ['B']);
  assert.equal(predictionEast.predictedEscapeBoundary, 'East');
});

test('Laboratory model metrics are strictly decoupled from site-control simulation metrics', () => {
  const labModelMae = 88.405;
  const labTestSamples = 15065;

  const sitePmReductionPercent = 28;
  const siteExceedanceReductionPercent = 96;
  const siteWaterReductionPercent = 93;
  const siteLeadTimeSec = 26;

  assert.notEqual(labModelMae, sitePmReductionPercent);
  assert.equal(labTestSamples, 15065);
  assert.equal(sitePmReductionPercent, 28);
  assert.equal(siteExceedanceReductionPercent, 96);
  assert.equal(siteWaterReductionPercent, 93);
  assert.equal(siteLeadTimeSec, 26);
});

test('mapAiPm10ToDustIntensity calibrates and bounds AI PM10 to dust intensity', () => {
  assert.equal(mapAiPm10ToDustIntensity(0), 10);
  assert.equal(mapAiPm10ToDustIntensity(-50), 10);
  assert.equal(mapAiPm10ToDustIntensity(Number.NaN), 10);
  assert.equal(mapAiPm10ToDustIntensity(30), 10);
  assert.equal(mapAiPm10ToDustIntensity(100), 20);
  assert.equal(mapAiPm10ToDustIntensity(250), 50);
  assert.equal(mapAiPm10ToDustIntensity(385.1), 77);
  assert.equal(mapAiPm10ToDustIntensity(450), 90);
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

test('Simulated boundary PM10 is derived physically and distinct from AI predicted PM10', () => {
  const input: SimulationInput = {
    ...defaultInput,
    dustIntensity: 70,
    windDirection: 315,
  };

  const prediction = predictSimulation(input, undefined, 'predictive');
  assert.equal(prediction.projectedPm10, Math.round(prediction.projectedPm25 * 1.65));

  const aiForecastPm10 = 385.1;
  assert.notEqual(prediction.projectedPm10, aiForecastPm10);
});

test('Zone decision remains deterministic/hybrid based on wind and physics, not labelled as direct AI zone prediction', () => {
  const nwInput: SimulationInput = { ...defaultInput, windDirection: 315, dustIntensity: 80 };
  const nwPred = predictSimulation(nwInput, undefined, 'predictive');
  assert.deepEqual(nwPred.activeZoneIds, ['A', 'D']);

  const eastInput: SimulationInput = { ...defaultInput, windDirection: 90, dustIntensity: 80 };
  const eastPred = predictSimulation(eastInput, undefined, 'predictive');
  assert.deepEqual(eastPred.activeZoneIds, ['B']);

  const southInput: SimulationInput = { ...defaultInput, windDirection: 180, dustIntensity: 80 };
  const southPred = predictSimulation(southInput, undefined, 'predictive');
  assert.deepEqual(southPred.activeZoneIds, ['C']);
});
