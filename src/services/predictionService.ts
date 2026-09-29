import { predictDust, type Prediction, type SimulationInput } from '../lib/simulation';

/** Model/API adapter used by the UI. Swap the implementation without changing components. */
export const predictionService = {
  predict(input: SimulationInput): Promise<Prediction> {
    return predictDust(input);
  },
};
