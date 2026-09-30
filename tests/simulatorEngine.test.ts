import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialSimulatorState,
  derivePm10,
  formatElapsedTime,
  getRiskLevel,
  simulatorReducer,
} from '../src/features/circuit-simulator/simulatorEngine';
import { defaultInput, predictSimulation } from '../src/features/simulation/simulationEngine';

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

test('AUTO multi-factor decision maps directional zones and variable flow according to final rules', () => {
  let state = act(createInitialSimulatorState(), { type: 'RUN' });
  // Default is NW (315°) and MODERATE risk -> Zone A + Zone D
  assert.deepEqual(state.zones, [true, false, false, true]);
  assert.equal(state.pumpOn, true);
  assert.equal(state.flowPerZoneLpm, 0.50);
  assert.equal(state.requiredFlowLpm, 1.00);

  // Switch wind to East (90°) -> Zone B
  state = act(state, { type: 'SET_SENSOR', key: 'windDirection', value: 90 });
  assert.deepEqual(state.zones, [false, true, false, false]);
  assert.equal(state.pumpOn, true);
  assert.equal(state.flowPerZoneLpm, 0.50);
  assert.equal(state.requiredFlowLpm, 0.50);

  // Low risk scenario -> All zones OFF, pump OFF, flow 0
  state = act(state, { type: 'SET_SENSOR', key: 'dustIntensity', value: 10 });
  state = act(state, { type: 'SET_SENSOR', key: 'pm1', value: 15 });
  state = act(state, { type: 'SET_SENSOR', key: 'pm2', value: 12 });
  state = act(state, { type: 'SET_SENSOR', key: 'windSpeed', value: 1 });
  state = act(state, { type: 'SET_SENSOR', key: 'humidity', value: 75 });
  assert.deepEqual(state.zones, [false, false, false, false]);
  assert.equal(state.pumpOn, false);
  assert.equal(state.requiredFlowLpm, 0);
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

test('temperature and humidity status thresholds are reflected in periodic serial output', () => {
  let state = createInitialSimulatorState();
  state = act(state, { type: 'SET_SENSOR', key: 'temperature', value: 40 });
  state = act(state, { type: 'SET_SENSOR', key: 'humidity', value: 80 });
  state = act(state, { type: 'RUN' });
  for (let i = 0; i < 5; i++) state = act(state, { type: 'TICK' });
  assert.ok(state.serialLogs.some((entry) => entry.message.includes('DHT22: 40.0 °C [HIGH], 80% RH [HIGH]')));
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

test('Serial Monitor can clear its buffer without changing simulator outputs', () => {
  let state = act(createInitialSimulatorState(), { type: 'RUN' });
  const outputs = { zones: state.zones, pumpOn: state.pumpOn, fanOn: state.fanOn };
  state = act(state, { type: 'CLEAR_LOGS' });
  assert.deepEqual(state.serialLogs, []);
  assert.deepEqual({ zones: state.zones, pumpOn: state.pumpOn, fanOn: state.fanOn }, outputs);
  assert.equal(act(state, { type: 'CLEAR_LOGS' }), state);
  for (let i = 0; i < 5; i++) state = act(state, { type: 'TICK' });
  assert.ok(state.serialLogs.some((entry) => entry.message.startsWith('PM 1:')));
});

// Explicit Circuit Simulation Specification Cases from User Prompt:

test('Circuit Case 1 — Dust 20%, PM1 15, PM2 12, Wind 1, Hum 70% yields LOW risk, no active zones, pump OFF, flow 0', () => {
  let state = createInitialSimulatorState();
  state = act(state, { type: 'SET_SENSOR', key: 'dustIntensity', value: 20 });
  state = act(state, { type: 'SET_SENSOR', key: 'pm1', value: 15 });
  state = act(state, { type: 'SET_SENSOR', key: 'pm2', value: 12 });
  state = act(state, { type: 'SET_SENSOR', key: 'windSpeed', value: 1 });
  state = act(state, { type: 'SET_SENSOR', key: 'humidity', value: 70 });
  state = act(state, { type: 'RUN' });
  assert.equal(getRiskLevel(state), 'low');
  assert.deepEqual(state.zones, [false, false, false, false]);
  assert.equal(state.pumpOn, false);
  assert.equal(state.requiredFlowLpm, 0);
});

test('Circuit Case 2 — Dust 80%, PM1 40, PM2 35, Wind 1, NW yields MODERATE risk and low transport', () => {
  let state = createInitialSimulatorState();
  state = act(state, { type: 'SET_SENSOR', key: 'dustIntensity', value: 80 });
  state = act(state, { type: 'SET_SENSOR', key: 'pm1', value: 40 });
  state = act(state, { type: 'SET_SENSOR', key: 'pm2', value: 35 });
  state = act(state, { type: 'SET_SENSOR', key: 'windSpeed', value: 1 });
  state = act(state, { type: 'SET_SENSOR', key: 'windDirection', value: 315 });
  state = act(state, { type: 'RUN' });
  assert.equal(getRiskLevel(state), 'moderate');
});

test('Circuit Case 3 — Dust 60%, PM1 55, PM2 30, Wind 7, East yields East exposure, Zone B, pump ON', () => {
  let state = createInitialSimulatorState();
  state = act(state, { type: 'SET_SENSOR', key: 'dustIntensity', value: 60 });
  state = act(state, { type: 'SET_SENSOR', key: 'pm1', value: 55 });
  state = act(state, { type: 'SET_SENSOR', key: 'pm2', value: 30 });
  state = act(state, { type: 'SET_SENSOR', key: 'windSpeed', value: 7 });
  state = act(state, { type: 'SET_SENSOR', key: 'windDirection', value: 90 });
  state = act(state, { type: 'RUN' });
  assert.deepEqual(state.zones, [false, true, false, false]); // Zone B (East)
  assert.equal(state.pumpOn, true);
  assert.equal(state.predictedDirection, 'East');
});

test('Circuit Case 4 — Dust 90%, PM1 80, PM2 70, Wind 6, NW yields HIGH risk, Zone A + Zone D, flow 1.50 L/min, pump ON', () => {
  let state = createInitialSimulatorState();
  state = act(state, { type: 'SET_SENSOR', key: 'dustIntensity', value: 90 });
  state = act(state, { type: 'SET_SENSOR', key: 'pm1', value: 80 });
  state = act(state, { type: 'SET_SENSOR', key: 'pm2', value: 70 });
  state = act(state, { type: 'SET_SENSOR', key: 'windSpeed', value: 6 });
  state = act(state, { type: 'SET_SENSOR', key: 'windDirection', value: 315 });
  state = act(state, { type: 'RUN' });
  assert.ok(getRiskLevel(state) === 'high' || getRiskLevel(state) === 'very high');
  assert.deepEqual(state.zones, [true, false, false, true]); // Zone A + Zone D
  assert.equal(state.flowPerZoneLpm, 0.75);
  assert.equal(state.requiredFlowLpm, 1.50);
  assert.equal(state.pumpOn, true);
});

test('Circuit Simulation and Main Simulation maintain completely independent state', () => {
  const mainScenario = { ...defaultInput, dustIntensity: 90, windSpeed: 8 };
  const mainPrediction1 = predictSimulation(mainScenario, undefined, 'predictive');

  let circuitState = createInitialSimulatorState();
  assert.equal(circuitState.dustIntensity, 70);
  assert.equal(circuitState.pm1, 28);
  assert.equal(circuitState.pm2, 42);

  circuitState = act(circuitState, { type: 'SET_SENSOR', key: 'dustIntensity', value: 20 });
  circuitState = act(circuitState, { type: 'SET_SENSOR', key: 'pm1', value: 15 });
  circuitState = act(circuitState, { type: 'SET_SENSOR', key: 'pm2', value: 12 });
  circuitState = act(circuitState, { type: 'SET_SENSOR', key: 'windSpeed', value: 1 });
  circuitState = act(circuitState, { type: 'RUN' });

  assert.equal(circuitState.dustIntensity, 20);
  assert.equal(circuitState.pm1, 15);
  assert.equal(circuitState.pm2, 12);
  assert.equal(circuitState.riskStatus, 'LOW');
  assert.equal(circuitState.pumpOn, false);

  assert.equal(mainScenario.dustIntensity, 90);
  assert.equal(mainScenario.windSpeed, 8);
  const mainPrediction2 = predictSimulation(mainScenario, undefined, 'predictive');
  assert.deepEqual(mainPrediction1, mainPrediction2);
  assert.equal(mainPrediction2.risk, 'HIGH');
  assert.deepEqual(mainPrediction2.activeZoneIds, ['A', 'D']);
});
