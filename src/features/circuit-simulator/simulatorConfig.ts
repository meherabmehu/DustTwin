import { SIMULATION_THRESHOLDS, ZONE_GPIO_MAP } from '../../config/simulationThresholds';

export const DEFAULT_SIMULATOR_INPUTS = Object.freeze({
  dustIntensity: 70,
  pm1: 28,
  pm2: 42,
  temperature: 28.4,
  humidity: 62,
  windSpeed: 4.2,
  windDirection: 315,
});

export const ZONE_DEFINITIONS = Object.freeze([
  { id: 'A', name: 'Zone A', direction: 'North', gpio: ZONE_GPIO_MAP.zone1, relay: 'Relay 1' },
  { id: 'B', name: 'Zone B', direction: 'East', gpio: ZONE_GPIO_MAP.zone2, relay: 'Relay 2' },
  { id: 'C', name: 'Zone C', direction: 'South', gpio: ZONE_GPIO_MAP.zone3, relay: 'Relay 3' },
  { id: 'D', name: 'Zone D', direction: 'West', gpio: ZONE_GPIO_MAP.zone4, relay: 'Relay 4' },
]);

export const PM10_DERIVATION_NOTE = `PM10 is estimated from PM2.5 using a ${SIMULATION_THRESHOLDS.pm10Factor.toFixed(2)}× display factor; it is a display derivation and not an independently measured physical sensor.`;

export const SERIAL_LOG_LIMIT = 250;
