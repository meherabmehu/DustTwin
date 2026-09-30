import type { RiskStatus, SimulationInput } from './simulationTypes';

/**
 * Transparent Weighted Deterministic Risk Model for DustTwin.
 *
 * Project Objective:
 * Risk must NOT depend on only one input. It combines source emissions,
 * environmental transport, boundary PM exposure, humidity settling, and temperature dispersion.
 *
 * Weight Distribution:
 * - Dust Source Intensity:      30% (0–30 pts)
 * - Wind Transport Exposure:    20% (0–20 pts)
 * - Boundary Sensor PM Level:   35% (0–35 pts)
 * - Humidity Modifier:          10% (0–10 pts)
 * - Temperature Modifier:        5% (0–5 pts)
 *
 * Total Score: 0 – 100 points
 */
export const RISK_WEIGHTS = Object.freeze({
  dustSource: 0.30,
  windExposure: 0.20,
  boundaryPm: 0.35,
  humidity: 0.10,
  temperature: 0.05,
});

export interface RiskBreakdown {
  score: number;
  status: RiskStatus;
  dustScore: number;
  windScore: number;
  boundaryPmScore: number;
  humidityScore: number;
  tempScore: number;
  explanation: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Exact Main Simulation risk classification helper:
 *
 * LOW:
 * score < 32 AND peak PM < 40
 *
 * MODERATE:
 * 32 <= score < 55 (and peak PM < 75)
 *
 * HIGH:
 * 55 <= score < 80 OR peak PM >= 75
 *
 * VERY HIGH:
 * score >= 80 OR peak PM >= 150
 */
export function classifyRisk(score: number, peakBoundaryPm25: number): RiskStatus {
  if (score >= 80 || peakBoundaryPm25 >= 150) {
    return 'VERY HIGH';
  }
  if (score >= 55 || peakBoundaryPm25 >= 75) {
    return 'HIGH';
  }
  if (score >= 32 || peakBoundaryPm25 >= 40) {
    return 'MODERATE';
  }
  return 'LOW';
}

/**
 * Calculates a combined multi-factor risk score and classification.
 */
export function calculateCombinedRisk(
  input: SimulationInput,
  peakBoundaryPm25: number,
): RiskBreakdown {
  const dustIntensity = clamp(input.dustIntensity, 0, 100);
  const windSpeed = clamp(input.windSpeed, 0, 10);
  const humidity = clamp(input.humidity, 0, 100);
  const temp = clamp(input.temperatureC, 10, 50);

  // 1. Dust Source Contribution (30% weight: 0 - 30 pts)
  const dustScore = (dustIntensity / 100) * (RISK_WEIGHTS.dustSource * 100);

  // 2. Wind Exposure / Transport Contribution (20% weight: 0 - 20 pts)
  // Low wind (e.g. 1 m/s) results in weak transport to boundary.
  const windScore = (windSpeed / 10) * (RISK_WEIGHTS.windExposure * 100);

  // 3. Boundary PM Contribution (35% weight: 0 - 35 pts)
  // Maps 8 µg/m³ ambient baseline to 0, up to 150 µg/m³ (Very High) to 35 pts
  const pmCleanBaseline = 8;
  const pmVeryHighThreshold = 150;
  const normalizedPm = clamp((peakBoundaryPm25 - pmCleanBaseline) / (pmVeryHighThreshold - pmCleanBaseline), 0, 1);
  const boundaryPmScore = normalizedPm * (RISK_WEIGHTS.boundaryPm * 100);

  // 4. Humidity Adjustment (10% modifier: 0 - 10 pts)
  // Higher humidity increases particle settling, reducing airborne risk.
  const humidityScore = (1 - humidity / 100) * (RISK_WEIGHTS.humidity * 100);

  // 5. Temperature Adjustment (5% modifier: 0 - 5 pts)
  // Baseline 28°C; small modifier on atmospheric dispersion.
  const tempDiff = temp - 28;
  const tempScore = clamp(2.5 + (tempDiff / 22) * 2.5, 0, RISK_WEIGHTS.temperature * 100);

  const rawScore = dustScore + windScore + boundaryPmScore + humidityScore + tempScore;
  const score = Math.round(clamp(rawScore, 0, 100));

  // Transparent risk classification based on the exact shared rules
  const status = classifyRisk(score, peakBoundaryPm25);

  const explanation =
    status === 'LOW'
      ? `Combined risk is LOW (Score ${score}/100): dust emissions and wind transport remain below boundary alert levels.`
      : status === 'MODERATE'
        ? `Combined risk is MODERATE (Score ${score}/100): ${windSpeed <= 1.5 ? 'high dust source, but weak wind transport limits boundary exposure' : 'boundary sensors approaching moderate threshold'}.`
        : status === 'HIGH'
          ? `Combined risk is HIGH (Score ${score}/100): strong directional wind transport carries elevated PM toward site boundaries.`
          : `Combined risk is VERY HIGH (Score ${score}/100): severe plume exposure and high dust generation.`;

  return {
    score,
    status,
    dustScore: Math.round(dustScore * 10) / 10,
    windScore: Math.round(windScore * 10) / 10,
    boundaryPmScore: Math.round(boundaryPmScore * 10) / 10,
    humidityScore: Math.round(humidityScore * 10) / 10,
    tempScore: Math.round(tempScore * 10) / 10,
    explanation,
  };
}
