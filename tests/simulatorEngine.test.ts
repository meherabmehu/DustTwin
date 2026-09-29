import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialSimulatorState,
  derivePm10,
  formatElapsedTime,
  getRiskLevel,
  simulatorReducer,
} from '../src/features/circuit-simulator/simulatorEngine';

const act = simulatorReducer;

test('initial readings and derived PM10 are deterministic', () => {
  const state = createInitialSimulatorState();
  assert.equal(state.pm1, 28);
  assert.equal(state.pm2, 42);
  assert.equal(state.pm10_1, 46);
  assert.equal(state.pm10_2, 69);
  assert.equal(getRiskLevel(state), 'moderate');
  assert.deepEqual(state.zones, [false, false, false, false]);
  assert.equal(derivePm10(40), 66);
});

test('AUTO thresholds map each PM sensor to its two zones at exact boundaries', () => {
  let state = act(createInitialSimulatorState(), { type: 'RUN' });
  assert.deepEqual(state.zones, [false, false, true, false]);
  assert.equal(state.pumpOn, true);
  assert.equal(state.fanOn, false);

  state = act(state, { type: 'SET_SENSOR', key: 'pm1', value: 40 });
  assert.deepEqual(state.zones, [true, false, true, false]);
  assert.equal(getRiskLevel(state), 'moderate');

  state = act(state, { type: 'SET_SENSOR', key: 'pm2', value: 39 });
  assert.deepEqual(state.zones, [true, false, false, false]);
  assert.equal(state.pumpOn, true);

  state = act(state, { type: 'SET_SENSOR', key: 'pm1', value: 75 });
  assert.deepEqual(state.zones, [true, true, false, false]);
  assert.equal(state.fanOn, true);
  assert.equal(getRiskLevel(state), 'high');

  state = act(state, { type: 'SET_SENSOR', key: 'pm1', value: 74 });
  assert.deepEqual(state.zones, [true, false, false, false]);
  assert.equal(state.fanOn, false);
  assert.equal(getRiskLevel(state), 'moderate');

  state = act(state, { type: 'SET_SENSOR', key: 'pm1', value: 39 });
  assert.deepEqual(state.zones, [false, false, false, false]);
  assert.equal(state.pumpOn, false);
  assert.equal(getRiskLevel(state), 'low');
});

test('MANUAL controls override zones and actuators independently', () => {
  let state = act(createInitialSimulatorState(), { type: 'SET_MODE', mode: 'manual' });
  state = act(state, { type: 'SET_ZONE', index: 1, active: true });
  state = act(state, { type: 'SET_OUTPUT', output: 'pump', active: true });
  state = act(state, { type: 'SET_OUTPUT', output: 'fan', active: true });
  state = act(state, { type: 'SET_SENSOR', key: 'pm1', value: 100 });
  assert.deepEqual(state.zones, [false, true, false, false]);
  assert.equal(state.pumpOn, true);
  assert.equal(state.fanOn, true);

  state = act(state, { type: 'SET_ALL_ZONES', active: true });
  assert.deepEqual(state.zones, [true, true, true, true]);
  state = act(state, { type: 'SET_ALL_ZONES', active: false });
  assert.deepEqual(state.zones, [false, false, false, false]);
});

test('sensor inputs clamp to their configured limits and round consistently', () => {
  let state = createInitialSimulatorState();
  state = act(state, { type: 'SET_SENSOR', key: 'pm1', value: 250 });
  state = act(state, { type: 'SET_SENSOR', key: 'temperature', value: 9 });
  state = act(state, { type: 'SET_SENSOR', key: 'humidity', value: 101 });
  state = act(state, { type: 'SET_SENSOR', key: 'windSpeed', value: 44.46 });
  state = act(state, { type: 'SET_SENSOR', key: 'windDirection', value: 400 });
  assert.equal(state.pm1, 200);
  assert.equal(state.pm10_1, 330);
  assert.equal(state.temperature, 10);
  assert.equal(state.humidity, 100);
  assert.equal(state.windSpeed, 30);
  assert.equal(state.windDirection, 359);
});

test('Stop de-energizes outputs, freezes elapsed time, and logs the safety action', () => {
  let state = act(createInitialSimulatorState(), { type: 'RUN' });
  state = act(state, { type: 'TICK' });
  state = act(state, { type: 'STOP' });
  const elapsed = state.elapsedSeconds;
  assert.equal(state.simulationRunning, false);
  assert.deepEqual(state.zones, [false, false, false, false]);
  assert.equal(state.pumpOn, false);
  assert.equal(state.fanOn, false);
  assert.ok(state.serialLogs.some((entry) => entry.message.includes('de-energized')));
  assert.equal(act(state, { type: 'TICK' }).elapsedSeconds, elapsed);
});

test('Reset restores defaults and elapsed time formatting is stable', () => {
  let state = act(createInitialSimulatorState(), { type: 'RUN' });
  state = act(state, { type: 'SET_SENSOR', key: 'pm1', value: 120 });
  state = act(state, { type: 'TICK' });
  state = act(state, { type: 'RESET' });
  assert.equal(state.simulationRunning, false);
  assert.equal(state.pm1, 28);
  assert.equal(state.pm2, 42);
  assert.equal(state.elapsedSeconds, 0);
  assert.equal(state.mode, 'auto');
  assert.deepEqual(state.zones, [false, false, false, false]);
  assert.ok(state.serialLogs.some((entry) => entry.message.includes('reset to default values')));
  assert.equal(formatElapsedTime(3661), '01:01:01');
  assert.equal(formatElapsedTime(9), '00:00:09');
});
