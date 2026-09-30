import { STRATEGY_COMPARISON_WINDOW_MIN } from '../../config/waterSystem';
import { PM25_MODERATE_THRESHOLD, REACTIVE_DETECTION_DELAY_MINUTES, STRATEGY_LABELS } from './simulationConfig';
import { derivePm10 } from './sensorModel';
import { calculateWaterUseL } from './waterModel';
import type { SimulationPrediction, StrategyComparisonResult } from './simulationTypes';

const roundOne = (value: number) => Math.round(value * 10) / 10;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function concentrationAfterResponse(startPm25: number, ratePerMinute: number, activeMinutes: number): number {
  const ambient = 8;
  return ambient + Math.max(0, startPm25 - ambient) * Math.exp(-ratePerMinute * activeMinutes);
}

function estimatedTimeAboveThreshold(startPm25: number, ratePerMinute: number, horizonMinutes: number): number {
  if (startPm25 <= PM25_MODERATE_THRESHOLD) return 0;
  const ambient = 8;
  const crossing = Math.log((startPm25 - ambient) / (PM25_MODERATE_THRESHOLD - ambient)) / ratePerMinute;
  return clamp(crossing, 0, horizonMinutes);
}

/**
 * Deterministic four-strategy comparison over one shared eight-minute window.
 * Each strategy's water column is always flow rate × nozzle count × modeled active minutes.
 */
export function calculateStrategyComparison(prediction: SimulationPrediction): StrategyComparisonResult[] {
  const horizon = STRATEGY_COMPARISON_WINDOW_MIN;
  const startingBoundaryPm25 = prediction.baselinePm25;
  const eventPredicted = prediction.predictedZoneIds.length > 0;
  const predictiveZoneCount = prediction.predictedZoneIds.length;
  const reactiveZoneCount = prediction.sensors.filter((sensor) => sensor.forecastPm25 >= PM25_MODERATE_THRESHOLD).length;
  const excessLoad = Math.max(0, startingBoundaryPm25 - PM25_MODERATE_THRESHOLD);
  const predictiveMinutes = eventPredicted ? clamp(0.9 + excessLoad / 40, 0.9, 5) : 0;
  const reactiveMinutes = eventPredicted
    ? Math.min(horizon, predictiveMinutes + REACTIVE_DETECTION_DELAY_MINUTES)
    : 0;
  const continuousPm25 = concentrationAfterResponse(startingBoundaryPm25, 0.23, horizon);
  const reactivePm25 = eventPredicted
    ? concentrationAfterResponse(startingBoundaryPm25, 0.3, reactiveMinutes)
    : startingBoundaryPm25;
  const predictivePm25 = eventPredicted
    ? concentrationAfterResponse(startingBoundaryPm25, 0.36, predictiveMinutes)
    : startingBoundaryPm25;
  const leadMinutes = (prediction.leadTimeSeconds ?? 0) / 60;
  const predictiveExceedance = eventPredicted
    ? clamp(estimatedTimeAboveThreshold(startingBoundaryPm25, 0.36, horizon) - leadMinutes, 0, horizon)
    : 0;
  const reactiveExceedance = eventPredicted
    ? clamp(REACTIVE_DETECTION_DELAY_MINUTES + estimatedTimeAboveThreshold(startingBoundaryPm25, 0.3, horizon), 0, horizon)
    : 0;

  const results: StrategyComparisonResult[] = [
    {
      strategy: 'noControl',
      label: STRATEGY_LABELS.noControl,
      boundaryPm25: roundOne(startingBoundaryPm25),
      boundaryPm10: derivePm10(startingBoundaryPm25),
      exceedanceMinutes: eventPredicted ? horizon : 0,
      waterUsedL: 0,
      activeZones: 0,
      activeMinutes: 0,
    },
    {
      strategy: 'continuous',
      label: STRATEGY_LABELS.continuous,
      boundaryPm25: roundOne(continuousPm25),
      boundaryPm10: derivePm10(continuousPm25),
      exceedanceMinutes: roundOne(estimatedTimeAboveThreshold(startingBoundaryPm25, 0.23, horizon)),
      waterUsedL: roundOne(calculateWaterUseL(4, horizon * 60)),
      activeZones: 4,
      activeMinutes: horizon,
    },
    {
      strategy: 'reactive',
      label: STRATEGY_LABELS.reactive,
      boundaryPm25: roundOne(reactivePm25),
      boundaryPm10: derivePm10(reactivePm25),
      exceedanceMinutes: roundOne(reactiveExceedance),
      waterUsedL: roundOne(calculateWaterUseL(reactiveZoneCount, reactiveMinutes * 60)),
      activeZones: reactiveZoneCount,
      activeMinutes: roundOne(reactiveMinutes),
    },
    {
      strategy: 'predictive',
      label: STRATEGY_LABELS.predictive,
      boundaryPm25: roundOne(predictivePm25),
      boundaryPm10: derivePm10(predictivePm25),
      exceedanceMinutes: roundOne(predictiveExceedance),
      waterUsedL: roundOne(calculateWaterUseL(predictiveZoneCount, predictiveMinutes * 60)),
      activeZones: predictiveZoneCount,
      activeMinutes: roundOne(predictiveMinutes),
    },
  ];

  return results;
}
