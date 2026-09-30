import { createInitialSimulationReadings, predictSimulation } from './simulationEngine';
import type { BoundaryId, ControlStrategy, SimulationInput, SimulationPrediction, SimulationRunState } from './simulationTypes';

export interface PredictionContext {
  currentPm25?: Record<BoundaryId, number>;
  strategy?: ControlStrategy;
  running?: boolean;
  runState?: Partial<SimulationRunState>;
}

/**
 * Replace this adapter's implementation with an ML/API request later if needed.
 * The page depends on the prediction contract, not on this deterministic model implementation.
 */
export const predictionService = {
  async predict(input: SimulationInput, context: PredictionContext = {}): Promise<SimulationPrediction> {
    await Promise.resolve();
    const current = context.currentPm25 ?? createInitialSimulationReadings(input);
    return predictSimulation(input, current, context.strategy ?? 'predictive', context.running ?? true, context.runState);
  },
};
