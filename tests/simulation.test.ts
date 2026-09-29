import test from 'node:test';
import assert from 'node:assert/strict';
import { SIMULATION_THRESHOLDS } from '../src/config/simulationThresholds';
import { calculateDustScenario, defaultInput } from '../src/lib/simulation';

const input = (overrides: Partial<typeof defaultInput> = {}) => ({ ...defaultInput, ...overrides });

test('default scenario is deterministic and selects a downstream response', () => {
  const first = calculateDustScenario(defaultInput);
  const second = calculateDustScenario(defaultInput);
  assert.deepEqual(first, second);
  assert.equal(first.risk, 'MODERATE');
  assert.equal(first.mistingActive, true);
  assert.equal(first.activeZone, 'Zone A');
  assert.equal(first.escapeDirection, 'NW');
  assert.equal(first.chart.length, 20);
});

test('risk bands use the shared 40 and 75 µg/m³ PM2.5 limits', () => {
  assert.equal(calculateDustScenario(input({ dustIntensity: 87, windSpeed: 0, humidity: 100 })).risk, 'LOW');
  assert.equal(calculateDustScenario(input({ dustIntensity: 89, windSpeed: 0, humidity: 100 })).risk, 'MODERATE');
  assert.equal(calculateDustScenario(input({ dustIntensity: 58, windSpeed: 10, humidity: 0 })).risk, 'MODERATE');
  assert.equal(calculateDustScenario(input({ dustIntensity: 59, windSpeed: 10, humidity: 0 })).risk, 'HIGH');
});

test('targeted misting lowers modeled PM and the trend line without claiming a field result', () => {
  const result = calculateDustScenario(defaultInput);
  assert.ok(result.pm25 < result.baselinePm25);
  assert.equal(result.pm10, Math.round(result.pm25 * SIMULATION_THRESHOLDS.pm10Factor));
  assert.ok(result.pm10 < result.baselinePm10);
  assert.ok(result.chart.at(-1)!.twin < result.chart.at(-1)!.baseline);
  assert.ok(result.waterUsage > 0);
});

test('low-risk scenario stays on standby and predicts no escape event', () => {
  const result = calculateDustScenario(input({ dustIntensity: 0, windSpeed: 0, humidity: 100 }));
  assert.equal(result.risk, 'LOW');
  assert.equal(result.mistingActive, false);
  assert.equal(result.activeZone, 'Standby');
  assert.equal(result.leadTime, 0);
  assert.equal(result.waterUsage, 0);
  assert.equal(result.pm25, result.baselinePm25);
});

test('wind direction maps consistently to the four downstream zones', () => {
  for (const [windDirection, direction, zone] of [
    [0, 'N', 'Zone A'], [90, 'E', 'Zone B'], [180, 'S', 'Zone C'], [270, 'W', 'Zone D'],
  ] as const) {
    const result = calculateDustScenario(input({ dustIntensity: 70, windDirection }));
    assert.equal(result.escapeDirection, direction);
    assert.equal(result.activeZone, zone);
  }
});

test('dust, wind, and humidity controls change the predicted scenario', () => {
  const calm = calculateDustScenario(input({ dustIntensity: 30, windSpeed: 0, humidity: 80 }));
  const dusty = calculateDustScenario(input({ dustIntensity: 90, windSpeed: 8, humidity: 20 }));
  assert.ok(dusty.baselinePm25 > calm.baselinePm25);
  assert.ok(dusty.plumeLength > calm.plumeLength);
  assert.notDeepEqual(dusty.zoneReadings, calm.zoneReadings);
});
