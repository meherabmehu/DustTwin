import { BOUNDARY_GEOMETRY, SITE_GEOMETRY } from './simulationConfig';
import type { BoundaryGeometry, SimulationInput } from './simulationTypes';
import type { PlumeEstimate } from './simulationTypes';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function normalizeBearing(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

export function getBoundaryDistanceM(boundary: BoundaryGeometry): number {
  const dx = (boundary.x - SITE_GEOMETRY.source.x) * SITE_GEOMETRY.widthM;
  const dy = (boundary.y - SITE_GEOMETRY.source.y) * SITE_GEOMETRY.heightM;
  return Math.hypot(dx, dy);
}

/**
 * Cosine alignment between the input plume-travel vector and a sensor's source-to-boundary vector.
 * This lets diagonal winds expose both neighboring boundary sensors instead of rounding to one.
 */
export function getDirectionalAlignment(boundary: BoundaryGeometry, bearingDeg: number): number {
  const dx = (boundary.x - SITE_GEOMETRY.source.x) * SITE_GEOMETRY.widthM;
  const dy = (boundary.y - SITE_GEOMETRY.source.y) * SITE_GEOMETRY.heightM;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const radians = (normalizeBearing(bearingDeg) * Math.PI) / 180;
  const windX = Math.sin(radians);
  const windY = -Math.cos(radians);
  return clamp((dx * windX + dy * windY) / distance, -1, 1);
}

export function getPlumeEstimate(input: SimulationInput): PlumeEstimate {
  const windSpeed = clamp(input.windSpeed, 0, 10);
  const dustIntensity = clamp(input.dustIntensity, 0, 100);
  const humidity = clamp(input.humidity, 0, 100);
  const temperature = clamp(input.temperatureC, 10, 50);
  const temperatureLift = Math.max(0, temperature - 25) * 0.002;
  const speedFactor = clamp(0.88 + windSpeed * 0.045 + temperatureLift - humidity * 0.0007, 0.72, 1.5);
  const effectiveVelocityMps = Math.max(0.2, (0.25 + windSpeed * 0.18 + dustIntensity * 0.002) * speedFactor);
  const length = clamp(70 + windSpeed * 10 + dustIntensity * 0.82 - humidity * 0.16, 58, 300);
  const spread = clamp(12 + humidity * 0.075 + (10 - windSpeed) * 0.38, 11, 25);
  const density = clamp(
    dustIntensity / 100 * 0.78 + windSpeed / 10 * 0.18 + (100 - humidity) / 100 * 0.08,
    0.04,
    1,
  );

  return {
    bearingDeg: normalizeBearing(input.windDirection),
    length,
    spread,
    density,
    speedFactor,
    effectiveVelocityMps,
  };
}

export function getBoundaryModelFactors(input: SimulationInput, boundary: BoundaryGeometry) {
  const bearing = normalizeBearing(input.windDirection);
  const alignment = getDirectionalAlignment(boundary, bearing);
  // A small crosswind floor represents measured background dispersion; downwind alignment dominates.
  const directionalFactor = 0.14 + 0.86 * Math.pow(Math.max(0, alignment), 2);
  const distanceM = getBoundaryDistanceM(boundary);
  const distanceFactor = 1 / (1 + distanceM / 230);
  const windFactor = 0.72 + clamp(input.windSpeed, 0, 10) * 0.055;
  const humidityFactor = 1.12 - clamp(input.humidity, 0, 100) * 0.0028;
  const temperatureFactor = 1 + (clamp(input.temperatureC, 10, 50) - 25) * 0.0025;

  return { alignment, distanceM, directionalFactor, distanceFactor, windFactor, humidityFactor, temperatureFactor };
}

export function getBoundaryGeometries(): readonly BoundaryGeometry[] {
  return BOUNDARY_GEOMETRY;
}
