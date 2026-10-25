import manifest from '../../../hardware/manifest.json';
import type { HardwareState } from './engine';
export interface HostCommand { dampers: boolean[]; valves: boolean[]; motor: boolean; pump: boolean; fan: boolean; safe: boolean }
export function telemetryPayload(s: HardwareState) {
  return { pm: s.channels.map(c => ({ id: c.id, pm1: c.valid ? c.pm1 : null, pm4: c.valid ? c.pm4 : null, pm25: c.valid ? c.pm25 : null, pm10: c.valid ? c.pm10 : null, valid: c.valid, sampleMs: c.sampleSecond * 1000 })), sht: [0].map(() => ({ temperatureC: s.inputs.temperatureC, humidity: s.inputs.humidity, valid: true })), windValid: s.fault !== 'wind', windSpeed: s.inputs.windSpeed, windDirection: s.inputs.windDirection, flowLpm: s.flowLpm, pressureBar: s.pressureBar, pressureValid: s.fault !== 'pressure', tankOk: s.tankL > .5 && s.fault !== 'lowWater', hepaPa: s.hepaPa, hepaValid: true, dustIntensity: s.inputs.dustIntensity, activity: s.activity, strategy: s.strategy, origin: 'browser-model' };
}
export function sensorFrame(s: HardwareState): string { return JSON.stringify({ v: manifest.protocol.version, type: 'telemetry', device: manifest.protocol.sensorDevice, seq: s.second, ms: s.second * 1000, payload: telemetryPayload(s) }); }
export function actuatorCommand(s: HardwareState): string {
  const safe = s.started && s.armed && !s.warnings.some(w => w.includes('sensor') || w.includes('watchdog')) && !['estop', 'power'].includes(s.fault);
  return JSON.stringify({ v: manifest.protocol.version, type: 'command', device: manifest.protocol.hostDevice, session: 'browser-model', seq: s.commandId, ms: s.second * 1000, payload: { dampers: s.relayDry, valves: s.relayWet, motor: s.motor, pump: s.pump, fan: s.fan, safe, stop: !safe } }) + '\n';
}
export function validateFrame(value: unknown): value is { v: number; type: string; device: string; seq: number; ms: number; payload: unknown } {
  if (!value || typeof value !== 'object') return false;
  const f = value as Record<string, unknown>;
  return f.v === manifest.protocol.version && typeof f.type === 'string' && typeof f.device === 'string' && Number.isInteger(f.seq) && (f.seq as number) >= 0 && Number.isFinite(f.ms) && (f.ms as number) >= 0 && typeof f.payload === 'object' && f.payload !== null;
}
export function modelExchange(s: HardwareState): string[] {
  if (s.fault === 'comm') return ['[MODEL BUS] ESP32 link lost: no telemetry / ACK received'];
  if (s.fault === 'pi') return ['[MODEL BUS] Host heartbeat lost: actuator watchdog counting'];
  if (!validateFrame(JSON.parse(sensorFrame(s)))) return ['[MODEL BUS] Invalid telemetry rejected'];
  const c = JSON.parse(actuatorCommand(s));
  return [`[SENSOR-ESP32 model] #${s.second} four-channel telemetry → host`, `[RASPBERRY-PI model] command #${c.seq} · ${JSON.stringify(c.payload)}`, `[ACTUATOR-ESP32 model] ACK #${c.seq} · motor ${s.motor ? 'ON' : 'OFF'} · pump ${s.pump ? 'ON' : 'OFF'}`];
}
