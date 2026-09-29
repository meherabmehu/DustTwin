import { useEffect, useReducer } from 'react';
import { SIMULATION_TICK_MS } from '../../config/simulationThresholds';
import { createInitialSimulatorState, simulatorReducer } from './simulatorEngine';

export function useSimulator() {
  const [state, dispatch] = useReducer(simulatorReducer, undefined, createInitialSimulatorState);

  useEffect(() => {
    if (!state.simulationRunning) return undefined;
    const timer = window.setInterval(() => dispatch({ type: 'TICK' }), SIMULATION_TICK_MS);
    return () => window.clearInterval(timer);
  }, [state.simulationRunning]);

  return { state, dispatch };
}
