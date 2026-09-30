import { SIMULATION_INPUT_LIMITS, SIMULATION_THRESHOLDS } from '../../config/simulationThresholds';
import { DEFAULT_SIMULATOR_INPUTS, SERIAL_LOG_LIMIT } from './simulatorConfig';
import { calculateCombinedRisk, classifyRisk } from '../simulation/riskModel';
import {
  calculateFlowRateLpm,
  calculateWaterUseL,
  estimateMistingDurationSeconds,
  getRequiredFlowPerZone,
} from '../simulation/waterModel';
import type { LogLevel, RiskLevel, SensorInputKey, SimulatorAction, SimulatorState, ZoneStates } from './simulatorTypes';
import type { RiskStatus } from '../simulation/simulationTypes';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function derivePm10(pm25: number): number {
  return Math.round(Math.max(0, pm25 * SIMULATION_THRESHOLDS.pm10Factor));
}

/**
 * Normalizes degrees to [0, 360) range.
 */
function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/**
 * Determines directional zone mapping from wind direction:
 * North (0°) -> Zone A
 * East (90°) -> Zone B
 * South (180°) -> Zone C
 * West (270°) -> Zone D
 * Diagonal winds activate both neighboring boundary zones:
 * NE (45°) -> Zone A + Zone B
 * SE (135°) -> Zone B + Zone C
 * SW (225°) -> Zone C + Zone D
 * NW (315°) -> Zone D + Zone A
 */
export function getDirectionalZones(windDirection: number): ZoneStates {
  const norm = normalizeDegrees(windDirection);
  // Sector checks around 45° intervals with +/- 22.5° tolerance
  if (norm >= 337.5 || norm < 22.5) {
    return [true, false, false, false]; // North -> Zone A
  }
  if (norm >= 22.5 && norm < 67.5) {
    return [true, true, false, false]; // NE -> Zone A + Zone B
  }
  if (norm >= 67.5 && norm < 112.5) {
    return [false, true, false, false]; // East -> Zone B
  }
  if (norm >= 112.5 && norm < 157.5) {
    return [false, true, true, false]; // SE -> Zone B + Zone C
  }
  if (norm >= 157.5 && norm < 202.5) {
    return [false, false, true, false]; // South -> Zone C
  }
  if (norm >= 202.5 && norm < 247.5) {
    return [false, false, true, true]; // SW -> Zone C + Zone D
  }
  if (norm >= 247.5 && norm < 292.5) {
    return [false, false, false, true]; // West -> Zone D
  }
  // 292.5 to 337.5: NW -> Zone D + Zone A
  return [true, false, false, true];
}

export function getPredictedDirectionLabel(windDirection: number): string {
  const norm = normalizeDegrees(windDirection);
  if (norm >= 337.5 || norm < 22.5) return 'North';
  if (norm >= 22.5 && norm < 67.5) return 'North / East';
  if (norm >= 67.5 && norm < 112.5) return 'East';
  if (norm >= 112.5 && norm < 157.5) return 'South / East';
  if (norm >= 157.5 && norm < 202.5) return 'South';
  if (norm >= 202.5 && norm < 247.5) return 'South / West';
  if (norm >= 247.5 && norm < 292.5) return 'West';
  return 'North / West';
}

export { classifyRisk };

/**
 * Reuses the same transparent combined weighted risk model as Main Simulation.
 * Combines dust source (30%), wind exposure (20%), boundary PM (35%), humidity (10%), temperature (5%).
 */
export function calculateCircuitRisk(
  state: Pick<SimulatorState, 'dustIntensity' | 'pm1' | 'pm2' | 'temperature' | 'humidity' | 'windSpeed' | 'windDirection'>,
) {
  const peakBoundaryPm25 = Math.max(state.pm1, state.pm2);
  return calculateCombinedRisk(
    {
      dustIntensity: state.dustIntensity,
      windSpeed: state.windSpeed,
      windDirection: state.windDirection,
      humidity: state.humidity,
      temperatureC: state.temperature,
    },
    peakBoundaryPm25,
  );
}

export function getRiskLevel(
  state: Pick<SimulatorState, 'dustIntensity' | 'pm1' | 'pm2' | 'temperature' | 'humidity' | 'windSpeed' | 'windDirection'> | Pick<SimulatorState, 'pm1' | 'pm2'>,
): RiskStatus {
  const fullState = {
    dustIntensity: ('dustIntensity' in state && typeof state.dustIntensity === 'number') ? state.dustIntensity : DEFAULT_SIMULATOR_INPUTS.dustIntensity,
    pm1: state.pm1,
    pm2: state.pm2,
    temperature: ('temperature' in state && typeof state.temperature === 'number') ? state.temperature : DEFAULT_SIMULATOR_INPUTS.temperature,
    humidity: ('humidity' in state && typeof state.humidity === 'number') ? state.humidity : DEFAULT_SIMULATOR_INPUTS.humidity,
    windSpeed: ('windSpeed' in state && typeof state.windSpeed === 'number') ? state.windSpeed : DEFAULT_SIMULATOR_INPUTS.windSpeed,
    windDirection: ('windDirection' in state && typeof state.windDirection === 'number') ? state.windDirection : DEFAULT_SIMULATOR_INPUTS.windDirection,
  };
  const breakdown = calculateCircuitRisk(fullState);
  return breakdown.status;
}

export function formatElapsedTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remaining = safeSeconds % 60;
  return [hours, minutes, remaining].map((part) => String(part).padStart(2, '0')).join(':');
}

export function createInitialSimulatorState(): SimulatorState {
  const initial = {
    ...DEFAULT_SIMULATOR_INPUTS,
    pm10_1: derivePm10(DEFAULT_SIMULATOR_INPUTS.pm1),
    pm10_2: derivePm10(DEFAULT_SIMULATOR_INPUTS.pm2),
    mode: 'auto' as const,
    zones: [false, false, false, false] as ZoneStates,
    pumpOn: false,
    fanOn: false,
    simulationRunning: false,
    elapsedSeconds: 0,
    serialLogs: [],
    nextLogId: 1,
    riskScore: 0,
    riskStatus: 'LOW' as RiskStatus,
    predictedDirection: 'North / West',
    flowPerZoneLpm: 0,
    requiredFlowLpm: 0,
    mistingDurationSeconds: 0,
    projectedWaterL: 0,
  };

  const risk = calculateCircuitRisk(initial);
  initial.riskScore = risk.score;
  initial.riskStatus = risk.status;
  initial.predictedDirection = getPredictedDirectionLabel(initial.windDirection);
  return initial;
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

/**
 * Calculates deterministic outputs based on the shared Main Simulation rules.
 */
function calculateAutoOutputs(state: SimulatorState): Pick<
  SimulatorState,
  'zones' | 'pumpOn' | 'fanOn' | 'riskScore' | 'riskStatus' | 'predictedDirection' | 'flowPerZoneLpm' | 'requiredFlowLpm' | 'mistingDurationSeconds' | 'projectedWaterL'
> {
  const risk = calculateCircuitRisk(state);
  const predictedDirection = getPredictedDirectionLabel(state.windDirection);
  const peakPm = Math.max(state.pm1, state.pm2);

  if (risk.status === 'LOW') {
    return {
      zones: [false, false, false, false],
      pumpOn: false,
      fanOn: false,
      riskScore: risk.score,
      riskStatus: risk.status,
      predictedDirection,
      flowPerZoneLpm: 0,
      requiredFlowLpm: 0,
      mistingDurationSeconds: 0,
      projectedWaterL: 0,
    };
  }

  // Active risk: determine zone states from wind direction
  const zones = getDirectionalZones(state.windDirection);
  const activeCount = zones.filter(Boolean).length;
  const flowPerZoneLpm = getRequiredFlowPerZone(risk.status);
  const requiredFlowLpm = calculateFlowRateLpm(activeCount, flowPerZoneLpm);
  const mistingDurationSeconds = estimateMistingDurationSeconds(risk.status, peakPm, state.dustIntensity);
  const projectedWaterL = calculateWaterUseL(activeCount, mistingDurationSeconds, flowPerZoneLpm);
  const pumpOn = activeCount > 0;
  const fanOn = state.temperature >= SIMULATION_THRESHOLDS.temperatureWarningC;

  return {
    zones,
    pumpOn,
    fanOn,
    riskScore: risk.score,
    riskStatus: risk.status,
    predictedDirection,
    flowPerZoneLpm,
    requiredFlowLpm,
    mistingDurationSeconds,
    projectedWaterL,
  };
}

function calculateManualDerivedMetrics(state: SimulatorState): Pick<
  SimulatorState,
  'riskScore' | 'riskStatus' | 'predictedDirection' | 'flowPerZoneLpm' | 'requiredFlowLpm' | 'mistingDurationSeconds' | 'projectedWaterL'
> {
  const risk = calculateCircuitRisk(state);
  const predictedDirection = getPredictedDirectionLabel(state.windDirection);
  const activeCount = state.zones.filter(Boolean).length;
  const peakPm = Math.max(state.pm1, state.pm2);

  if (state.pumpOn && activeCount > 0) {
    const flowPerZoneLpm = getRequiredFlowPerZone(risk.status) || 0.50;
    const requiredFlowLpm = calculateFlowRateLpm(activeCount, flowPerZoneLpm);
    const mistingDurationSeconds = estimateMistingDurationSeconds(risk.status, peakPm, state.dustIntensity) || 30;
    const projectedWaterL = calculateWaterUseL(activeCount, mistingDurationSeconds, flowPerZoneLpm);
    return {
      riskScore: risk.score,
      riskStatus: risk.status,
      predictedDirection,
      flowPerZoneLpm,
      requiredFlowLpm,
      mistingDurationSeconds,
      projectedWaterL,
    };
  }

  return {
    riskScore: risk.score,
    riskStatus: risk.status,
    predictedDirection,
    flowPerZoneLpm: 0,
    requiredFlowLpm: 0,
    mistingDurationSeconds: 0,
    projectedWaterL: 0,
  };
}

const ZONE_LETTERS = ['Zone A (North)', 'Zone B (East)', 'Zone C (South)', 'Zone D (West)'];

function outputTransitionLogs(before: SimulatorState, after: SimulatorState): Array<{ message: string; level?: LogLevel }> {
  const entries: Array<{ message: string; level?: LogLevel }> = [];
  after.zones.forEach((active, index) => {
    if (active !== before.zones[index]) {
      entries.push({
        message: `Relay ${index + 1} / ${ZONE_LETTERS[index]} ${active ? 'ACTIVE' : 'STANDBY'}`,
        level: active ? 'success' : 'info',
      });
    }
  });
  if (before.pumpOn !== after.pumpOn) {
    entries.push({ message: `Water pump ${after.pumpOn ? 'ON' : 'OFF'}`, level: after.pumpOn ? 'success' : 'info' });
  }
  if (before.fanOn !== after.fanOn) {
    entries.push({ message: `Cooling fan ${after.fanOn ? 'ON' : 'OFF'}`, level: after.fanOn ? 'success' : 'info' });
  }
  if (before.riskStatus !== after.riskStatus) {
    entries.push({
      message: `Air-quality risk level updated to ${after.riskStatus} (Score ${after.riskScore}/100)`,
      level: after.riskStatus === 'HIGH' || after.riskStatus === 'VERY HIGH' ? 'warning' : 'info',
    });
  }
  return entries;
}

function buildScenarioExecutionLog(state: SimulatorState): Array<{ message: string; level?: LogLevel }> {
  const activeZoneNames = state.zones
    .map((active, index) => (active ? `Zone ${['A', 'B', 'C', 'D'][index]}` : null))
    .filter(Boolean) as string[];
  const activeZonesSummary = activeZoneNames.length ? activeZoneNames.join(' + ') : 'None (Standby)';

  return [
    { message: `[READY] DustTwin Circuit Scenario · ${state.mode === 'auto' ? 'AUTO' : 'MANUAL'}`, level: 'info' },
    { message: `Dust Source: ${state.dustIntensity}%`, level: 'info' },
    { message: `PM Sensor 1: ${state.pm1} µg/m³ · PM Sensor 2: ${state.pm2} µg/m³`, level: 'info' },
    { message: `Temperature: ${state.temperature.toFixed(1)} °C · Humidity: ${state.humidity}% RH`, level: 'info' },
    { message: `Wind: ${state.predictedDirection} (${state.windDirection}°) ${state.windSpeed.toFixed(1)} m/s`, level: 'info' },
    { message: `Risk Score: ${state.riskScore}/100 · Risk Level: ${state.riskStatus}`, level: state.riskStatus === 'HIGH' || state.riskStatus === 'VERY HIGH' ? 'warning' : 'info' },
    { message: `Predicted Direction: ${state.predictedDirection}`, level: 'info' },
    { message: `Zone A: ${state.zones[0] ? 'ACTIVE' : 'STANDBY'} · Zone B: ${state.zones[1] ? 'ACTIVE' : 'STANDBY'} · Zone C: ${state.zones[2] ? 'ACTIVE' : 'STANDBY'} · Zone D: ${state.zones[3] ? 'ACTIVE' : 'STANDBY'}`, level: state.zones.some(Boolean) ? 'success' : 'info' },
    { message: `Action: ${state.riskStatus}, ${activeZonesSummary}, Pump ${state.pumpOn ? 'ON' : 'OFF'}, Flow ${state.requiredFlowLpm.toFixed(2)} L/min`, level: state.pumpOn ? 'success' : 'info' },
    { message: `Required Flow: ${state.requiredFlowLpm.toFixed(2)} L/min · Projected Water Use: ${state.projectedWaterL.toFixed(2)} L · Misting Duration: ${state.mistingDurationSeconds} sec`, level: 'info' },
    { message: `Pump: ${state.pumpOn ? 'ON' : 'OFF'}`, level: state.pumpOn ? 'success' : 'info' },
  ];
}

function commitOutputs(
  before: SimulatorState,
  candidate: SimulatorState,
  extraLogs: Array<{ message: string; level?: LogLevel }> = [],
): SimulatorState {
  let updatedState = candidate;
  if (candidate.mode === 'auto' && candidate.simulationRunning) {
    updatedState = { ...candidate, ...calculateAutoOutputs(candidate) };
  } else if (candidate.mode === 'manual') {
    updatedState = { ...candidate, ...calculateManualDerivedMetrics(candidate) };
  } else {
    const risk = calculateCircuitRisk(candidate);
    updatedState = {
      ...candidate,
      riskScore: risk.score,
      riskStatus: risk.status,
      predictedDirection: getPredictedDirectionLabel(candidate.windDirection),
    };
  }

  return appendLogs(updatedState, [...extraLogs, ...outputTransitionLogs(before, updatedState)]);
}

function sensorBounds(key: SensorInputKey): { min: number; max: number; step: number } {
  if (key === 'dustIntensity') return SIMULATION_INPUT_LIMITS.dustIntensity;
  if (key === 'pm1' || key === 'pm2') return SIMULATION_INPUT_LIMITS.pm25;
  if (key === 'temperature') return SIMULATION_INPUT_LIMITS.temperature;
  if (key === 'humidity') return SIMULATION_INPUT_LIMITS.humidity;
  if (key === 'windSpeed') return SIMULATION_INPUT_LIMITS.windSpeed;
  return SIMULATION_INPUT_LIMITS.windDirection;
}

function sensorLabel(key: SensorInputKey) {
  const labels: Record<SensorInputKey, string> = {
    dustIntensity: 'Dust source intensity',
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
      const calculated = commitOutputs(state, candidate);
      return appendLogs(calculated, buildScenarioExecutionLog(calculated));
    }
    case 'STOP': {
      const outputsActive = state.zones.some(Boolean) || state.pumpOn || state.fanOn;
      if (!state.simulationRunning && !outputsActive) return state;
      const stopped: SimulatorState = {
        ...state,
        simulationRunning: false,
        zones: [false, false, false, false],
        pumpOn: false,
        fanOn: false,
        requiredFlowLpm: 0,
        flowPerZoneLpm: 0,
        projectedWaterL: 0,
        mistingDurationSeconds: 0,
      };
      return appendLogs(stopped, [
        { message: 'Simulation stopped; all relays, valves and actuators de-energized', level: 'warning' },
        ...outputTransitionLogs(state, stopped),
      ]);
    }
    case 'RESET': {
      const initial = createInitialSimulatorState();
      return appendLogs(initial, [{ message: 'Simulation reset to default values', level: 'success' }]);
    }
    case 'CLEAR_LOGS':
      return state.serialLogs.length ? { ...state, serialLogs: [] } : state;
    case 'TICK': {
      if (!state.simulationRunning) return state;
      const candidate = { ...state, elapsedSeconds: state.elapsedSeconds + 1 };
      const next = commitOutputs(state, candidate);
      if (next.elapsedSeconds % 5 !== 0) return next;
      return appendLogs(next, [
        { message: `PM 1: ${next.pm1} µg/m³ (derived PM10 ${next.pm10_1} µg/m³)` },
        { message: `PM 2: ${next.pm2} µg/m³ (derived PM10 ${next.pm10_2} µg/m³)` },
        { message: `DHT22: ${next.temperature.toFixed(1)} °C [${next.temperature >= SIMULATION_THRESHOLDS.temperatureWarningC ? 'HIGH' : 'OK'}], ${next.humidity}% RH [${next.humidity >= SIMULATION_THRESHOLDS.humidityWarningPercent ? 'HIGH' : 'OK'}]` },
        { message: `Wind: ${next.windSpeed.toFixed(1)} m/s at ${next.windDirection}° (${next.predictedDirection}) · Flow: ${next.requiredFlowLpm.toFixed(2)} L/min` },
      ]);
    }
    case 'SET_MODE': {
      if (state.mode === action.mode) return state;
      const candidate = { ...state, mode: action.mode };
      return commitOutputs(state, candidate, [
        { message: action.mode === 'auto' ? 'Automatic multi-factor decision control enabled' : 'Manual hardware override enabled', level: 'success' },
      ]);
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
      const unit = action.key === 'temperature' ? ' °C' : action.key === 'humidity' ? '% RH' : action.key === 'windSpeed' ? ' m/s' : action.key === 'windDirection' ? '°' : action.key === 'dustIntensity' ? '%' : ' µg/m³';
      return commitOutputs(state, candidate, [{ message: `${sensorLabel(action.key)} set to ${normalized}${unit}` }]);
    }
    case 'SET_ZONE': {
      if (state.mode !== 'manual' || action.index < 0 || action.index > 3) return state;
      const zones = [...state.zones] as ZoneStates;
      zones[action.index] = action.active;
      if (zones[action.index] === state.zones[action.index]) return state;
      return commitOutputs(state, { ...state, zones }, [
        { message: `Manual ${ZONE_LETTERS[action.index]} set ${action.active ? 'ACTIVE' : 'STANDBY'}` },
      ]);
    }
    case 'SET_ALL_ZONES': {
      if (state.mode !== 'manual') return state;
      const zones: ZoneStates = [action.active, action.active, action.active, action.active];
      if (zones.every((zone, index) => zone === state.zones[index])) return state;
      return commitOutputs(state, { ...state, zones }, [
        { message: `All manual zones set ${action.active ? 'ACTIVE' : 'STANDBY'}` },
      ]);
    }
    case 'SET_OUTPUT': {
      if (state.mode !== 'manual') return state;
      const key = action.output === 'pump' ? 'pumpOn' : 'fanOn';
      if (state[key] === action.active) return state;
      return commitOutputs(state, { ...state, [key]: action.active }, [
        { message: `Manual ${action.output} set ${action.active ? 'ON' : 'OFF'}` },
      ]);
    }
    default:
      return state;
  }
}
