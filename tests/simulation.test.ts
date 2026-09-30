import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceSimulation,
  createInitialRunState,
  defaultInput,
  predictSimulation,
} from '../src/features/simulation/simulationEngine';
import { calculateStrategyComparison } from '../src/features/simulation/strategyComparison';
import { derivePm10 } from '../src/features/simulation/sensorModel';
import { calculateFlowRateLpm } from '../src/features/simulation/waterModel';
import type { SimulationInput } from '../src/features/simulation/simulationTypes';

const input = (overrides: Partial<SimulationInput> = {}): SimulationInput => ({ ...defaultInput, ...overrides });

// Scenario A: a calm/low-source site remains on standby.
test('Scenario A — low-risk conditions keep predictive misting on standby', () => {
  const result = predictSimulation(input({ dustIntensity: 10, windSpeed: 0.5, humidity: 75, temperatureC: 20 }));
  assert.equal(result.risk, 'LOW');
  assert.deepEqual(result.predictedZoneIds, []);
  assert.deepEqual(result.activeZoneIds, []);
  assert.equal(result.predictedEscapeBoundary, 'None predicted');
  assert.equal(result.flowRateLpm, 0);
});

// Scenario B: eastward plume exposure is resolved from the E sensor and maps to Zone B.
test('Scenario B — high dust moving East predicts the East boundary and Zone B', () => {
  const result = predictSimulation(input({ dustIntensity: 95, windSpeed: 4.2, windDirection: 90 }));
  assert.deepEqual(result.predictedBoundaries, ['east']);
  assert.deepEqual(result.predictedZoneIds, ['B']);
  assert.equal(result.primaryBoundary, 'east');
  assert.ok(result.sensors.find((sensor) => sensor.id === 'east')!.forecastPm25
    > result.sensors.find((sensor) => sensor.id === 'west')!.forecastPm25);
});

// Scenario C: northwest plume exposure selects both adjacent boundary segments.
test('Scenario C — NW plume predicts North and West, selecting Zones A and D', () => {
  const result = predictSimulation(input({ dustIntensity: 90, windSpeed: 5.5, windDirection: 315 }));
  assert.deepEqual(result.predictedBoundaries, ['north', 'west']);
  assert.deepEqual(result.predictedZoneIds, ['A', 'D']);
});

// Scenario D: an abrupt change recalculates the selected boundary from modeled sensor exposure.
test('Scenario D — sudden NW-to-East wind shift switches the target from A/D to B', () => {
  const current = createInitialRunState(defaultInput).currentPm25;
  const before = predictSimulation(input({ dustIntensity: 90, windSpeed: 4.2, windDirection: 315 }), current);
  const after = predictSimulation(input({ dustIntensity: 90, windSpeed: 8, windDirection: 90 }), current);
  assert.deepEqual(before.predictedZoneIds, ['A', 'D']);
  assert.deepEqual(after.predictedBoundaries, ['east']);
  assert.deepEqual(after.predictedZoneIds, ['B']);
  assert.ok(after.sensors.find((sensor) => sensor.id === 'east')!.forecastPm25
    > before.sensors.find((sensor) => sensor.id === 'east')!.forecastPm25);
});

// Scenario E: continuous response runs every zone and live water advances with elapsed time.
test('Scenario E — continuous spraying activates all zones and accumulates configured flow', () => {
  let state = createInitialRunState(defaultInput);
  const initial = predictSimulation(defaultInput, state.currentPm25, 'continuous', true, state);
  assert.deepEqual(initial.activeZoneIds, ['A', 'B', 'C', 'D']);
  assert.equal(initial.flowRateLpm, calculateFlowRateLpm(4));
  for (let second = 0; second < 60; second += 1) {
    state = advanceSimulation(state, defaultInput, 'continuous').state;
  }
  assert.equal(state.elapsedSeconds, 60);
  assert.equal(state.mistingSeconds, 60);
  assert.ok(Math.abs(state.waterUsedL - 2) < 1e-9);
});

// Scenario F: predictive targeting uses fewer active nozzles than continuous spraying.
test('Scenario F — predictive response is targeted and uses less comparison water than continuous', () => {
  const predictive = predictSimulation(defaultInput);
  const continuous = predictSimulation(defaultInput, undefined, 'continuous');
  const results = calculateStrategyComparison(predictive);
  assert.equal(predictive.activeZoneIds.length, 2);
  assert.equal(continuous.activeZoneIds.length, 4);
  assert.ok(results.find((item) => item.strategy === 'predictive')!.waterUsedL
    < results.find((item) => item.strategy === 'continuous')!.waterUsedL);
  assert.ok(results.find((item) => item.strategy === 'predictive')!.exceedanceMinutes
    <= results.find((item) => item.strategy === 'reactive')!.exceedanceMinutes);
  assert.ok(results.every((item) => item.boundaryPm10 === derivePm10(item.boundaryPm25)));
});

// Explicit Judge-Facing Test Cases from Specification:

test('Specification Case 1 — Dust 20%, Wind 1 m/s, Humidity 70% yields LOW risk, misting OFF, Flow 0', () => {
  const result = predictSimulation({ dustIntensity: 20, windSpeed: 1, windDirection: 0, humidity: 70, temperatureC: 28 });
  assert.equal(result.risk, 'LOW');
  assert.deepEqual(result.activeZoneIds, []);
  assert.equal(result.flowRateLpm, 0);
  assert.ok(result.projectedPm25 < 40);
});

test('Specification Case 2 — Dust 80%, Wind 1 m/s yields MODERATE risk (high dust generation but weak transport)', () => {
  const result = predictSimulation({ dustIntensity: 80, windSpeed: 1, windDirection: 0, humidity: 60, temperatureC: 28 });
  assert.equal(result.risk, 'MODERATE');
});

test('Specification Case 3 — Dust 60%, Wind 7 m/s aimed East exposes East boundary, selects Zone B, and has shorter lead time', () => {
  const result = predictSimulation({ dustIntensity: 60, windSpeed: 7, windDirection: 90, humidity: 45, temperatureC: 28 });
  assert.ok(result.predictedBoundaries.includes('east'));
  assert.ok(result.predictedZoneIds.includes('B'));
  assert.ok(result.leadTimeSeconds !== null && result.leadTimeSeconds < 30);
});

test('Specification Case 4 — Dust 90%, Wind 6 m/s NW exposes NW, selects Zones A+D, HIGH risk with higher required flow', () => {
  const result = predictSimulation({ dustIntensity: 90, windSpeed: 6, windDirection: 315, humidity: 45, temperatureC: 28 });
  assert.ok(result.predictedBoundaries.includes('north') && result.predictedBoundaries.includes('west'));
  assert.ok(result.predictedZoneIds.includes('A') && result.predictedZoneIds.includes('D'));
  assert.ok(result.risk === 'HIGH' || result.risk === 'VERY HIGH');
  assert.ok(result.flowPerZoneLpm >= 0.75);
});

test('Specification Case 5 & 6 — Comparison of Continuous vs Predictive under identical inputs', () => {
  const scenarioInput = { dustIntensity: 90, windSpeed: 6, windDirection: 315, humidity: 45, temperatureC: 28 };
  const continuous = predictSimulation(scenarioInput, undefined, 'continuous');
  const predictive = predictSimulation(scenarioInput, undefined, 'predictive');

  assert.equal(continuous.activeZoneIds.length, 4);
  assert.equal(predictive.activeZoneIds.length, 2);

  const comparison = calculateStrategyComparison(predictive);
  const contComp = comparison.find((c) => c.strategy === 'continuous')!;
  const predComp = comparison.find((c) => c.strategy === 'predictive')!;

  assert.ok(predComp.waterUsedL < contComp.waterUsedL);
});
