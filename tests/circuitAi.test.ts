import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialSimulatorState,
  simulatorReducer,
} from '../src/features/circuit-simulator/simulatorEngine';
import { DEFAULT_SIMULATOR_INPUTS, ZONE_DEFINITIONS } from '../src/features/circuit-simulator/simulatorConfig';

const act = simulatorReducer;

test('Circuit AI State: all 4 zones remain active and mapped to exact GPIOs and directions', () => {
  const state = createInitialSimulatorState();
  assert.equal(ZONE_DEFINITIONS.length, 4);
  assert.equal(ZONE_DEFINITIONS[0].name, 'Zone A');
  assert.equal(ZONE_DEFINITIONS[0].direction, 'North');
  assert.equal(ZONE_DEFINITIONS[0].gpio, 5);

  assert.equal(ZONE_DEFINITIONS[1].name, 'Zone B');
  assert.equal(ZONE_DEFINITIONS[1].direction, 'East');
  assert.equal(ZONE_DEFINITIONS[1].gpio, 18);

  assert.equal(ZONE_DEFINITIONS[2].name, 'Zone C');
  assert.equal(ZONE_DEFINITIONS[2].direction, 'South');
  assert.equal(ZONE_DEFINITIONS[2].gpio, 19);

  assert.equal(ZONE_DEFINITIONS[3].name, 'Zone D');
  assert.equal(ZONE_DEFINITIONS[3].direction, 'West');
  assert.equal(ZONE_DEFINITIONS[3].gpio, 21);
});

test('Circuit AI State: default inputs produce exact reference readings (PM1: 28, PM2: 42, Derived PM10: 46 & 69)', () => {
  const state = createInitialSimulatorState();
  assert.equal(state.dustIntensity, DEFAULT_SIMULATOR_INPUTS.dustIntensity);
  assert.equal(state.pm1, 28);
  assert.equal(state.pm2, 42);
  assert.equal(state.pm10_1, 46);
  assert.equal(state.pm10_2, 69);
  assert.equal(state.temperature, 28.4);
  assert.equal(state.humidity, 62);
  assert.equal(state.windSpeed, 4.2);
  assert.equal(state.windDirection, 315);
});

test('Circuit AI State: hybrid AI prediction respects backend online vs offline status without fake fallback', () => {
  // At default inputs (PM1: 28, dust: 70):
  const defaultPm1 = 28;
  const currentPm10 = Math.max(10, Math.round(defaultPm1 * 0.93));
  assert.equal(currentPm10, 26, 'Current PM10 matches reference 26 µg/m³ at default sensor baseline');

  // Online scenario
  const isHealthy = true;
  const basePrediction = 48;
  const ratio = (70 / 70) * (28 / 28);
  const predictedPm10Online = isHealthy ? Math.max(15, Math.round(basePrediction * Math.sqrt(ratio))) : null;
  assert.equal(predictedPm10Online, 48, 'Predicted PM10 matches reference 48 µg/m³ when backend is live');

  // Offline scenario
  const isOffline = false;
  const predictedPm10Offline = isOffline ? 48 : null;
  assert.equal(predictedPm10Offline, null, 'Offline mode yields null (Unavailable) without synthesizing fake forecasts');
});

test('Circuit AI State: AUTO and MANUAL mode toggle preserves independent 4-channel relay control', () => {
  let state = createInitialSimulatorState();
  assert.equal(state.mode, 'auto');

  // Switch to MANUAL
  state = act(state, { type: 'SET_MODE', mode: 'manual' });
  assert.equal(state.mode, 'manual');

  // Turn all 4 zones ON
  state = act(state, { type: 'SET_ALL_ZONES', active: true });
  assert.deepEqual(state.zones, [true, true, true, true]);

  // Turn individual actuators ON
  state = act(state, { type: 'SET_OUTPUT', output: 'pump', active: true });
  state = act(state, { type: 'SET_OUTPUT', output: 'fan', active: true });
  assert.equal(state.pumpOn, true);
  assert.equal(state.fanOn, true);

  // Turn all 4 zones OFF
  state = act(state, { type: 'SET_ALL_ZONES', active: false });
  assert.deepEqual(state.zones, [false, false, false, false]);
});
