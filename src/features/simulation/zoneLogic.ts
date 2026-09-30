import { PM25_MODERATE_THRESHOLD, RISK_RANK, SENSOR_RELEASE_THRESHOLD_PM25, ZONE_TO_BOUNDARY } from './simulationConfig';
import { BOUNDARY_IDS, ZONE_IDS, type BoundaryId, type ControlStrategy, type RiskStatus, type SensorReading, type ZoneId } from './simulationTypes';

const boundaryNames: Record<BoundaryId, string> = {
  north: 'North',
  east: 'East',
  south: 'South',
  west: 'West',
};

export function getZonesForBoundaries(boundaries: readonly BoundaryId[]): ZoneId[] {
  const selected = new Set(boundaries.map((boundary) => {
    const zone = (Object.entries(ZONE_TO_BOUNDARY) as Array<[ZoneId, BoundaryId]>)
      .find(([, mappedBoundary]) => mappedBoundary === boundary)?.[0];
    return zone;
  }).filter((zone): zone is ZoneId => zone !== undefined));
  return ZONE_IDS.filter((zone) => selected.has(zone));
}

/**
 * Uses the four independently modeled forecast sensors. Diagonal plumes naturally select
 * both neighboring boundaries when both sensor forecasts cross the moderate threshold.
 */
export function getPredictedBoundaries(sensors: readonly SensorReading[]): BoundaryId[] {
  const forecastById = new Map(sensors.map((sensor) => [sensor.id, sensor]));
  const atRisk = BOUNDARY_IDS
    .map((id) => forecastById.get(id))
    .filter((sensor): sensor is SensorReading => Boolean(sensor && RISK_RANK[sensor.forecastStatus] >= RISK_RANK.MODERATE));

  if (!atRisk.length) return [];
  const highestForecast = Math.max(...atRisk.map((sensor) => sensor.forecastPm25));
  const relativeExposureFloor = highestForecast * 0.72;

  return BOUNDARY_IDS.filter((boundary) => {
    const sensor = forecastById.get(boundary);
    return Boolean(sensor && sensor.forecastPm25 >= relativeExposureFloor
      && RISK_RANK[sensor.forecastStatus] >= RISK_RANK.MODERATE);
  });
}

export function getPrimaryBoundary(sensors: readonly SensorReading[]): BoundaryId | null {
  if (!sensors.length) return null;
  return [...sensors].sort((a, b) => b.forecastPm25 - a.forecastPm25)[0].id;
}

export function getHighestRisk(readings: readonly SensorReading[], forecast = false): RiskStatus {
  if (!readings.length) return 'LOW';
  const value = readings.reduce<RiskStatus>((highest, sensor) => {
    const current = forecast ? sensor.forecastStatus : sensor.status;
    return RISK_RANK[current] > RISK_RANK[highest] ? current : highest;
  }, 'LOW');
  return value;
}

export function getZonesForStrategy(
  strategy: ControlStrategy,
  sensors: readonly SensorReading[],
  predictedBoundaries: readonly BoundaryId[],
): ZoneId[] {
  switch (strategy) {
    case 'continuous':
      return [...ZONE_IDS];
    case 'reactive':
      return getZonesForBoundaries(sensors.filter((sensor) => RISK_RANK[sensor.status] >= RISK_RANK.MODERATE).map((sensor) => sensor.id));
    case 'predictive':
      return getZonesForBoundaries(predictedBoundaries);
    case 'noControl':
    default:
      return [];
  }
}

export function getPredictiveZonesWithFeedback(
  predictedBoundaries: readonly BoundaryId[],
  currentPm25: Record<BoundaryId, number>,
  previouslyActiveZones: readonly ZoneId[],
  heldOffBoundaries: readonly BoundaryId[],
): { zoneIds: ZoneId[]; heldOffBoundaries: BoundaryId[] } {
  const candidateSet = new Set(predictedBoundaries);
  const nextHeldOff = new Set(heldOffBoundaries.filter((boundary) => candidateSet.has(boundary)));
  const previousActive = new Set(previouslyActiveZones);
  const selected = new Set<ZoneId>();

  for (const boundary of predictedBoundaries) {
    const zone = (Object.entries(ZONE_TO_BOUNDARY) as Array<[ZoneId, BoundaryId]>)
      .find(([, mappedBoundary]) => mappedBoundary === boundary)?.[0];
    if (!zone) continue;
    const current = currentPm25[boundary] ?? 0;

    if (nextHeldOff.has(boundary)) {
      if (current >= PM25_MODERATE_THRESHOLD) {
        nextHeldOff.delete(boundary);
        selected.add(zone);
      }
      continue;
    }

    if (previousActive.has(zone) && current <= SENSOR_RELEASE_THRESHOLD_PM25) {
      nextHeldOff.add(boundary);
      continue;
    }

    selected.add(zone);
  }

  return {
    zoneIds: ZONE_IDS.filter((zone) => selected.has(zone)),
    heldOffBoundaries: BOUNDARY_IDS.filter((boundary) => nextHeldOff.has(boundary)),
  };
}

export function formatBoundaryList(boundaries: readonly BoundaryId[]): string {
  return boundaries.map((boundary) => boundaryNames[boundary]).join(' / ');
}

export function getBoundaryName(boundary: BoundaryId): string {
  return boundaryNames[boundary];
}
