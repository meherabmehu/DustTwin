import { SIMULATION_THRESHOLDS } from '../config/simulationThresholds';

export type SimulationInput = {
  dustIntensity: number;
  windSpeed: number;
  windDirection: number;
  humidity: number;
  suddenShift?: boolean;
};

export type Prediction = {
  /** Estimated PM2.5 under the modeled DustTwin response. */
  pm25: number;
  /** Derived PM10 estimate for the modeled DustTwin response. */
  pm10: number;
  /** Untreated scenario reference used only for comparison. */
  baselinePm25: number;
  baselinePm10: number;
  boundaryRisk: number;
  risk: 'LOW' | 'MODERATE' | 'HIGH';
  escapeDirection: string;
  activeZone: string;
  mistingActive: boolean;
  leadTime: number;
  waterUsage: number;
  plumeLength: number;
  plumeAngle: number;
  zoneReadings: [number, number, number, number];
  chart: Array<{ time: string; twin: number; baseline: number }>;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value);

/** Deterministic illustrative scenario model shared by the page and its tests. */
export function calculateDustScenario(input: SimulationInput): Prediction {
  const direction = ((input.windDirection % 360) + 360) % 360;
  const source = clamp(input.dustIntensity, 0, 100);
  const speed = clamp(input.windSpeed, 0, 10);
  const humidity = clamp(input.humidity, 0, 100);
  const windFactor = 0.5 + speed * 0.065;
  const humidityFactor = 1.1 - humidity / 500;
  const baselinePm25 = round(clamp(source * windFactor * humidityFactor, 0, 160));
  const risk: Prediction['risk'] = baselinePm25 >= SIMULATION_THRESHOLDS.pm25High
    ? 'HIGH'
    : baselinePm25 >= SIMULATION_THRESHOLDS.pm25Moderate
      ? 'MODERATE'
      : 'LOW';
  const mistingActive = risk !== 'LOW';
  const reduction = risk === 'HIGH' ? 0.48 : risk === 'MODERATE' ? 0.32 : 0;
  const pm25 = round(baselinePm25 * (1 - reduction));
  const pm10 = round(pm25 * SIMULATION_THRESHOLDS.pm10Factor);
  const baselinePm10 = round(baselinePm25 * SIMULATION_THRESHOLDS.pm10Factor);
  const boundaryRisk = round(clamp((baselinePm25 / SIMULATION_THRESHOLDS.pm25High) * 100, 0, 100));
  const compassPoints = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const escapeDirection = compassPoints[round(direction / 45) % compassPoints.length];
  const zoneNames = ['Zone A', 'Zone B', 'Zone C', 'Zone D'];
  const downstreamIndex = round(direction / 90) % zoneNames.length;
  const activeZone = mistingActive ? zoneNames[downstreamIndex] : 'Standby';
  const leadTime = mistingActive
    ? round(clamp(32 - speed * 1.7 - baselinePm25 * 0.09, 3, 28))
    : 0;
  const waterUsage = mistingActive ? round(180 + source * 6 + speed * 18) : 0;
  const plumeLength = clamp(24 + speed * 4.5 + source * 0.28 - humidity * 0.08, 20, 100);
  const zoneFactors = [0.68, 0.8, 0.93, 1.08];
  const zoneReadings = zoneFactors.map((factor, index) => {
    const response = mistingActive && index === downstreamIndex ? 1 - reduction * 0.6 : 1;
    return round(clamp(baselinePm25 * factor * response, 0, 200));
  }) as [number, number, number, number];
  const chart = Array.from({ length: 20 }, (_, index) => {
    const progress = index / 19;
    const wave = Math.sin(index * 0.61 + direction / 57) * Math.max(1, baselinePm25 * 0.025);
    const baselineTrend = baselinePm25 * (0.92 + progress * 0.08) + wave;
    const twinTrend = baselinePm25 * (0.92 + progress * 0.08 - reduction * progress) + wave * 0.45;
    return {
      time: `${String(10 + Math.floor(index / 4)).padStart(2, '0')}:${String((index % 4) * 15).padStart(2, '0')}`,
      twin: round(clamp(twinTrend, 0, 200)),
      baseline: round(clamp(baselineTrend, 0, 200)),
    };
  });

  return {
    pm25,
    pm10,
    baselinePm25,
    baselinePm10,
    boundaryRisk,
    risk,
    escapeDirection,
    activeZone,
    mistingActive,
    leadTime,
    waterUsage,
    plumeLength,
    plumeAngle: direction,
    zoneReadings,
    chart,
  };
}

/** Keep the adapter's async contract for a future local or remote prediction service. */
export async function predictDust(input: SimulationInput): Promise<Prediction> {
  await Promise.resolve();
  return calculateDustScenario(input);
}

export const defaultInput: SimulationInput = {
  dustIntensity: 70,
  windSpeed: 4.2,
  windDirection: 315,
  humidity: 45,
  suddenShift: false,
};

export const directionLabel = (degrees: number) => {
  const direction = ((degrees % 360) + 360) % 360;
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[round(direction / 45) % points.length];
};
