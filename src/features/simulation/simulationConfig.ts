import type { BoundaryGeometry, BoundaryId, ControlStrategy, RiskStatus, ZoneId } from './simulationTypes';

export const AMBIENT_PM25_UG_M3 = 8;
export const PM10_TO_PM25_RATIO = 1.65;
export const PM25_MODERATE_THRESHOLD = 40;
export const PM25_HIGH_THRESHOLD = 75;
export const PM25_VERY_HIGH_THRESHOLD = 150;
export const PM10_MODERATE_THRESHOLD = Math.round(PM25_MODERATE_THRESHOLD * PM10_TO_PM25_RATIO);
export const PM10_HIGH_THRESHOLD = Math.round(PM25_HIGH_THRESHOLD * PM10_TO_PM25_RATIO);
export const PM10_VERY_HIGH_THRESHOLD = Math.round(PM25_VERY_HIGH_THRESHOLD * PM10_TO_PM25_RATIO);
export const SENSOR_RELEASE_THRESHOLD_PM25 = 32;
export const SIMULATION_STEP_SECONDS = 1;
export const SUPPRESSION_TARGET_FRACTION = 0.34;
export const SUPPRESSION_RATE_PER_SECOND = 0.085;
export const RECOVERY_RATE_PER_SECOND = 0.09;
export const PROJECTION_HORIZON_SECONDS = 30;
export const REACTIVE_DETECTION_DELAY_MINUTES = 0.75;

export const SITE_GEOMETRY = Object.freeze({
  widthM: 120,
  heightM: 80,
  source: Object.freeze({ x: 0.47, y: 0.53 }),
});

export const BOUNDARY_GEOMETRY: readonly BoundaryGeometry[] = Object.freeze([
  { id: 'north', label: 'North', sensorName: 'Sensor N', zoneId: 'A', x: 0.5, y: 0.12 },
  { id: 'east', label: 'East', sensorName: 'Sensor E', zoneId: 'B', x: 0.85, y: 0.5 },
  { id: 'south', label: 'South', sensorName: 'Sensor S', zoneId: 'C', x: 0.5, y: 0.88 },
  { id: 'west', label: 'West', sensorName: 'Sensor W', zoneId: 'D', x: 0.15, y: 0.5 },
]);

export const ZONE_TO_BOUNDARY: Readonly<Record<ZoneId, BoundaryId>> = Object.freeze({
  A: 'north',
  B: 'east',
  C: 'south',
  D: 'west',
});

export const STRATEGY_LABELS: Readonly<Record<ControlStrategy, string>> = Object.freeze({
  noControl: 'No Control',
  continuous: 'Continuous',
  reactive: 'Reactive',
  predictive: 'DustTwin Predictive',
});

export const RISK_RANK: Readonly<Record<RiskStatus, number>> = Object.freeze({
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
  'VERY HIGH': 3,
});

