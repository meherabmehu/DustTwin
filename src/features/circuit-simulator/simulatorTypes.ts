import type { RiskStatus } from '../simulation/simulationTypes';

export type ControlMode = 'auto' | 'manual';
export type RiskLevel = 'low' | 'moderate' | 'high' | 'LOW' | 'MODERATE' | 'HIGH' | 'VERY HIGH';
export type OutputName = 'pump' | 'fan';
export type SensorInputKey = 'dustIntensity' | 'pm1' | 'pm2' | 'temperature' | 'humidity' | 'windSpeed' | 'windDirection';
export type ZoneStates = [boolean, boolean, boolean, boolean]; // [Zone A (North), Zone B (East), Zone C (South), Zone D (West)]
export type LogLevel = 'info' | 'success' | 'warning';

export interface SerialEntry {
  id: number;
  elapsedSeconds: number;
  message: string;
  level: LogLevel;
}

export interface SimulatorState {
  /** Dust Source Intensity (0 - 100%) */
  dustIntensity: number;
  /** PM2.5 sensor 1 input, in µg/m³. */
  pm1: number;
  /** PM2.5 sensor 2 input, in µg/m³. */
  pm2: number;
  /** PM10 values are derived from each PM2.5 input using factor 1.65×. */
  pm10_1: number;
  pm10_2: number;
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  mode: ControlMode;
  /** Zone states corresponding to [Zone A (North), Zone B (East), Zone C (South), Zone D (West)] */
  zones: ZoneStates;
  pumpOn: boolean;
  fanOn: boolean;
  simulationRunning: boolean;
  elapsedSeconds: number;
  serialLogs: SerialEntry[];
  nextLogId: number;

  /** Combined multi-factor deterministic metrics aligned with Main Simulation rules */
  riskScore: number;
  riskStatus: RiskStatus;
  predictedDirection: string;
  flowPerZoneLpm: number;
  requiredFlowLpm: number;
  mistingDurationSeconds: number;
  projectedWaterL: number;
}

export type SimulatorAction =
  | { type: 'RUN' }
  | { type: 'STOP' }
  | { type: 'RESET' }
  | { type: 'CLEAR_LOGS' }
  | { type: 'TICK' }
  | { type: 'SET_MODE'; mode: ControlMode }
  | { type: 'SET_SENSOR'; key: SensorInputKey; value: number }
  | { type: 'SET_ZONE'; index: number; active: boolean }
  | { type: 'SET_ALL_ZONES'; active: boolean }
  | { type: 'SET_OUTPUT'; output: OutputName; active: boolean };
