import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceSimulation,
  createInitialRunState,
  defaultInput,
  predictSimulation,
} from '../src/features/simulation/simulationEngine';
import { calculateStrategyComparison } from '../src/features/simulation/strategyComparison';
import { derivePm10, getRiskStatus } from '../src/features/simulation/sensorModel';
import { calculateFlowRateLpm, calculateWaterUseL } from '../src/features/simulation/waterModel';
import { BOUNDARY_GEOMETRY, PM25_MODERATE_THRESHOLD } from '../src/features/simulation/simulationConfig';
import type { SimulationInput } from '../src/features/simulation/simulationTypes';

const input = (overrides: Partial<SimulationInput> = {}): SimulationInput => ({ ...defaultInput, ...overrides });

const idsForZones = (zones: readonly string[]) => [...zones].sort();

test('default construction event deterministically predicts both NW boundary sensors and Zones A + D', () => {
  const first = predictSimulation(defaultInput);
  const second = predictSimulation(defaultInput);
  assert.deepEqual(first, second);
  assert.equal(first.sensors.length, 4);
  assert.deepEqual(first.predictedBoundaries, ['north', 'west']);
  assert.deepEqual(idsForZones(first.predictedZoneIds), ['A', 'D']);
  assert.equal(first.predictedEscapeBoundary, 'North / West');
  assert.ok(first.leadTimeSeconds && first.leadTimeSeconds > 0);
});

test('eastward dust exposure selects only the East sensor and Zone B', () => {
  const result = predictSimulation(input({ dustIntensity: 95, windSpeed: 4.2, windDirection: 90 }));
  assert.deepEqual(result.predictedBoundaries, ['east']);
  assert.deepEqual(result.predictedZoneIds, ['B']);
  assert.equal(result.primaryBoundary, 'east');
  assert.ok(result.sensors.find((sensor) => sensor.id === 'east')!.forecastPm25
    > result.sensors.find((sensor) => sensor.id === 'west')!.forecastPm25);
});

test('low-risk standby selects no predictive zones and predicts no escape boundary', () => {
  const result = predictSimulation(input({ dustIntensity: 10, windSpeed: 0.5, windDirection: 315, humidity: 75, temperatureC: 20 }));
  assert.equal(result.risk, 'LOW');
  assert.deepEqual(result.predictedZoneIds, []);
  assert.deepEqual(result.activeZoneIds, []);
  assert.equal(result.predictedEscapeBoundary, 'None predicted');
  assert.equal(result.flowRateLpm, 0);
});

test('PM10 is a documented deterministic 1.65× derivation and risk bands include both pollutants', () => {
  assert.equal(derivePm10(40), 66);
  assert.equal(derivePm10(75), 124);
  assert.equal(getRiskStatus(38, 63), 'LOW');
  assert.equal(getRiskStatus(40, 66), 'MODERATE');
  assert.equal(getRiskStatus(75, 124), 'HIGH');
  assert.equal(getRiskStatus(150, 248), 'VERY HIGH');
});

test('wind, humidity, temperature, direction, source intensity, and sensor distance affect the modeled plume', () => {
  const baseline = predictSimulation(defaultInput);
  const hotter = predictSimulation(input({ temperatureC: 40 }));
  const humid = predictSimulation(input({ humidity: 90 }));
  const calmer = predictSimulation(input({ windSpeed: 0.5 }));
  const east = predictSimulation(input({ windDirection: 90 }));
  const lessDust = predictSimulation(input({ dustIntensity: 20 }));

  assert.ok(hotter.baselinePm25 > baseline.baselinePm25);
  assert.ok(humid.baselinePm25 < baseline.baselinePm25);
  assert.ok(calmer.plume.length < baseline.plume.length);
  assert.notDeepEqual(east.predictedBoundaries, baseline.predictedBoundaries);
  assert.ok(lessDust.baselinePm25 < baseline.baselinePm25);
  assert.ok(baseline.sensors.some((sensor) => sensor.distanceM !== baseline.sensors[0].distanceM));
  assert.equal(BOUNDARY_GEOMETRY.length, 4);
});

test('predictive misting begins before the current sensor crosses threshold; reactive waits for live readings', () => {
  const run = createInitialRunState(defaultInput);
  const predictive = predictSimulation(defaultInput, run.currentPm25, 'predictive', true, run);
  const reactive = predictSimulation(defaultInput, run.currentPm25, 'reactive', true, run);
  assert.ok(predictive.activeZoneIds.length > 0);
  assert.ok(Math.max(...Object.values(run.currentPm25)) < PM25_MODERATE_THRESHOLD);
  assert.equal(reactive.activeZoneIds.length, 0);

  let reactiveState = { ...run };
  let reactiveActivated = false;
  for (let index = 0; index < 70; index += 1) {
    const next = advanceSimulation(reactiveState, defaultInput, 'reactive');
    reactiveState = next.state;
    reactiveActivated ||= next.prediction.activeZoneIds.length > 0;
  }
  assert.equal(reactiveActivated, true);
});

test('active misting lowers PM gradually, then sensor feedback can release a zone', () => {
  let state = createInitialRunState(defaultInput);
  const startNorth = state.currentPm25.north;
  const first = advanceSimulation(state, defaultInput, 'predictive');
  state = first.state;
  let sawLowerReading = first.state.currentPm25.north < startNorth;
  let sawFeedbackRelease = false;
  let second: ReturnType<typeof advanceSimulation> = first;

  for (let index = 0; index < 18; index += 1) {
    second = advanceSimulation(state, defaultInput, 'predictive');
    state = second.state;
    sawLowerReading ||= state.currentPm25.north < startNorth;
    sawFeedbackRelease ||= second.prediction.heldOffBoundaries.length > 0;
  }
  const latest = predictSimulation(defaultInput, state.currentPm25, 'predictive', true, state);

  assert.equal(sawLowerReading, true);
  assert.equal(sawFeedbackRelease, true);
  assert.equal(first.state.elapsedSeconds, 1);
  assert.equal(first.state.mistingSeconds, 1);
  assert.ok(Math.abs(first.state.waterUsedL - calculateFlowRateLpm(2) / 60) < 1e-9);
  assert.equal(latest.flowRateLpm, calculateFlowRateLpm(latest.activeZoneIds.length));
  assert.ok(latest.projectedPm25 < latest.baselinePm25);
});

test('pause holds readings and water; reset clears water and active time', () => {
  const running = advanceSimulation(createInitialRunState(defaultInput), defaultInput, 'predictive').state;
  const paused = { ...running, running: false };
  const tickWhilePaused = advanceSimulation(paused, defaultInput, 'predictive');
  assert.deepEqual(tickWhilePaused.state, paused);

  const reset = createInitialRunState(defaultInput);
  assert.equal(reset.waterUsedL, 0);
  assert.equal(reset.mistingSeconds, 0);
  assert.equal(reset.elapsedSeconds, 0);
});

test('No Control keeps misting outputs off and water use at zero while the simulation clock runs', () => {
  let state = createInitialRunState(defaultInput);
  for (let index = 0; index < 30; index += 1) {
    state = advanceSimulation(state, defaultInput, 'noControl').state;
  }
  const prediction = predictSimulation(defaultInput, state.currentPm25, 'noControl', true, state);
  assert.deepEqual(prediction.activeZoneIds, []);
  assert.equal(prediction.flowRateLpm, 0);
  assert.equal(state.waterUsedL, 0);
  assert.equal(state.mistingSeconds, 0);
  assert.ok(state.elapsedSeconds > 0);
});

test('water rates use configured nozzle and pump flow, and stop when there are no active zones', () => {
  assert.equal(calculateFlowRateLpm(0), 0);
  assert.equal(calculateFlowRateLpm(1), 0.5);
  assert.equal(calculateFlowRateLpm(4), 2);
  assert.equal(calculateWaterUseL(2, 120), 2);
  assert.equal(calculateWaterUseL(0, 600), 0);
});

test('comparison contains all four strategies and predictive targeted water is below continuous water', () => {
  const forecast = predictSimulation(defaultInput);
  const comparison = calculateStrategyComparison(forecast);
  assert.deepEqual(comparison.map((item) => item.strategy), ['noControl', 'continuous', 'reactive', 'predictive']);
  assert.equal(comparison.find((item) => item.strategy === 'noControl')!.waterUsedL, 0);
  assert.equal(comparison.find((item) => item.strategy === 'continuous')!.waterUsedL, 16);
  assert.ok(comparison.find((item) => item.strategy === 'predictive')!.waterUsedL
    < comparison.find((item) => item.strategy === 'continuous')!.waterUsedL);
  assert.ok(comparison.find((item) => item.strategy === 'predictive')!.exceedanceMinutes
    <= comparison.find((item) => item.strategy === 'reactive')!.exceedanceMinutes);
  assert.ok(comparison.every((item) => item.boundaryPm10 === derivePm10(item.boundaryPm25)));
});

test('moderate risk boundary predictions use the existing project threshold', () => {
  assert.equal(PM25_MODERATE_THRESHOLD, 40);
});
