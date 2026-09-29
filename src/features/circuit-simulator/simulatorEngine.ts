import { SIMULATION_INPUT_LIMITS, SIMULATION_THRESHOLDS } from '../../config/simulationThresholds';
import { DEFAULT_SIMULATOR_INPUTS, SERIAL_LOG_LIMIT } from './simulatorConfig';
import type { LogLevel, RiskLevel, SensorInputKey, SimulatorAction, SimulatorState, ZoneStates } from './simulatorTypes';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function derivePm10(pm25: number): number {
  return Math.round(Math.max(0, pm25 * SIMULATION_THRESHOLDS.pm10Factor));
}

export function getRiskLevel(state: Pick<SimulatorState, 'pm1' | 'pm2'>): RiskLevel {
  const peak = Math.max(state.pm1, state.pm2);
  if (peak >= SIMULATION_THRESHOLDS.pm25High) return 'high';
  if (peak >= SIMULATION_THRESHOLDS.pm25Moderate) return 'moderate';
  return 'low';
}

export function formatElapsedTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remaining = safeSeconds % 60;
  return [hours, minutes, remaining].map((part) => String(part).padStart(2, '0')).join(':');
}

export function createInitialSimulatorState(): SimulatorState {
  return {
    ...DEFAULT_SIMULATOR_INPUTS,
    pm10_1: derivePm10(DEFAULT_SIMULATOR_INPUTS.pm1),
    pm10_2: derivePm10(DEFAULT_SIMULATOR_INPUTS.pm2),
    mode: 'auto',
    zones: [false, false, false, false],
    pumpOn: false,
    fanOn: false,
    simulationRunning: false,
    elapsedSeconds: 0,
    serialLogs: [],
    nextLogId: 1,
  };
}

function appendLogs(state: SimulatorState, entries: Array<{ message: string; level?: LogLevel }>): SimulatorState {
  if (!entries.length) return state;
  let nextId = state.nextLogId;
  const newLogs = entries.map((entry) => ({
    id: nextId++,
    elapsedSeconds: state.elapsedSeconds,
    message: entry.message,
    level: entry.level ?? 'info',
  }));
  return {
    ...state,
    serialLogs: [...state.serialLogs, ...newLogs].slice(-SERIAL_LOG_LIMIT),
    nextLogId: nextId,
  };
}

function calculateAutoOutputs(state: SimulatorState): Pick<SimulatorState, 'zones' | 'pumpOn' | 'fanOn'> {
  const zones: ZoneStates = [
    state.pm1 >= SIMULATION_THRESHOLDS.pm25Moderate,
    state.pm1 >= SIMULATION_THRESHOLDS.pm25High,
    state.pm2 >= SIMULATION_THRESHOLDS.pm25Moderate,
    state.pm2 >= SIMULATION_THRESHOLDS.pm25High,
  ];
  const anyZoneActive = zones.some(Boolean);
  return {
    zones,
    pumpOn: anyZoneActive,
    fanOn: Math.max(state.pm1, state.pm2) >= SIMULATION_THRESHOLDS.pm25High,
  };
}

function outputTransitionLogs(before: SimulatorState, after: SimulatorState): Array<{ message: string; level?: LogLevel }> {
  const entries: Array<{ message: string; level?: LogLevel }> = [];
  after.zones.forEach((active, index) => {
    if (active !== before.zones[index]) {
      entries.push({ message: `Relay ${index + 1} / Zone ${index + 1} ${active ? 'ON' : 'OFF'}`, level: active ? 'success' : 'info' });
    }
  });
  if (before.pumpOn !== after.pumpOn) entries.push({ message: `Water pump ${after.pumpOn ? 'ON' : 'OFF'}`, level: after.pumpOn ? 'success' : 'info' });
  if (before.fanOn !== after.fanOn) entries.push({ message: `Cooling fan ${after.fanOn ? 'ON' : 'OFF'}`, level: after.fanOn ? 'success' : 'info' });
  const beforeRisk = getRiskLevel(before);
  const afterRisk = getRiskLevel(after);
  if (beforeRisk !== afterRisk) entries.push({ message: `Air-quality risk changed to ${afterRisk.toUpperCase()}`, level: afterRisk === 'high' ? 'warning' : 'info' });
  return entries;
}

function commitOutputs(before: SimulatorState, candidate: SimulatorState, extraLogs: Array<{ message: string; level?: LogLevel }> = []): SimulatorState {
  const withAutoOutputs = candidate.mode === 'auto' && candidate.simulationRunning
    ? { ...candidate, ...calculateAutoOutputs(candidate) }
    : candidate;
  return appendLogs(withAutoOutputs, [...extraLogs, ...outputTransitionLogs(before, withAutoOutputs)]);
}

function sensorBounds(key: SensorInputKey): { min: number; max: number; step: number } {
  if (key === 'pm1' || key === 'pm2') return SIMULATION_INPUT_LIMITS.pm25;
  if (key === 'temperature') return SIMULATION_INPUT_LIMITS.temperature;
  if (key === 'humidity') return SIMULATION_INPUT_LIMITS.humidity;
  if (key === 'windSpeed') return SIMULATION_INPUT_LIMITS.windSpeed;
  return SIMULATION_INPUT_LIMITS.windDirection;
}

function sensorLabel(key: 'pm1' | 'pm2' | 'temperature' | 'humidity' | 'windSpeed' | 'windDirection') {
  const labels = {
    pm1: 'PM2.5 sensor 1',
    pm2: 'PM2.5 sensor 2',
    temperature: 'Temperature',
    humidity: 'Humidity',
    windSpeed: 'Wind speed',
    windDirection: 'Wind direction',
  };
  return labels[key];
}

export function simulatorReducer(state: SimulatorState, action: SimulatorAction): SimulatorState {
  switch (action.type) {
    case 'RUN': {
      if (state.simulationRunning) return state;
      const candidate = { ...state, simulationRunning: true };
      return commitOutputs(state, candidate, [{ message: 'DustTwin browser simulator started', level: 'success' }]);
    }
    case 'STOP': {
      const outputsActive = state.zones.some(Boolean) || state.pumpOn || state.fanOn;
      if (!state.simulationRunning && !outputsActive) return state;
      const stopped: SimulatorState = { ...state, simulationRunning: false, zones: [false, false, false, false], pumpOn: false, fanOn: false };
      return appendLogs(stopped, [
        { message: 'Simulation stopped; all relays and actuators de-energized', level: 'warning' },
        ...outputTransitionLogs(state, stopped),
      ]);
    }
    case 'RESET': {
      const initial = createInitialSimulatorState();
      return appendLogs(initial, [{ message: 'Simulation reset to default values', level: 'success' }]);
    }
    case 'TICK': {
      if (!state.simulationRunning) return state;
      const candidate = { ...state, elapsedSeconds: state.elapsedSeconds + 1 };
      const next = commitOutputs(state, candidate);
      if (next.elapsedSeconds % 5 !== 0) return next;
      return appendLogs(next, [
        { message: `PM 1: ${next.pm1} µg/m³ (derived PM10 ${next.pm10_1} µg/m³)` },
        { message: `PM 2: ${next.pm2} µg/m³ (derived PM10 ${next.pm10_2} µg/m³)` },
        { message: `DHT22: ${next.temperature.toFixed(1)} °C [${next.temperature >= SIMULATION_THRESHOLDS.temperatureWarningC ? 'HIGH' : 'OK'}], ${next.humidity}% RH [${next.humidity >= SIMULATION_THRESHOLDS.humidityWarningPercent ? 'HIGH' : 'OK'}]` },
        { message: `Wind input: ${next.windSpeed.toFixed(1)} m/s at ${next.windDirection}°` },
      ]);
    }
    case 'SET_MODE': {
      if (state.mode === action.mode) return state;
      const candidate = { ...state, mode: action.mode };
      return commitOutputs(state, candidate, [{ message: action.mode === 'auto' ? 'Automatic threshold control enabled' : 'Manual control enabled', level: 'success' }]);
    }
    case 'SET_SENSOR': {
      const bounds = sensorBounds(action.key);
      const value = clamp(action.value, bounds.min, bounds.max);
      const normalized = action.key === 'temperature' || action.key === 'windSpeed' ? Math.round(value * 10) / 10 : Math.round(value);
      if (state[action.key] === normalized) return state;
      const candidate: SimulatorState = {
        ...state,
        [action.key]: normalized,
        ...(action.key === 'pm1' ? { pm10_1: derivePm10(normalized) } : {}),
        ...(action.key === 'pm2' ? { pm10_2: derivePm10(normalized) } : {}),
      };
      const unit = action.key === 'temperature' ? ' °C' : action.key === 'humidity' ? '% RH' : action.key === 'windSpeed' ? ' m/s' : action.key === 'windDirection' ? '°' : ' µg/m³';
      return commitOutputs(state, candidate, [{ message: `${sensorLabel(action.key)} set to ${normalized}${unit}` }]);
    }
    case 'SET_ZONE': {
      if (state.mode !== 'manual' || action.index < 0 || action.index > 3) return state;
      const zones = [...state.zones] as ZoneStates;
      zones[action.index] = action.active;
      if (zones[action.index] === state.zones[action.index]) return state;
      return commitOutputs(state, { ...state, zones }, [{ message: `Manual Zone ${action.index + 1} set ${action.active ? 'ON' : 'OFF'}` }]);
    }
    case 'SET_ALL_ZONES': {
      if (state.mode !== 'manual') return state;
      const zones: ZoneStates = [action.active, action.active, action.active, action.active];
      if (zones.every((zone, index) => zone === state.zones[index])) return state;
      return commitOutputs(state, { ...state, zones }, [{ message: `All manual zones set ${action.active ? 'ON' : 'OFF'}` }]);
    }
    case 'SET_OUTPUT': {
      if (state.mode !== 'manual') return state;
      const key = action.output === 'pump' ? 'pumpOn' : 'fanOn';
      if (state[key] === action.active) return state;
      return commitOutputs(state, { ...state, [key]: action.active }, [{ message: `Manual ${action.output} set ${action.active ? 'ON' : 'OFF'}` }]);
    }
    default:
      return state;
  }
}
