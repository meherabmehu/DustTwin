// Backwards-compatible exports; all simulation formulas live in features/simulation.
export {
  defaultInput,
  directionLabel,
  predictSimulation as calculateDustScenario,
  predictSimulation as calculateSimulationPrediction,
} from '../features/simulation/simulationEngine';
export type {
  SimulationInput,
  SimulationPrediction as Prediction,
} from '../features/simulation/simulationTypes';
