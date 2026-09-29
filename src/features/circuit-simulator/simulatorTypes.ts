export type ControlMode = 'auto' | 'manual';
export type RiskLevel = 'low' | 'moderate' | 'high';
export type OutputName = 'pump' | 'fan';
export type SensorInputKey = 'pm1' | 'pm2' | 'temperature' | 'humidity' | 'windSpeed' | 'windDirection';
export type ZoneStates = [boolean, boolean, boolean, boolean];
export type LogLevel = 'info' | 'success' | 'warning';

export interface SerialEntry {
  id: number;
  elapsedSeconds: number;
  message: string;
  level: LogLevel;
}

export interface SimulatorState {
  /** PM2.5 sensor 1 input, in µg/m³. */
  pm1: number;
  /** PM2.5 sensor 2 input, in µg/m³. */
  pm2: number;
  /** PM10 values are derived from each PM2.5 input; they are not independent controls. */
  pm10_1: number;
  pm10_2: number;
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  mode: ControlMode;
  zones: ZoneStates;
  pumpOn: boolean;
  fanOn: boolean;
  simulationRunning: boolean;
  elapsedSeconds: number;
  serialLogs: SerialEntry[];
  nextLogId: number;
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
