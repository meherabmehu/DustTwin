import { predictSimulation } from '../simulation/simulationEngine';
import { calculateStrategyComparison } from '../simulation/strategyComparison';
import type { SimulationInput, SimulationPrediction, StrategyComparisonResult } from '../simulation/simulationTypes';

/**
 * Deterministic standard baseline scenario for the Results page.
 * Dust 70%, Wind 4.2 m/s NW (315°), Temperature 28°C, Humidity 45%.
 */
export const RESULTS_DEFAULT_SCENARIO: SimulationInput = {
  dustIntensity: 70,
  windSpeed: 4.2,
  windDirection: 315,
  temperatureC: 28,
  humidity: 45,
};

export interface ResultsMetricsSummary {
  pmReductionPercent: number;
  exceedanceReductionPercent: number;
  waterReductionPercent: number;
  leadTimeSeconds: number;
  activeZonesCount: number;
  totalZonesCount: number;
  activeZoneIds: string[];
  noControlPm25: number;
  predictivePm25: number;
  noControlPm10: number;
  predictivePm10: number;
  noControlExceedance: number;
  predictiveExceedance: number;
  continuousWater: number;
  predictiveWater: number;
}

/**
 * Computes deterministic results for the Results dashboard from the simulation engine.
 * Maintains completely independent state from Main Simulation and Circuit Simulation.
 */
export function computeResultsSummary(
  scenario: SimulationInput = RESULTS_DEFAULT_SCENARIO
): {
  prediction: SimulationPrediction;
  strategyResults: StrategyComparisonResult[];
  summary: ResultsMetricsSummary;
} {
  const prediction = predictSimulation(scenario, undefined, 'predictive');
  const strategyResults = calculateStrategyComparison(prediction);

  const noControl = strategyResults.find((s) => s.strategy === 'noControl')!;
  const continuous = strategyResults.find((s) => s.strategy === 'continuous')!;
  const predictive = strategyResults.find((s) => s.strategy === 'predictive')!;

  // PM Reduction % = ((No Control PM - DustTwin PM) / No Control PM) * 100
  const pmReductionPercent = Math.round(
    ((noControl.boundaryPm25 - predictive.boundaryPm25) / noControl.boundaryPm25) * 100
  );

  // Boundary Exceedance Time Reduction % = ((No Control Exceedance - DustTwin Exceedance) / No Control Exceedance) * 100
  const exceedanceReductionPercent = Math.round(
    ((noControl.exceedanceMinutes - predictive.exceedanceMinutes) / noControl.exceedanceMinutes) * 100
  );

  // Water Use Reduction % = ((Continuous Water - DustTwin Water) / Continuous Water) * 100
  const waterReductionPercent = Math.round(
    ((continuous.waterUsedL - predictive.waterUsedL) / continuous.waterUsedL) * 100
  );

  const leadTimeSeconds = Math.round(prediction.leadTimeSeconds ?? 0);
  const activeZonesCount = prediction.activeZoneIds.length;
  const totalZonesCount = 4;
  const activeZoneIds = [...prediction.activeZoneIds];

  return {
    prediction,
    strategyResults,
    summary: {
      pmReductionPercent,
      exceedanceReductionPercent,
      waterReductionPercent,
      leadTimeSeconds,
      activeZonesCount,
      totalZonesCount,
      activeZoneIds,
      noControlPm25: noControl.boundaryPm25,
      predictivePm25: predictive.boundaryPm25,
      noControlPm10: noControl.boundaryPm10,
      predictivePm10: predictive.boundaryPm10,
      noControlExceedance: noControl.exceedanceMinutes,
      predictiveExceedance: predictive.exceedanceMinutes,
      continuousWater: continuous.waterUsedL,
      predictiveWater: predictive.waterUsedL,
    },
  };
}
