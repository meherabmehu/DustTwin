import {
  AMBIENT_PM25_UG_M3,
  PM10_HIGH_THRESHOLD,
  PM10_MODERATE_THRESHOLD,
  PM10_TO_PM25_RATIO,
  PM10_VERY_HIGH_THRESHOLD,
  PM25_HIGH_THRESHOLD,
  PM25_MODERATE_THRESHOLD,
  PM25_VERY_HIGH_THRESHOLD,
  PROJECTION_HORIZON_SECONDS,
  RECOVERY_RATE_PER_SECOND,
  SUPPRESSION_RATE_PER_SECOND,
  SUPPRESSION_TARGET_FRACTION,
} from './simulationConfig';
import { getBoundaryModelFactors } from './plumeModel';
import { BOUNDARY_GEOMETRY } from './simulationConfig';
import type { BoundaryId, RiskStatus, SensorReading, SimulationInput } from './simulationTypes';

const round = (value: number) => Math.max(0, Math.round(value));
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function derivePm10(pm25: number): number {
  return round(pm25 * PM10_TO_PM25_RATIO);
}

export function getRiskStatus(pm25: number, pm10 = derivePm10(pm25)): RiskStatus {
  const pm25Status: RiskStatus = pm25 >= PM25_VERY_HIGH_THRESHOLD
    ? 'VERY HIGH'
    : pm25 >= PM25_HIGH_THRESHOLD
      ? 'HIGH'
      : pm25 >= PM25_MODERATE_THRESHOLD
        ? 'MODERATE'
        : 'LOW';
  const pm10Status: RiskStatus = pm10 >= PM10_VERY_HIGH_THRESHOLD
    ? 'VERY HIGH'
    : pm10 >= PM10_HIGH_THRESHOLD
      ? 'HIGH'
      : pm10 >= PM10_MODERATE_THRESHOLD
        ? 'MODERATE'
        : 'LOW';
  const rank: Record<RiskStatus, number> = { LOW: 0, MODERATE: 1, HIGH: 2, 'VERY HIGH': 3 };
  return rank[pm10Status] > rank[pm25Status] ? pm10Status : pm25Status;
}

export function getSensorBaseline(input: SimulationInput): Record<BoundaryId, number> {
  const sourceStrength = clamp(input.dustIntensity, 0, 100);
  const readings = {} as Record<BoundaryId, number>;

  for (const boundary of BOUNDARY_GEOMETRY) {
    const factors = getBoundaryModelFactors(input, boundary);
    const airborneSourceContribution = sourceStrength
      * factors.windFactor
      * factors.humidityFactor
      * factors.temperatureFactor
      * factors.distanceFactor
      * factors.directionalFactor;
    readings[boundary.id] = clamp(round(AMBIENT_PM25_UG_M3 + airborneSourceContribution), 0, 240);
  }

  return readings;
}

export function getSensorReadings(
  input: SimulationInput,
  currentPm25: Record<BoundaryId, number>,
  activeBoundaryIds: readonly BoundaryId[],
): SensorReading[] {
  const baseline = getSensorBaseline(input);
  const speed = clamp(input.windSpeed, 0, 10);
  const dust = clamp(input.dustIntensity, 0, 100);
  const humidity = clamp(input.humidity, 0, 100);
  const temperature = clamp(input.temperatureC, 10, 50);
  const forecastGrowth = clamp(
    1 + speed * 0.032 + dust * 0.0015 + Math.max(0, temperature - 25) * 0.001 - humidity * 0.0005,
    1,
    1.55,
  );
  const activeSet = new Set(activeBoundaryIds);

  return BOUNDARY_GEOMETRY.map((boundary) => {
    const factors = getBoundaryModelFactors(input, boundary);
    const livePm25 = clamp(currentPm25[boundary.id] ?? AMBIENT_PM25_UG_M3, 0, 240);
    const isMistingAtBoundary = activeSet.has(boundary.id);
    const responseTarget = baseline[boundary.id] * (isMistingAtBoundary ? SUPPRESSION_TARGET_FRACTION : 1);
    const responseRate = isMistingAtBoundary ? SUPPRESSION_RATE_PER_SECOND : RECOVERY_RATE_PER_SECOND;
    const projectedPm25 = clamp(
      responseTarget + (livePm25 - responseTarget) * Math.exp(-responseRate * PROJECTION_HORIZON_SECONDS),
      0,
      240,
    );
    const forecastPm25 = clamp(baseline[boundary.id] * forecastGrowth, 0, 300);
    const pm10 = derivePm10(livePm25);
    const projectedPm10 = derivePm10(projectedPm25);
    const forecastPm10 = derivePm10(forecastPm25);

    return {
      ...boundary,
      distanceM: factors.distanceM,
      alignment: factors.alignment,
      pm25: round(livePm25),
      pm10,
      status: getRiskStatus(livePm25, pm10),
      forecastPm25: round(forecastPm25),
      forecastPm10,
      forecastStatus: getRiskStatus(forecastPm25, forecastPm10),
      projectedPm25: round(projectedPm25),
      projectedPm10,
      baselinePm25: baseline[boundary.id],
      baselinePm10: derivePm10(baseline[boundary.id]),
    };
  });
}

export function createInitialReadings(input: SimulationInput): Record<BoundaryId, number> {
  const baseline = getSensorBaseline(input);
  return Object.fromEntries(BOUNDARY_GEOMETRY.map((boundary) => {
    // Start with a partial plume arrival so the live meters can visibly fall under prediction,
    // or rise until a reactive strategy detects a threshold crossing.
    const initial = AMBIENT_PM25_UG_M3 + (baseline[boundary.id] - AMBIENT_PM25_UG_M3) * 0.32;
    return [boundary.id, clamp(initial, 0, 240)];
  })) as Record<BoundaryId, number>;
}

export function advanceSensorReadings(
  input: SimulationInput,
  currentPm25: Record<BoundaryId, number>,
  activeBoundaryIds: readonly BoundaryId[],
  seconds = 1,
): Record<BoundaryId, number> {
  const baseline = getSensorBaseline(input);
  const activeSet = new Set(activeBoundaryIds);
  const safeSeconds = clamp(seconds, 0, 60);
  const next = {} as Record<BoundaryId, number>;

  for (const boundary of BOUNDARY_GEOMETRY) {
    const current = currentPm25[boundary.id] ?? AMBIENT_PM25_UG_M3;
    const isMisting = activeSet.has(boundary.id);
    const target = baseline[boundary.id] * (isMisting ? SUPPRESSION_TARGET_FRACTION : 1);
    const rate = isMisting ? SUPPRESSION_RATE_PER_SECOND : RECOVERY_RATE_PER_SECOND;
    const alpha = 1 - Math.exp(-rate * safeSeconds);
    next[boundary.id] = clamp(current + (target - current) * alpha, 0, 240);
  }

  return next;
}

export function getRiskBandThresholds() {
  return {
    pm25Moderate: PM25_MODERATE_THRESHOLD,
    pm25High: PM25_HIGH_THRESHOLD,
    pm25VeryHigh: PM25_VERY_HIGH_THRESHOLD,
    pm10Moderate: PM10_MODERATE_THRESHOLD,
    pm10High: PM10_HIGH_THRESHOLD,
    pm10VeryHigh: PM10_VERY_HIGH_THRESHOLD,
    pm10Ratio: PM10_TO_PM25_RATIO,
  };
}
