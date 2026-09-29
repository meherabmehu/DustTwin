import { SIMULATION_THRESHOLDS } from '../../config/simulationThresholds';

export const DEFAULT_SIMULATOR_INPUTS = Object.freeze({
  pm1: 28,
  pm2: 42,
  temperature: 28.4,
  humidity: 62,
  windSpeed: 6,
  windDirection: 90,
});

export const PM10_DERIVATION_NOTE = `PM10 is estimated from PM2.5 using a ${SIMULATION_THRESHOLDS.pm10Factor.toFixed(2)}× display factor; it is not a separate sensor input.`;

export const SERIAL_LOG_LIMIT = 250;
