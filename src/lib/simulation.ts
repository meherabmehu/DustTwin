export type SimulationInput = {
  dustIntensity: number;
  windSpeed: number;
  windDirection: number;
  humidity: number;
  suddenShift?: boolean;
};

export type Prediction = {
  pm25: number;
  pm10: number;
  boundaryRisk: number;
  risk: 'LOW' | 'MODERATE' | 'HIGH';
  escapeDirection: string;
  activeZone: string;
  leadTime: number;
  waterUsage: number;
  plumeLength: number;
  plumeAngle: number;
  zoneReadings: number[];
  chart: Array<{ time: string; twin: number; baseline: number }>;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Replace this deterministic adapter with the DustTwin prediction API when it is available.
 * The inputs and result shape are intentionally UI-facing and model-agnostic.
 */
export async function predictDust(input: SimulationInput): Promise<Prediction> {
  // Keep the same async contract a future remote model will use.
  await Promise.resolve();
  const dir = ((input.windDirection % 360) + 360) % 360;
  const windFactor = 0.67 + input.windSpeed / 12;
  const humidityFactor = 1.14 - input.humidity / 210;
  const riskRaw = input.dustIntensity * 0.69 * windFactor * humidityFactor;
  const pm25 = Math.round(clamp(riskRaw * 0.63, 8, 140));
  const pm10 = Math.round(pm25 * 1.62 + 9);
  const boundaryRisk = Math.round(clamp((pm25 - 18) * 1.55 + input.windSpeed * 1.2, 4, 96));
  const risk: Prediction['risk'] = boundaryRisk > 62 ? 'HIGH' : boundaryRisk > 34 ? 'MODERATE' : 'LOW';
  const directionNames = ['North', 'NE', 'East', 'SE', 'South', 'SW', 'West', 'NW'];
  const escapeDirection = directionNames[Math.round(dir / 45) % 8];
  const activeZone = ['Zone A', 'Zone B', 'Zone C', 'Zone D'][Math.floor((dir + 45) / 90) % 4];
  const leadTime = Math.max(4, Math.round(28 - input.windSpeed * 1.45 - input.dustIntensity * 0.07));
  const waterUsage = Math.round(620 + input.dustIntensity * 7.3 + input.windSpeed * 34 - input.humidity * 1.6);
  const plumeLength = clamp(34 + input.windSpeed * 3.9 + input.dustIntensity * 0.19 - input.humidity * 0.15, 38, 86);
  const plumeAngle = dir - 135;
  const zoneReadings = [pm25 * 0.68, pm25 * 0.78, pm25 * 0.92, pm25 * 1.08].map((v, i) => Math.round(clamp(v + (i % 2 ? -3 : 2), 8, 140)));
  const chart = Array.from({ length: 20 }, (_, index) => {
    const wave = Math.sin(index * 0.68 + dir / 55) * 5 + Math.cos(index * 0.31) * 3;
    const baseline = Math.max(12, Math.round(pm25 * 1.6 + wave + index * 0.8));
    const twin = Math.max(8, Math.round(pm25 * 0.58 + wave * 0.7 + index * 0.28));
    return { time: `${String(10 + Math.floor(index / 4)).padStart(2, '0')}:${String((index % 4) * 15).padStart(2, '0')}`, twin, baseline };
  });
  return { pm25, pm10, boundaryRisk, risk, escapeDirection, activeZone, leadTime, waterUsage, plumeLength, plumeAngle, zoneReadings, chart };
}

export const defaultInput: SimulationInput = {
  dustIntensity: 70,
  windSpeed: 4.2,
  windDirection: 315,
  humidity: 45,
  suddenShift: false,
};

export const directionLabel = (degrees: number) => {
  const dir = ((degrees % 360) + 360) % 360;
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round(dir / 45) % 8];
};
