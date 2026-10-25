import { calculateCombinedRisk } from '../simulation/riskModel';
import { getDirectionalZones, getPredictedDirectionLabel } from '../circuit-simulator/simulatorEngine';
import { predictSimulation } from '../simulation/simulationEngine';
import { getRequiredFlowPerZone } from '../simulation/waterModel';
import { getBoundaryModelFactors, getBoundaryGeometries, getBoundaryDistanceM, getPlumeEstimate } from '../simulation/plumeModel';
import type { Measurement } from '../../integrations/dusttwin-ai/types';
import { modelExchange, type HostCommand } from './communication';

export const ZONES = ['A', 'B', 'C', 'D'] as const;
export const BOUNDARIES = ['North', 'East', 'South', 'West'] as const;
export const SENSOR_NAMES = [...BOUNDARIES];
export const STRATEGIES = ['Automatic selection', 'No Control', 'Dry Extraction', 'Targeted Misting', 'Hybrid Control'] as const;
export type Strategy = typeof STRATEGIES[number];
export const FAULTS = { none: 'No fault', sensor: 'North SPS30 disconnected', invalid: 'Invalid North PM reading', wind: 'Wind sensor failure', comm: 'ESP32 communication loss', pi: 'Raspberry Pi failure', damper: 'Damper A stuck closed', damperOpen: 'Damper A stuck open', motor: 'Suction motor fault', hepa: 'HEPA filter blocked', pump: 'Pump failure', lowWater: 'Low / empty tank', valve: 'Valve A stuck open', pressure: 'Pressure loss', estop: 'Emergency stop', power: 'Power interruption' } as const;
export type Fault = keyof typeof FAULTS;
export type Position = 'OPEN' | 'CLOSED' | 'OPENING' | 'CLOSING' | 'FAULT';
export type ActivityType = 'Drilling near hood' | 'Open-air soil' | 'Mixed work';
export interface Inputs { pm25: number; pm10: number; windSpeed: number; windDirection: number; temperatureC: number; humidity: number; dustIntensity: number }
export interface Config { damperTravelSeconds: number; nominalAirflowM3h: number; hepaTripPa: number; branchResistance: number; fanStaticPa: number; minimumAirflowM3h: number; filterCapacityG: number; tankCapacityL: number; captureEfficiency: number; cycloneEfficiency: number; hepaEfficiency: number; mistingRemovalRate: number; noisePercent: number; sensorIntervalSeconds: number }
export const DEFAULT_CONFIG: Config = { damperTravelSeconds: 3, nominalAirflowM3h: 720, hepaTripPa: 300, branchResistance: .005, fanStaticPa: 350, minimumAirflowM3h: 100, filterCapacityG: .5, tankCapacityL: 20, captureEfficiency: .65, cycloneEfficiency: .8, hepaEfficiency: .99, mistingRemovalRate: .06, noisePercent: 1.5, sensorIntervalSeconds: 1 };
export const DEFAULT_INPUTS: Inputs = { pm25: 18, pm10: 30, windSpeed: 3, windDirection: 315, temperatureC: 28, humidity: 45, dustIntensity: 15 };
export const INPUT_LIMITS: Record<keyof Inputs, [number, number, number, string]> = { pm25: [0, 1000, 1, 'µg/m³'], pm10: [0, 1000, 1, 'µg/m³'], windSpeed: [0, 10, .1, 'm/s'], windDirection: [0, 359, 1, '° toward'], temperatureC: [10, 50, .5, '°C'], humidity: [0, 100, 1, '% RH'], dustIntensity: [0, 100, 1, '%'] };
export interface PmChannel { id: number; pm1: number; pm25: number; pm4: number; pm10: number; valid: boolean; status: 'OK' | 'DISCONNECTED' | 'INVALID' | 'STALE'; sampleSecond: number; intervalSeconds: number; noisePercent: number; fault: 'none' | 'disconnected' | 'invalid'; override: boolean }
export interface HardwareState {
  inputs: Inputs; config: Config; mode: 'Automatic' | 'Manual'; strategy: Strategy; activity: ActivityType;
  fault: Fault; running: boolean; started: boolean; armed: boolean; second: number;
  manualDry: boolean[]; manualWet: boolean[]; manualMotor: boolean; manualPump: boolean; windFan: boolean;
  position: number[]; dampers: Position[]; valves: boolean[]; relayDry: boolean[]; relayWet: boolean[];
  motor: boolean; pump: boolean; fan: boolean; airflow: number[]; flowLpm: number; pressureBar: number; hepaPa: number;
  channels: PmChannel[]; tankL: number; waterUsedL: number; binG: number; filterG: number; capturedG: number;
  warnings: string[]; commandId: number; lastTelemetry: number; lastAck: number; lastHost: number;
  hostEnabled: boolean; hostCommand: HostCommand | null; hostStatus: string;
  history: Measurement[]; events: { second: number; message: string }[];
  trend: Array<{ time: number; north: number; east: number; south: number; west: number }>;
}
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
function concentrations(input: Inputs) {
  const f = getBoundaryGeometries().map(b => getBoundaryModelFactors(input, b).directionalFactor), peak = Math.max(...f);
  return f.map(v => .12 + .88 * v / peak).map(v => { const pm25 = Math.min(1000, input.pm25 * v), pm10 = Math.min(1000, Math.max(input.pm25, input.pm10) * v); return { pm1: .62 * pm25, pm25, pm4: pm25 + .55 * (pm10 - pm25), pm10 }; });
}
function newChannels(input: Inputs, config: Config): PmChannel[] {
  return concentrations(input).map((p, id) => ({ ...p, id, valid: true, status: 'OK', sampleSecond: 0, intervalSeconds: config.sensorIntervalSeconds, noisePercent: config.noisePercent, fault: 'none', override: false }));
}
export function initialState(): HardwareState {
  return { inputs: { ...DEFAULT_INPUTS }, config: { ...DEFAULT_CONFIG }, activity: 'Mixed work', mode: 'Automatic', strategy: 'Hybrid Control', fault: 'none', running: false, started: false, armed: false, second: 0, manualDry: ZONES.map(() => false), manualWet: ZONES.map(() => false), manualMotor: false, manualPump: false, windFan: false, position: [0, 0, 0, 0], dampers: ['CLOSED', 'CLOSED', 'CLOSED', 'CLOSED'], valves: ZONES.map(() => false), relayDry: ZONES.map(() => false), relayWet: ZONES.map(() => false), motor: false, pump: false, fan: false, airflow: [0, 0, 0, 0], flowLpm: 0, pressureBar: 0, hepaPa: 45, channels: newChannels(DEFAULT_INPUTS, DEFAULT_CONFIG), tankL: DEFAULT_CONFIG.tankCapacityL, waterUsedL: 0, binG: 0, filterG: 0, capturedG: 0, warnings: [], commandId: 0, lastTelemetry: 0, lastAck: 0, lastHost: 0, hostEnabled: false, hostCommand: null, hostStatus: 'Browser control model', history: [], trend: [], events: [{ second: 0, message: 'Hardware Lab ready. Virtual peripherals · browser model. Physical hardware unverified.' }] };
}
export function decision(s: HardwareState) {
  const peak25 = Math.max(0, ...s.channels.slice(0, 4).filter(c => c.valid).map(c => c.pm25));
  const peak10 = Math.max(0, ...s.channels.slice(0, 4).filter(c => c.valid).map(c => c.pm10));
  const risk = calculateCombinedRisk(s.inputs, peak25), demand = risk.status !== 'LOW' || peak10 >= 150;
  const exposed = getDirectionalZones(s.inputs.windDirection);
  let strategy = s.strategy;
  if (strategy === 'Automatic selection') strategy = s.activity === 'Drilling near hood' ? 'Dry Extraction' : s.activity === 'Open-air soil' || s.inputs.windSpeed > 5 ? 'Targeted Misting' : 'Hybrid Control';
  const current = { north: s.channels[0].pm25, east: s.channels[1].pm25, south: s.channels[2].pm25, west: s.channels[3].pm25 };
  const existing = predictSimulation(s.inputs, current, 'predictive', true);
  const transport = Math.round(Math.min(...getBoundaryGeometries().filter((_, i) => exposed[i]).map(b => getBoundaryDistanceM(b))) / getPlumeEstimate(s.inputs).effectiveVelocityMps);
  return { risk, demand, exposed, strategy, peak25, peak10, direction: getPredictedDirectionLabel(s.inputs.windDirection), leadTime: demand ? existing.leadTimeSeconds ?? Math.max(1, transport) : null };
}
function log(s: HardwareState, messages: string[]): HardwareState { return { ...s, events: [...s.events, ...messages.map(message => ({ second: s.second, message }))].slice(-250) }; }
export function sampleChannels(s: HardwareState, second: number): PmChannel[] {
  const targets = concentrations(s.inputs);
  return s.channels.map((c, i) => {
    const fault = i === 0 && s.fault === 'sensor' ? 'disconnected' : i === 0 && s.fault === 'invalid' ? 'invalid' : c.fault;
    if (fault !== 'none') return { ...c, valid: false, status: fault === 'disconnected' ? 'DISCONNECTED' : 'INVALID' };
    if (c.override && c.pm10 < c.pm25) return { ...c, valid: false, status: 'INVALID' };
    if (['comm', 'power'].includes(s.fault)) return { ...c, valid: false, status: 'STALE' };
    if (second - c.sampleSecond < c.intervalSeconds) return { ...c, valid: second - c.sampleSecond <= 3, status: second - c.sampleSecond <= 3 ? 'OK' : 'STALE' };
    if (c.override) return { ...c, pm1: .62 * c.pm25, pm4: c.pm25 + .55 * (c.pm10 - c.pm25), valid: c.pm10 >= c.pm25, status: c.pm10 >= c.pm25 ? 'OK' : 'INVALID', sampleSecond: second };
    const noise = Math.sin((second + 1) * (i + 1) * 12.9898) * c.noisePercent / 100;
    const dry = i < 4 ? s.airflow[i] / Math.max(1, s.config.nominalAirflowM3h) * s.config.captureEfficiency : i === 4 && s.activity === 'Drilling near hood' && s.motor ? s.config.captureEfficiency : 0;
    const wet = i < 4 && s.pump && s.valves[i] ? s.config.mistingRemovalRate * (1 + s.inputs.humidity / 100) : 0;
    const change = (value: number, target: number) => Math.max(0, (value + .18 * (target * (1 + noise) - value)) * (1 - clamp(dry * .2 + wet, 0, .9)));
    const pm25 = change(c.pm25, targets[i].pm25), pm10 = Math.max(pm25, change(c.pm10, targets[i].pm10));
    return { ...c, pm1: .62 * pm25, pm25, pm4: pm25 + .55 * (pm10 - pm25), pm10, valid: true, status: 'OK', sampleSecond: second };
  });
}
/** Deterministic functional mass/flow balance; not electrical emulation or CFD. */
export function reconcile(before: HardwareState, s: HardwareState, advance = false): HardwareState {
  const d = decision(s), lost = s.second - Math.min(s.lastTelemetry, s.lastAck, s.lastHost) > 2;
  const invalid = s.channels.some(c => !c.valid) || ['sensor', 'invalid', 'wind'].includes(s.fault);
  const enabled = s.started && s.armed && !invalid && !lost && (!s.hostEnabled || !!s.hostCommand?.safe) && !['estop', 'power'].includes(s.fault);
  const hepaPa = s.fault === 'hepa' ? s.config.hepaTripPa + 50 : 45 + 260 * s.filterG / s.config.filterCapacityG;
  const drySafe = enabled && hepaPa < s.config.hepaTripPa && !['motor', 'damperOpen'].includes(s.fault);
  const wetSafe = enabled && s.tankL > .5 && !['pump', 'lowWater', 'pressure', 'valve'].includes(s.fault);
  const host = s.hostEnabled ? s.hostCommand : null;
  const dry = ZONES.map((_, i) => drySafe && !(s.fault === 'damper' && i === 0) && (host ? host.dampers[i] : s.mode === 'Manual' ? s.manualDry[i] : ['Dry Extraction', 'Hybrid Control'].includes(d.strategy) && d.demand && d.exposed[i]));
  const wet = ZONES.map((_, i) => wetSafe && (host ? host.valves[i] : s.mode === 'Manual' ? s.manualWet[i] : ['Targeted Misting', 'Hybrid Control'].includes(d.strategy) && d.demand && d.exposed[i]));
  const position = s.position.map((value, i) => s.fault === 'damperOpen' && i === 0 ? 1 : !enabled || s.fault === 'damper' && i === 0 ? 0 : advance ? clamp(value + (dry[i] ? 1 : -1) / s.config.damperTravelSeconds, 0, 1) : value);
  const dampers: Position[] = position.map((v, i) => ['damper', 'damperOpen'].includes(s.fault) && i === 0 ? 'FAULT' : dry[i] ? v >= 1 - 1e-8 ? 'OPEN' : 'OPENING' : v <= 1e-8 ? 'CLOSED' : 'CLOSING');
  const confirmed = dry.some(Boolean) && dry.every((want, i) => !want || position[i] >= 1 - 1e-8);
  const motor = drySafe && confirmed && (host ? host.motor : s.mode === 'Manual' ? s.manualMotor : true);
  const pump = wetSafe && wet.some(Boolean) && (host ? host.pump : s.mode === 'Manual' ? s.manualPump : true);
  const valves = wet.map((on, i) => s.fault === 'valve' && i === 0 ? true : on);
  const raw = position.map(v => Math.sqrt(Math.max(0, s.config.fanStaticPa - hepaPa) / s.config.branchResistance) * v), total = raw.reduce((a, b) => a + b, 0);
  const airflow = raw.map(q => motor ? q * Math.min(1, s.config.nominalAirflowM3h / Math.max(1, total)) : 0);
  const flowLpm = pump ? wet.filter(Boolean).length * (getRequiredFlowPerZone(d.risk.status) || .5) : 0;
  const water = advance ? Math.min(s.tankL, flowLpm / 60) : 0;
  const captured = advance ? airflow.reduce((sum, q, i) => sum + q / 3600 * s.channels[i].pm10 / 1e6 * s.config.captureEfficiency, 0) : 0;
  const cyclone = captured * s.config.cycloneEfficiency, warnings: string[] = [];
  if (invalid) warnings.push('Invalid / stale sensor: suppression inhibited');
  if (lost) warnings.push('Communication watchdog: outputs de-energized; re-arm after recovery');
  if (hepaPa >= s.config.hepaTripPa) warnings.push('HEPA pressure trip: dry extraction inhibited');
  if (s.tankL <= .5 || s.fault === 'lowWater') warnings.push('Low tank: pump dry-run interlock');
  if (motor && airflow.some((q, i) => dry[i] && q < s.config.minimumAirflowM3h)) warnings.push('Insufficient branch airflow; capture is not assured');
  if (s.fault === 'valve') warnings.push('Valve A stuck open: pump isolated');
  if (s.fault === 'damperOpen') warnings.push('Uncommanded open damper: suction inhibited');
  if (s.activity !== 'Drilling near hood' && motor && s.inputs.windSpeed > 5) warnings.push('Open-air capture feasibility unverified');
  const after: HardwareState = { ...s, position, dampers, relayDry: dry, relayWet: wet, valves, motor, pump, fan: enabled && (host ? host.fan : s.windFan), airflow, flowLpm, pressureBar: pump ? 3 * Math.min(1, s.tankL / 2) : 0, hepaPa, tankL: s.tankL - water, waterUsedL: s.waterUsedL + water, capturedG: s.capturedG + captured, binG: s.binG + cyclone, filterG: s.filterG + (captured - cyclone) * s.config.hepaEfficiency, warnings };
  const messages: string[] = [];
  if (before.inputs.windDirection !== s.inputs.windDirection || before.started !== s.started) messages.push(`[PI model] Wind toward ${d.direction}; zones ${ZONES.filter((_, i) => d.exposed[i]).join(', ')}`);
  if (decision(before).risk.status !== d.risk.status || before.started !== s.started) messages.push(`[PI model] Risk ${d.risk.status} · ${d.risk.score}/100 · ${d.strategy}`);
  if (before.fault !== s.fault) messages.push(s.fault === 'none' ? 'Fault cleared; explicit Start / re-arm required.' : `FAULT: ${s.fault}`);
  dampers.forEach((v, i) => { if (v !== before.dampers[i]) messages.push(`[ACTUATOR model] Damper ${ZONES[i]}: ${v}`); });
  valves.forEach((v, i) => { if (v !== before.valves[i]) messages.push(`[ACTUATOR model] Valve ${ZONES[i]}: ${v ? 'OPEN' : 'CLOSED'}`); });
  if (motor !== before.motor) messages.push(`[ACTUATOR model] Central suction motor ${motor ? 'ON' : 'OFF'}`);
  if (pump !== before.pump) messages.push(`[ACTUATOR model] Water pump ${pump ? 'ON' : 'OFF'}`);
  warnings.filter(w => !before.warnings.includes(w)).forEach(w => messages.push(`INTERLOCK: ${w}`));
  return log(after, messages);
}
export type Action = { type: 'start' | 'pause' | 'stop' | 'step' | 'tick' | 'reset' | 'clear' | 'refill' | 'service-filter' } | { type: 'input'; key: keyof Inputs; value: number } | { type: 'mode'; value: HardwareState['mode'] } | { type: 'strategy'; value: Strategy } | { type: 'activity'; value: ActivityType } | { type: 'fault'; value: Fault } | { type: 'scenario'; name: string } | { type: 'manual'; target: 'manualDry' | 'manualWet'; index: number } | { type: 'manual-zone'; index: number; active: boolean } | { type: 'output'; target: 'manualMotor' | 'manualPump' | 'windFan' } | { type: 'config'; value: Config } | { type: 'channel'; index: number; values: Partial<PmChannel> } | { type: 'host'; enabled: boolean } | { type: 'host-command'; command: HostCommand | null; status: string };
export const SCENARIOS: Record<string, { inputs?: Partial<Inputs>; strategy?: Strategy; fault?: Fault; activity?: ActivityType }> = {
  'Normal air quality': { inputs: DEFAULT_INPUTS }, 'Heavy drilling': { inputs: { dustIntensity: 95, pm25: 180, pm10: 340 }, activity: 'Drilling near hood', strategy: 'Automatic selection' }, 'North boundary exposure': { inputs: { windDirection: 0, pm25: 95, pm10: 180 } }, 'Northwest wind': { inputs: { windDirection: 315, pm25: 110, pm10: 220 } }, 'Multiple exposed zones': { inputs: { windDirection: 45, pm25: 130, pm10: 260, dustIntensity: 90 } }, 'High PM10': { inputs: { pm25: 25, pm10: 400 } }, 'Dry extraction active': { inputs: { pm25: 120, pm10: 240 }, strategy: 'Dry Extraction' }, 'Misting active': { inputs: { pm25: 120, pm10: 240 }, strategy: 'Targeted Misting' }, 'Hybrid operation': { inputs: { pm25: 140, pm10: 280 }, strategy: 'Hybrid Control' }, 'No control baseline': { inputs: { pm25: 140, pm10: 280 }, strategy: 'No Control' }, 'Open-air soil dust': { inputs: { dustIntensity: 90, pm25: 100, pm10: 240, windSpeed: 7 }, strategy: 'Automatic selection', activity: 'Open-air soil' },
  ...Object.fromEntries(Object.entries(FAULTS).filter(([key]) => key !== 'none').map(([fault, label]) => [label, { fault: fault as Fault }])),
};
const LIMITS: Record<keyof Config, [number, number]> = { damperTravelSeconds: [1, 120], nominalAirflowM3h: [10, 5000], hepaTripPa: [150, 1000], branchResistance: [.0001, 1], fanStaticPa: [50, 2000], minimumAirflowM3h: [1, 1000], filterCapacityG: [.01, 10000], tankCapacityL: [1, 1000], captureEfficiency: [0, 1], cycloneEfficiency: [0, 1], hepaEfficiency: [0, 1], mistingRemovalRate: [0, .5], noisePercent: [0, 20], sensorIntervalSeconds: [1, 10] };
export function validateConfig(value: unknown): Config {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Configuration must be a JSON object.');
  const c = value as Config;
  for (const key of Object.keys(DEFAULT_CONFIG) as (keyof Config)[]) { const [min, max] = LIMITS[key]; if (!Number.isFinite(c[key]) || c[key] < min || c[key] > max) throw new Error(`${key} must be between ${min} and ${max}.`); }
  if (Object.keys(c).some(k => !(k in DEFAULT_CONFIG))) throw new Error('Unknown configuration field.');
  return { ...c };
}
export function reducer(s: HardwareState, a: Action): HardwareState {
  switch (a.type) {
    case 'reset': return initialState();
    case 'clear': return { ...s, events: [] };
    case 'pause': return log({ ...s, running: false }, ['Paused virtual clock; outputs held. Emergency stop stays live.']);
    case 'stop': return log(reconcile(s,{...s,running:false,started:false,armed:false,manualDry:ZONES.map(()=>false),manualWet:ZONES.map(()=>false),manualMotor:false,manualPump:false,windFan:false,hostCommand:null}),['Simulation stopped; all driver requests de-energized.']);
    case 'start': return log(reconcile(s, { ...s, running: true, started: true, armed: !['estop', 'power'].includes(s.fault), lastTelemetry: s.second, lastAck: s.second, lastHost: s.second }), ['Virtual clock running; controller re-arm requested.']);
    case 'step': case 'tick': {
      if (a.type === 'tick' && !s.running) return s;
      const second = s.second + 1, channels = sampleChannels(s, second), link = !['comm', 'power'].includes(s.fault), host = s.fault !== 'pi', source = channels[0];
      const sample: Measurement = { time_seconds: second, observation_time_seconds: source.sampleSecond, pm10_ug_m3: source.pm10 };
      let next = reconcile(s, { ...s, second, started: true, armed: s.started ? s.armed : true, channels, lastTelemetry: link ? second : s.lastTelemetry, lastAck: link && host ? second : s.lastAck, lastHost: host ? second : s.lastHost, commandId: s.commandId + (link && host ? 1 : 0), history: source.valid && link ? [...s.history, sample].slice(-121) : [], trend:[...s.trend,{time:second,north:channels[0].pm10,east:channels[1].pm10,south:channels[2].pm10,west:channels[3].pm10}].slice(-120) }, true);
      if (next.warnings.some(w => w.startsWith('Communication watchdog'))) next = { ...next, armed: false };
      return second % 2 === 0 || !link || !host ? log(next, modelExchange(next)) : next;
    }
    case 'input': {
      if (!Number.isFinite(a.value)) return s;
      const [min, max] = INPUT_LIMITS[a.key], inputs = { ...s.inputs, [a.key]: clamp(a.value, min, max) };
      const channels = ['pm25', 'pm10'].includes(a.key) ? newChannels(inputs, s.config).map((c, i) => ({ ...c, fault: s.channels[i].fault, intervalSeconds: s.channels[i].intervalSeconds, noisePercent: s.channels[i].noisePercent, sampleSecond: s.second })) : s.channels;
      return reconcile(s, { ...s, inputs, channels });
    }
    case 'channel': {
      if (a.index < 0 || a.index > 3) return s;
      for (const key of ['pm25', 'pm10', 'intervalSeconds', 'noisePercent'] as const) if (key in a.values && !Number.isFinite(a.values[key])) return s;
      const channels = s.channels.map((c, i) => i === a.index ? { ...c, ...a.values, id: c.id, pm25: clamp(a.values.pm25 ?? c.pm25, 0, 1000), pm10: clamp(a.values.pm10 ?? c.pm10, 0, 1000), intervalSeconds: clamp(a.values.intervalSeconds ?? c.intervalSeconds, 1, 10), noisePercent: clamp(a.values.noisePercent ?? c.noisePercent, 0, 20), sampleSecond: s.second, override: a.values.override ?? (a.values.pm25 !== undefined || a.values.pm10 !== undefined ? true : c.override) } : c);
      return reconcile(s, { ...s, channels: channels.map(c => ({ ...c, pm1:.62*c.pm25,pm4:c.pm25+.55*(c.pm10-c.pm25),valid: c.fault === 'none' && c.pm10 >= c.pm25, status: c.fault === 'disconnected' ? 'DISCONNECTED' : c.fault === 'invalid' || c.pm10 < c.pm25 ? 'INVALID' : 'OK' })) });
    }
    case 'mode': return log(reconcile(s, { ...s, mode: a.value, manualDry: ZONES.map(() => false), manualWet: ZONES.map(() => false), manualMotor: false, manualPump: false }), [`${a.value} control enabled.`]);
    case 'strategy': return log(reconcile(s, { ...s, strategy: a.value }), [`Strategy: ${a.value}`]);
    case 'activity': return reconcile(s, { ...s, activity: a.value });
    case 'fault': return reconcile(s, { ...s, fault: a.value, armed: a.value === 'none' || ['estop', 'power'].includes(a.value) ? false : s.armed, history: ['sensor', 'invalid', 'power', 'comm'].includes(a.value) ? [] : s.history, tankL: a.value === 'lowWater' ? 0 : s.tankL });
    case 'manual': return s.mode !== 'Manual' || a.index < 0 || a.index > 3 ? s : reconcile(s, { ...s, [a.target]: s[a.target].map((v, i) => i === a.index ? !v : v) });
    case 'manual-zone': return s.mode !== 'Manual'||a.index<0||a.index>3?s:reconcile(s,{...s,manualDry:s.manualDry.map((v,i)=>i===a.index?a.active:v),manualWet:s.manualWet.map((v,i)=>i===a.index?a.active:v)});
    case 'output': return a.target !== 'windFan' && s.mode !== 'Manual' ? s : reconcile(s, { ...s, [a.target]: !s[a.target] });
    case 'config': { const config = validateConfig(a.value); return log(reconcile(s, { ...s, config, tankL: Math.min(s.tankL, config.tankCapacityL), channels: s.channels.map(c => ({ ...c, intervalSeconds: config.sensorIntervalSeconds, noisePercent: config.noisePercent })) }), ['Simulation configuration applied.']); }
    case 'refill': return log({ ...s, tankL: s.config.tankCapacityL }, ['Virtual tank refilled.']);
    case 'service-filter': return log(reconcile(s, { ...s, filterG: 0, binG: 0 }), ['Virtual filter/container serviced.']);
    case 'host': return reconcile(s, { ...s, hostEnabled: a.enabled, hostCommand: null, hostStatus: a.enabled ? 'Connecting to Python host' : 'Browser control model' });
    case 'host-command': return reconcile(s, { ...s, hostCommand: a.command, hostStatus: a.status });
    case 'scenario': {
      const preset = SCENARIOS[a.name]; if (!preset) return s;
      const base = initialState(), inputs = { ...DEFAULT_INPUTS, ...(preset.fault ? { pm25: 140, pm10: 280 } : {}), ...preset.inputs };
      return log(reconcile(base, { ...base, inputs, channels: newChannels(inputs, s.config), config: s.config, tankL: preset.fault === 'lowWater' ? 0 : s.config.tankCapacityL, running: true, started: true, armed: true, fault: preset.fault ?? 'none', strategy: preset.strategy ?? 'Hybrid Control', activity: preset.activity ?? 'Mixed work' }), [`Scenario loaded: ${a.name}`]);
    }
  }
}
