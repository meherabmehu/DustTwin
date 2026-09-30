/**
 * Shared thresholds for the deterministic DustTwin browser simulator.
 * Keep these values aligned with the Arduino-style reference shown in the UI.
 */
export const SIMULATION_THRESHOLDS = Object.freeze({
  pm25Moderate: 40,
  pm25High: 75,
  pm10Factor: 1.65,
  temperatureWarningC: 40,
  humidityWarningPercent: 80,
});

export const ZONE_GPIO_MAP = Object.freeze({
  zone1: 5,
  zone2: 18,
  zone3: 19,
  zone4: 21,
});

export const RELAY_GPIO_MAP = ZONE_GPIO_MAP;

/** Pin labels used by the schematic and Arduino-style reference code. */
export const SIMULATION_PIN_MAP = Object.freeze({
  pmSensor1: Object.freeze({ rx: 16, tx: 17 }),
  pmSensor2: Object.freeze({ rx: 25, tx: 26 }),
  dht22: 4,
  relayZones: ZONE_GPIO_MAP,
  ledZones: Object.freeze({ zone1: 32, zone2: 33, zone3: 27, zone4: 14 }),
  pump: 22,
  fan: 23,
});

export const SIMULATION_INPUT_LIMITS = Object.freeze({
  dustIntensity: { min: 0, max: 100, step: 1 },
  pm25: { min: 0, max: 200, step: 1 },
  temperature: { min: 10, max: 50, step: 0.1 },
  humidity: { min: 0, max: 100, step: 1 },
  windSpeed: { min: 0, max: 30, step: 0.1 },
  windDirection: { min: 0, max: 359, step: 1 },
});

export const SIMULATION_TICK_MS = 1000;
