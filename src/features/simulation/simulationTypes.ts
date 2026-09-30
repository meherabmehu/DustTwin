export const BOUNDARY_IDS = ['north', 'east', 'south', 'west'] as const;
export type BoundaryId = (typeof BOUNDARY_IDS)[number];

export const ZONE_IDS = ['A', 'B', 'C', 'D'] as const;
export type ZoneId = (typeof ZONE_IDS)[number];

export type RiskStatus = 'LOW' | 'MODERATE' | 'HIGH' | 'VERY HIGH';
export type ControlStrategy = 'noControl' | 'continuous' | 'reactive' | 'predictive';
export type PollutantView = 'combined' | 'pm25' | 'pm10';

/** Environmental values used by the deterministic, site-level scenario model. */
export interface SimulationInput {
  dustIntensity: number;
  windSpeed: number;
  /** Compass bearing the plume travels toward: 0° = North, 90° = East. */
  windDirection: number;
  humidity: number;
  temperatureC: number;
}

export interface BoundaryGeometry {
  id: BoundaryId;
  label: string;
  sensorName: string;
  zoneId: ZoneId;
  /** Sensor location in the map's normalized 0–1 coordinates. */
  x: number;
  y: number;
}

export interface SensorReading extends BoundaryGeometry {
  distanceM: number;
  alignment: number;
  /** Live simulated PM reading, which changes gradually as misting runs. */
  pm25: number;
  pm10: number;
  status: RiskStatus;
  /** Untreated near-term boundary forecast from the plume/sensor model. */
  forecastPm25: number;
  forecastPm10: number;
  forecastStatus: RiskStatus;
  /** Thirty-second projection under the currently selected control response. */
  projectedPm25: number;
  projectedPm10: number;
  baselinePm25: number;
  baselinePm10: number;
}

export interface PlumeEstimate {
  bearingDeg: number;
  /** A deterministic visual length in map viewBox units. */
  length: number;
  spread: number;
  density: number;
  speedFactor: number;
  effectiveVelocityMps: number;
}

export interface SimulationPrediction {
  input: SimulationInput;
  strategy: ControlStrategy;
  running: boolean;
  sensors: SensorReading[];
  plume: PlumeEstimate;
  risk: RiskStatus;
  currentRisk: RiskStatus;
  riskIndex: number;
  predictedBoundaries: BoundaryId[];
  predictedEscapeBoundary: string;
  primaryBoundary: BoundaryId | null;
  predictedZoneIds: ZoneId[];
  activeZoneIds: ZoneId[];
  projectedPm25: number;
  projectedPm10: number;
  baselinePm25: number;
  baselinePm10: number;
  currentBoundaryPm25: number;
  currentBoundaryPm10: number;
  leadTimeSeconds: number | null;
  waterUsedL: number;
  flowRateLpm: number;
  activeNozzles: number;
  elapsedSeconds: number;
  mistingSeconds: number;
  decision: string;
  decisionReasons: string[];
  chart: Array<{ time: string; twin: number; baseline: number }>;
}

export interface SimulationRunState {
  running: boolean;
  elapsedSeconds: number;
  mistingSeconds: number;
  waterUsedL: number;
  currentPm25: Record<BoundaryId, number>;
}

export interface StrategyComparisonResult {
  strategy: ControlStrategy;
  label: string;
  boundaryPm25: number;
  boundaryPm10: number;
  exceedanceMinutes: number;
  waterUsedL: number;
  activeZones: number;
  activeMinutes: number;
}
