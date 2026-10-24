import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_CONFIG, SCENARIOS, decision, initialState, reducer, validateConfig, type HardwareState } from '../src/features/hardware-simulator/engine';
import { ACTUATOR_GPIO, PARTS, WIRES, validateWiring } from '../src/features/hardware-simulator/hardware';
import { actuatorCommand, sensorFrame } from '../src/features/hardware-simulator/communication';

function scenario(name: string) { return reducer(initialState(), { type: 'scenario', name }); }
function ticks(s: HardwareState, count = 4) { for (let i = 0; i < count; i++) s = reducer(s, { type: 'tick' }); return s; }

test('complete inventory includes six SPS30, two SHT35, both controllers and four independent branches', () => {
  for (const id of ['pi', 'esp1', 'esp2', 'wind', 'vane', 'flow', 'pressure', 'dp', 'cyclone', 'bin', 'hepa', 'motor', 'pump', 'tank', 'drivers', 'psu', 'buck', 'fuse', 'estop', 'fan']) assert.ok(PARTS.some(p => p.id === id), id);
  assert.equal(PARTS.filter(p => /^pm\d$/.test(p.id)).length, 6);
  assert.equal(PARTS.filter(p => /^sht\d$/.test(p.id)).length, 2);
  for (let i = 0; i < 4; i++) for (const prefix of ['damper', 'valve', 'inlet', 'nozzle']) assert.ok(PARTS.some(p => p.id === `${prefix}${i}`));
  assert.equal(new Set(PARTS.map(p => p.id)).size, PARTS.length);
});
test('all connections refer to documented endpoints; address conflicts have dedicated mux channels', () => {
  assert.deepEqual(validateWiring(), []);
  for (let i = 0; i < 6; i++) {
    assert.ok(WIRES.some(w => w.from === 'mux' && w.fromPin === `SD${i}` && w.to === `pm${i}` && w.toPin === '2 SDA'));
    assert.ok(WIRES.some(w => w.to === `pm${i}` && w.toPin === '4 SEL' && w.type === 'ground'));
  }
  assert.equal(new Set(ACTUATOR_GPIO).size, 11);
  assert.ok(ACTUATOR_GPIO.every(p => ![0, 2, 5, 12, 15].includes(p) && p < 34));
});
test('proposed firmware pin order matches the central driver configuration', () => {
  const source = readFileSync('wokwi/hybrid-actuator/actuator.ino', 'utf8');
  const pins = source.match(/PINS\[\] = \{([^}]+)\}/)![1].split(',').map(Number);
  assert.deepEqual(pins, ACTUATOR_GPIO);
});
test('invalid voltage, unknown endpoints and missing drivers trigger validation', () => {
  const base = WIRES.find(w => w.to === 'esp1' && w.toPin === 'GPIO34')!;
  assert.match(validateWiring([{ ...base, voltage: '5V' }]).join(), /unsafe GPIO/);
  assert.match(validateWiring([{ ...base, toPin: 'BOGUS' }]).join(), /unknown/);
  assert.match(validateWiring([{ ...base, from: 'esp2', fromPin: 'GPIO13', type: 'control' }]).join(), /external driver/);
});
test('idle normal air quality does not energize loads', () => {
  const s = ticks(scenario('Normal air quality'));
  assert.equal(s.motor, false); assert.equal(s.pump, false);
  assert.deepEqual(s.dampers, ['CLOSED', 'CLOSED', 'CLOSED', 'CLOSED']);
});
test('NW control opens only A/D; suction waits for travel; misting follows relays', () => {
  let s = scenario('Northwest wind');
  assert.deepEqual(s.dampers, ['OPENING', 'CLOSED', 'CLOSED', 'OPENING']);
  assert.equal(s.motor, false);
  assert.deepEqual(s.valves, [true, false, false, true]);
  s = ticks(s, 3);
  assert.deepEqual(s.dampers, ['OPEN', 'CLOSED', 'CLOSED', 'OPEN']);
  assert.equal(s.motor, true); assert.equal(s.pump, true);
  assert.deepEqual(s.airflow, [360, 0, 0, 360]);
  assert.ok(s.flowLpm > 0);
  assert.ok(s.events.some(e => e.message.includes('Central suction motor ON')));
});
test('north and diagonal scenario mappings use existing directional rules', () => {
  assert.deepEqual(ticks(scenario('North boundary exposure')).relayDry, [true, false, false, false]);
  assert.deepEqual(ticks(scenario('Multiple exposed zones')).relayDry, [true, true, false, false]);
});
test('high PM10 independently triggers control while preserving shared PM2.5 risk calculation', () => {
  const s = ticks(scenario('High PM10'));
  assert.equal(decision(s).demand, true); assert.equal(s.motor, true);
});
test('three strategies independently gate dry and wet outputs', () => {
  const dry = ticks(scenario('Dry extraction active'));
  const wet = ticks(scenario('Misting active'));
  const hybrid = ticks(scenario('Hybrid operation'));
  assert.equal(dry.motor, true); assert.equal(dry.pump, false);
  assert.equal(wet.motor, false); assert.equal(wet.pump, true);
  assert.equal(hybrid.motor, true); assert.equal(hybrid.pump, true);
});
test('live wind changes close old branches and open new ones', () => {
  let s = ticks(scenario('Northwest wind'));
  s = reducer(s, { type: 'input', key: 'windDirection', value: 90 });
  assert.deepEqual(s.dampers, ['CLOSING', 'OPENING', 'CLOSED', 'CLOSING']);
  s = ticks(s, 3);
  assert.deepEqual(s.dampers, ['CLOSED', 'OPEN', 'CLOSED', 'CLOSED']);
  assert.deepEqual(s.airflow, [0, 720, 0, 0]);
});
test('PM, dust and humidity changes recalculate risk without advancing time', () => {
  let s = scenario('Normal air quality');
  const old = decision(s).risk.score;
  s = reducer(s, { type: 'input', key: 'dustIntensity', value: 100 });
  s = reducer(s, { type: 'input', key: 'pm25', value: 180 });
  s = reducer(s, { type: 'input', key: 'humidity', value: 0 });
  assert.ok(decision(s).risk.score > old); assert.equal(s.second, 0); assert.equal(s.pump, true);
});
test('sensor loss and emergency stop de-energize outputs immediately even when paused', () => {
  for (const fault of ['sensor', 'estop', 'power'] as const) {
    let s = ticks(scenario('Hybrid operation'));
    s = reducer(s, { type: 'pause' });
    s = reducer(s, { type: 'fault', value: fault });
    assert.equal(s.motor, false); assert.equal(s.pump, false);
    assert.ok(s.position.every(v => v === 0)); assert.ok(s.valves.every(v => !v));
  }
});
test('damper jam does not create branch airflow; healthy branch remains operational', () => {
  const s = ticks(scenario('Damper malfunction'));
  assert.equal(s.dampers[0], 'FAULT'); assert.equal(s.airflow[0], 0);
  assert.equal(s.motor, true); assert.equal(s.airflow[3], 720);
  assert.equal(s.relayDry[0], false);
});
test('virtual UART frames encode actual relay state and safety inhibition without claiming firmware execution', () => {
  const s = ticks(scenario('Northwest wind'), 5);
  // A/D dampers + A/D valves + pump + suction = 9 + 144 + 256 + 512.
  assert.equal(actuatorCommand(s), 'SET 921\n');
  assert.equal(JSON.parse(sensorFrame(s)).pm10, s.inputs.pm10);
  assert.ok(s.events.some(e => e.message.includes('[Virtual actuator bus] SET 921')));
  assert.equal(actuatorCommand(reducer(s, { type: 'fault', value: 'estop' })), 'STOP\n');
});
test('HEPA clog inhibits dry extraction while healthy wet system remains available', () => {
  const s = ticks(scenario('HEPA filter clogged'));
  assert.equal(s.motor, false); assert.equal(s.pump, true); assert.ok(s.hepaPa > s.config.hepaTripPa);
});
test('pump failure closes valves and suppresses water flow, retaining dry extraction', () => {
  const s = ticks(scenario('Pump failure'));
  assert.equal(s.motor, true); assert.equal(s.pump, false);
  assert.equal(s.flowLpm, 0); assert.equal(s.pressureBar, 0); assert.ok(s.valves.every(v => !v));
});
test('manual commands require selected mode and obey actuator interlocks', () => {
  let s = reducer(initialState(), { type: 'manual', target: 'manualDry', index: 0 });
  assert.ok(s.manualDry.every(v => !v));
  s = reducer(s, { type: 'mode', value: 'Manual' }); s = reducer(s, { type: 'start' });
  s = reducer(s, { type: 'output', target: 'manualMotor' });
  s = reducer(s, { type: 'output', target: 'manualPump' });
  assert.equal(s.motor, false); assert.equal(s.pump, false);
  s = reducer(s, { type: 'manual', target: 'manualDry', index: 1 });
  s = reducer(s, { type: 'manual', target: 'manualWet', index: 2 }); s = ticks(s);
  assert.equal(s.motor, true); assert.equal(s.pump, true);
  assert.deepEqual(s.valves, [false, false, true, false]);
  s = reducer(s, { type: 'fault', value: 'estop' });
  assert.equal(s.motor, false); assert.equal(s.pump, false);
});
test('pause freezes clock; step advances one second; resume and reset work', () => {
  let s = ticks(scenario('Hybrid operation'));
  s = reducer(s, { type: 'pause' }); const paused = s;
  assert.deepEqual(reducer(s, { type: 'tick' }), paused);
  s = reducer(s, { type: 'step' }); assert.equal(s.second, paused.second + 1); assert.equal(s.running, false);
  s = reducer(s, { type: 'start' }); assert.equal(s.running, true);
  assert.deepEqual(reducer(s, { type: 'reset' }), initialState());
});
test('AI history contains real virtual clock samples only, capped at 121 consecutive seconds', () => {
  let s = ticks(scenario('Hybrid operation'), 130);
  assert.equal(s.history.length, 121); assert.equal(s.history[0].time_seconds, 10);
  assert.equal(s.history[120].time_seconds, 130);
  assert.ok(s.history.every(p => p.pm10_ug_m3 === 280 && p.time_seconds === p.observation_time_seconds));
  s = reducer(s, { type: 'fault', value: 'sensor' }); assert.equal(s.history.length, 0);
});
test('all fourteen scenarios are deterministic and change actual state', () => {
  assert.equal(Object.keys(SCENARIOS).length, 14);
  for (const name of Object.keys(SCENARIOS)) {
    const a = ticks(scenario(name)); const b = ticks(scenario(name));
    assert.deepEqual(a, b, name);
    assert.equal(a.started, true); assert.equal(a.second, 4);
    assert.ok(a.events.some(e => e.message === `Scenario loaded: ${name}`));
  }
});
test('configuration changes affect actuator travel and airflow; invalid copies cannot execute', () => {
  let s = scenario('Hybrid operation');
  s = reducer(s, { type: 'config', value: { ...DEFAULT_CONFIG, damperTravelSeconds: 6, nominalAirflowM3h: 900 } });
  s = ticks(s, 3); assert.equal(s.dampers[0], 'OPENING');
  assert.equal(s.airflow.reduce((a, b) => a + b, 0), 900);
  assert.throws(() => validateConfig({ ...DEFAULT_CONFIG, damperTravelSeconds: 0 }));
  assert.throws(() => validateConfig({ ...DEFAULT_CONFIG, eval: 'arbitrary code' }));
  assert.throws(() => validateConfig(null));
});
test('event ring buffer is bounded and export data remains serializable', () => {
  let s = scenario('Hybrid operation');
  for (let i = 0; i < 250; i++) s = reducer(s, { type: 'input', key: 'windDirection', value: i % 2 ? 0 : 180 });
  assert.equal(s.events.length, 200); assert.ok(JSON.stringify(s).length > 0);
  s = reducer(s, { type: 'clear' }); assert.equal(s.events.length, 0);
});
