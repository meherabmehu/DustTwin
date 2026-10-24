import { calculateCombinedRisk } from '../simulation/riskModel';
import { getDirectionalZones, getPredictedDirectionLabel } from '../circuit-simulator/simulatorEngine';
import { predictSimulation } from '../simulation/simulationEngine';
import { getRequiredFlowPerZone } from '../simulation/waterModel';
import type { Measurement } from '../../integrations/dusttwin-ai/types';
import { actuatorCommand, sensorFrame } from './communication';

export const ZONES = ['A', 'B', 'C', 'D'] as const;
export const BOUNDARIES = ['North', 'East', 'South', 'West'] as const;
export type Strategy = 'Dry Extraction' | 'Water Misting' | 'Hybrid';
export type Fault = 'none' | 'sensor' | 'damper' | 'hepa' | 'pump' | 'estop' | 'power';
export type Position = 'OPEN' | 'CLOSED' | 'OPENING' | 'CLOSING' | 'FAULT';
export interface Inputs { pm25: number; pm10: number; windSpeed: number; windDirection: number; temperatureC: number; humidity: number; dustIntensity: number }
export interface Config { damperTravelSeconds: number; nominalAirflowM3h: number; hepaTripPa: number }
export const DEFAULT_CONFIG: Config = { damperTravelSeconds: 3, nominalAirflowM3h: 720, hepaTripPa: 300 };
export const DEFAULT_INPUTS: Inputs = { pm25: 18, pm10: 30, windSpeed: 3, windDirection: 315, temperatureC: 28, humidity: 45, dustIntensity: 15 };
export const INPUT_LIMITS: Record<keyof Inputs, [number, number, number, string]> = {
  pm25: [0, 1000, 1, 'µg/m³'], pm10: [0, 1000, 1, 'µg/m³'], windSpeed: [0, 10, .1, 'm/s'], windDirection: [0, 359, 1, '° toward'], temperatureC: [10, 50, .5, '°C'], humidity: [0, 100, 1, '% RH'], dustIntensity: [0, 100, 1, '%'],
};
export interface HardwareState {
  inputs: Inputs; config: Config; mode: 'Automatic' | 'Manual'; strategy: Strategy;
  fault: Fault; running: boolean; started: boolean; second: number;
  manualDry: boolean[]; manualWet: boolean[]; manualMotor: boolean; manualPump: boolean; windFan: boolean;
  position: number[]; dampers: Position[]; valves: boolean[]; relayDry: boolean[]; relayWet: boolean[];
  motor: boolean; pump: boolean; airflow: number[]; flowLpm: number; pressureBar: number; hepaPa: number;
  history: Measurement[]; events: { second: number; message: string }[];
}
export function initialState(): HardwareState {
  return { inputs: { ...DEFAULT_INPUTS }, config: { ...DEFAULT_CONFIG }, mode: 'Automatic', strategy: 'Hybrid', fault: 'none', running: false, started: false, second: 0, manualDry: ZONES.map(() => false), manualWet: ZONES.map(() => false), manualMotor: false, manualPump: false, windFan: false, position: [0, 0, 0, 0], dampers: ['CLOSED', 'CLOSED', 'CLOSED', 'CLOSED'], valves: ZONES.map(() => false), relayDry: ZONES.map(() => false), relayWet: ZONES.map(() => false), motor: false, pump: false, airflow: [0, 0, 0, 0], flowLpm: 0, pressureBar: 0, hepaPa: 45, history: [], events: [{ second: 0, message: 'Logic simulator ready. All readings are virtual; outputs de-energized.' }] };
}
export function decision(state: HardwareState) {
  const risk = calculateCombinedRisk(state.inputs, state.inputs.pm25);
  // PM10 can independently demand control, without relabeling the shared PM2.5 risk formula.
  const demand = risk.status !== 'LOW' || state.inputs.pm10 >= 150;
  const exposed = getDirectionalZones(state.inputs.windDirection);
  const existing = predictSimulation(state.inputs, { north: state.inputs.pm25, east: state.inputs.pm25, south: state.inputs.pm25, west: state.inputs.pm25 }, 'predictive', true);
  return { risk, demand, exposed, direction: getPredictedDirectionLabel(state.inputs.windDirection), leadTime: demand ? existing.leadTimeSeconds : null };
}
function log(state: HardwareState, messages: string[]): HardwareState {
  return { ...state, events: [...state.events, ...messages.map(message => ({ second: state.second, message }))].slice(-200) };
}
/** Functional flow estimates, not CFD or electrical emulation. One tick = one virtual second. */
export function reconcile(before: HardwareState, candidate: HardwareState, advance = false): HardwareState {
  const d = decision(candidate);
  const enabled = candidate.started && !['estop', 'power', 'sensor'].includes(candidate.fault);
  const drySafe = enabled && candidate.fault !== 'hepa';
  const dry = ZONES.map((_, i) => drySafe && !(candidate.fault === 'damper' && i === 0) && (candidate.mode === 'Manual' ? candidate.manualDry[i] : candidate.strategy !== 'Water Misting' && d.demand && d.exposed[i]));
  const wet = ZONES.map((_, i) => enabled && candidate.fault !== 'pump' && (candidate.mode === 'Manual' ? candidate.manualWet[i] : candidate.strategy !== 'Dry Extraction' && d.demand && d.exposed[i]));
  const position = candidate.position.map((value, i) => {
    if (!enabled) return 0; // modeled spring-return safety closure
    if (candidate.fault === 'damper' && i === 0) return 0;
    return advance ? Math.min(1, Math.max(0, value + (dry[i] ? 1 : -1) / candidate.config.damperTravelSeconds)) : value;
  });
  const dampers: Position[] = position.map((v, i) => candidate.fault === 'damper' && i === 0 ? 'FAULT' : dry[i] ? v >= 1 - 1e-8 ? 'OPEN' : 'OPENING' : v <= 1e-8 ? 'CLOSED' : 'CLOSING');
  const open = position.filter(v => v > 1e-8).length;
  const motor = drySafe && open > 0 && (candidate.mode === 'Manual' ? candidate.manualMotor : dry.some(Boolean));
  const pump = enabled && candidate.fault !== 'pump' && wet.some(Boolean) && (candidate.mode === 'Manual' ? candidate.manualPump : true);
  const perZone = getRequiredFlowPerZone(d.risk.status) || .5;
  const totalPosition = position.reduce((a, b) => a + b, 0);
  const after: HardwareState = { ...candidate, position, dampers, relayDry: dry, relayWet: wet, valves: wet, motor, pump,
    airflow: position.map(v => motor ? Math.round(candidate.config.nominalAirflowM3h * v / Math.max(1, totalPosition)) : 0),
    flowLpm: pump ? wet.filter(Boolean).length * perZone : 0, pressureBar: pump ? 3 : 0,
    hepaPa: candidate.fault === 'hepa' ? candidate.config.hepaTripPa + 50 : motor ? 120 : 45,
  };
  const messages: string[] = [];
  if (before.inputs.windDirection !== after.inputs.windDirection || before.started !== after.started) messages.push(`Wind toward ${d.direction}; exposed boundaries: ${BOUNDARIES.filter((_, i) => d.exposed[i]).join(', ')}`);
  if (decision(before).risk.status !== d.risk.status || before.started !== after.started) messages.push(`Risk ${d.risk.status} · ${d.risk.score}/100`);
  if (before.fault !== after.fault) messages.push(after.fault === 'none' ? 'Fault cleared; controller interlocks re-evaluated.' : `FAULT: ${after.fault}; affected outputs inhibited.`);
  dampers.forEach((v, i) => { if (v !== before.dampers[i]) messages.push(`Damper ${ZONES[i]}: ${v} · relay ${dry[i] ? 'ON' : 'OFF'}`); });
  wet.forEach((v, i) => { if (v !== before.valves[i]) messages.push(`Solenoid ${ZONES[i]} ${v ? 'OPEN' : 'CLOSED'} · relay ${v ? 'ON' : 'OFF'}`); });
  if (motor !== before.motor) messages.push(`Central suction motor ${motor ? 'ON' : 'OFF'}`);
  if (pump !== before.pump) messages.push(`Water pump ${pump ? 'ON' : 'OFF'}`);
  return log(after, messages);
}
export type Action = { type: 'start' | 'pause' | 'step' | 'tick' | 'reset' | 'clear' } | { type: 'input'; key: keyof Inputs; value: number } | { type: 'mode'; value: HardwareState['mode'] } | { type: 'strategy'; value: Strategy } | { type: 'fault'; value: Fault } | { type: 'scenario'; name: string } | { type: 'manual'; target: 'manualDry' | 'manualWet'; index: number } | { type: 'output'; target: 'manualMotor' | 'manualPump' | 'windFan' } | { type: 'config'; value: Config };
export const SCENARIOS: Record<string, { inputs?: Partial<Inputs>; strategy?: Strategy; fault?: Fault }> = {
  'Normal air quality': { inputs: DEFAULT_INPUTS },
  'Heavy drilling': { inputs: { dustIntensity: 95, pm25: 180, pm10: 340 } },
  'North boundary exposure': { inputs: { windDirection: 0, pm25: 95, pm10: 180 } },
  'Northwest wind': { inputs: { windDirection: 315, pm25: 110, pm10: 220 } },
  'Multiple exposed zones': { inputs: { windDirection: 45, pm25: 130, pm10: 260, dustIntensity: 90 } },
  'High PM10': { inputs: { pm25: 25, pm10: 400 } },
  'Dry extraction active': { inputs: { pm25: 120, pm10: 240 }, strategy: 'Dry Extraction' },
  'Misting active': { inputs: { pm25: 120, pm10: 240 }, strategy: 'Water Misting' },
  'Hybrid operation': { inputs: { pm25: 140, pm10: 280 }, strategy: 'Hybrid' },
  'Sensor disconnected': { fault: 'sensor' }, 'Damper malfunction': { fault: 'damper' },
  'HEPA filter clogged': { fault: 'hepa' }, 'Pump failure': { fault: 'pump' }, 'Emergency stop': { fault: 'estop' },
};
export function validateConfig(value: unknown): Config {
  if (!value || typeof value !== 'object') throw new Error('Configuration must be a JSON object.');
  const c = value as Config;
  for (const [key, min, max] of [['damperTravelSeconds', 1, 30], ['nominalAirflowM3h', 10, 5000], ['hepaTripPa', 150, 1000]] as const) {
    if (!Number.isFinite(c[key]) || c[key] < min || c[key] > max) throw new Error(`${key} must be between ${min} and ${max}.`);
  }
  if (Object.keys(c).some(k => !(k in DEFAULT_CONFIG))) throw new Error('Unknown configuration field.');
  return { damperTravelSeconds: c.damperTravelSeconds, nominalAirflowM3h: c.nominalAirflowM3h, hepaTripPa: c.hepaTripPa };
}
export function reducer(state: HardwareState, action: Action): HardwareState {
  switch (action.type) {
    case 'reset': return initialState();
    case 'clear': return { ...state, events: [] };
    case 'pause': return log({ ...state, running: false }, ['Paused virtual clock; outputs held. Emergency stop remains available.']);
    case 'start': return log(reconcile(state, { ...state, running: true, started: true }), ['Virtual clock running.']);
    case 'step':
    case 'tick': {
      if (action.type === 'tick' && !state.running) return state;
      const second = state.second + 1;
      const sample: Measurement = { time_seconds: second, observation_time_seconds: second, pm10_ug_m3: state.inputs.pm10 };
      const next = reconcile(state, { ...state, second, started: true, history: state.fault === 'sensor' || state.fault === 'power' ? [] : [...state.history, sample].slice(-121) }, true);
      return second % 5 === 0 ? log(next, [`[Virtual sensor bus] ${sensorFrame(next)}`, `[Virtual actuator bus] ${actuatorCommand(next).trim()}`]) : next;
    }
    case 'input': {
      if (!Number.isFinite(action.value)) return state;
      const [min, max] = INPUT_LIMITS[action.key];
      return reconcile(state, { ...state, inputs: { ...state.inputs, [action.key]: Math.max(min, Math.min(max, action.value)) } });
    }
    case 'mode': return log(reconcile(state, { ...state, mode: action.value, manualDry: ZONES.map(() => false), manualWet: ZONES.map(() => false), manualMotor: false, manualPump: false }), [`${action.value} controller enabled.`]);
    case 'strategy': return log(reconcile(state, { ...state, strategy: action.value }), [`Strategy: ${action.value}`]);
    case 'fault': return reconcile(state, { ...state, fault: action.value, history: ['sensor', 'power'].includes(action.value) ? [] : state.history });
    case 'manual': {
      if (state.mode !== 'Manual' || action.index < 0 || action.index > 3) return state;
      return reconcile(state, { ...state, [action.target]: state[action.target].map((v, i) => i === action.index ? !v : v) });
    }
    case 'output': {
      if (action.target !== 'windFan' && state.mode !== 'Manual') return state;
      return log(reconcile(state, { ...state, [action.target]: !state[action.target] }), [`${action.target}: ${!state[action.target] ? 'ON' : 'OFF'}`]);
    }
    case 'config': return log(reconcile(state, { ...state, config: validateConfig(action.value) }), ['Validated configuration applied to running logic.']);
    case 'scenario': {
      const preset = SCENARIOS[action.name];
      if (!preset) return state;
      const base = initialState();
      return log(reconcile(base, { ...base, inputs: { ...DEFAULT_INPUTS, ...(preset.fault ? { pm25: 140, pm10: 280 } : {}), ...preset.inputs }, config: state.config, running: true, started: true, fault: preset.fault ?? 'none', strategy: preset.strategy ?? 'Hybrid' }), [`Scenario loaded: ${action.name}`]);
    }
  }
}
