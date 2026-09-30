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
  const temperatureLift = Math.max(0, temperature - 28) * 0.002;
  const speedFactor = clamp(0.85 + windSpeed * 0.05 + temperatureLift - humidity * 0.0006, 0.70, 1.55);
  // Plume transport speed is directly proportional to wind speed
  const effectiveVelocityMps = Math.max(0.25, (0.20 + windSpeed * 0.26 + dustIntensity * 0.002) * speedFactor);
  const length = clamp(60 + windSpeed * 12 + dustIntensity * 0.85 - humidity * 0.15, 55, 300);
  const spread = clamp(12 + humidity * 0.07 + (10 - windSpeed) * 0.38, 11, 26);
  const density = clamp(
    (dustIntensity / 100) * 0.78 + (windSpeed / 10) * 0.18 + ((100 - humidity) / 100) * 0.08,
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
  // Crosswind background floor represents atmospheric dispersion; downwind alignment dominates
  const directionalFactor = 0.14 + 0.86 * Math.pow(Math.max(0, alignment), 2);
  const distanceM = getBoundaryDistanceM(boundary);
  const distanceFactor = 1 / (1 + distanceM / 230);
  // Wind speed drives transport to boundary: at low wind (1 m/s), transport is weak; at high wind, transport is strong
  const windFactor = 0.46 + clamp(input.windSpeed, 0, 10) * 0.095;
  // Humidity slightly enhances particle settling (secondary modifier)
  const humidityFactor = 1.08 - clamp(input.humidity, 0, 100) * 0.0022;
  // Temperature is a subtle dispersion modifier around 28°C baseline
  const temperatureFactor = 1 + (clamp(input.temperatureC, 10, 50) - 28) * 0.005;

  return { alignment, distanceM, directionalFactor, distanceFactor, windFactor, humidityFactor, temperatureFactor };
}

export function getBoundaryGeometries(): readonly BoundaryGeometry[] {
  return BOUNDARY_GEOMETRY;
}
