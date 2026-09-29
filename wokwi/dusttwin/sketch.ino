#include "DHTesp.h"

// Analog inputs stand in for two PMS5003 boundary sensors.
constexpr uint8_t PM1_PIN = 34;
constexpr uint8_t PM2_PIN = 35;
constexpr uint8_t DHT_PIN = 15;
constexpr int PM_SIMULATED_MAX_UG_M3 = 150;

// Demo thresholds only; tune with measured site data before real deployment.
constexpr int PM_MODERATE_THRESHOLD = 40;
constexpr int PM_HIGH_THRESHOLD = 75;

const uint8_t RELAY_PINS[4] = {18, 19, 21, 22};  // Four single-channel relay modules
const uint8_t ZONE_LED_PINS[4] = {13, 14, 27, 32};
constexpr uint8_t PUMP_OUTPUT_PIN = 25;
constexpr uint8_t FAN_OUTPUT_PIN = 26;

enum ControlMode { AUTO_MODE, MANUAL_MODE };
ControlMode controlMode = AUTO_MODE;

DHTesp weatherSensor;
bool zoneActive[4] = {false, false, false, false};
bool fanOutputActive = false;

int readSimulatedPm(uint8_t pin) {
  const int raw = analogRead(pin);  // ESP32 ADC: 0–4095
  return map(raw, 0, 4095, 0, PM_SIMULATED_MAX_UG_M3);
}

void setZone(uint8_t zone, bool active) {
  zoneActive[zone] = active;
  digitalWrite(RELAY_PINS[zone], active ? HIGH : LOW);
  digitalWrite(ZONE_LED_PINS[zone], active ? HIGH : LOW);
}

void setAllZones(bool active) {
  for (uint8_t zone = 0; zone < 4; zone++) setZone(zone, active);
}

void updateAutomaticControl(int pm1, int pm2) {
  const bool sensor1Moderate = pm1 >= PM_MODERATE_THRESHOLD;
  const bool sensor2Moderate = pm2 >= PM_MODERATE_THRESHOLD;
  const bool sensor1High = pm1 >= PM_HIGH_THRESHOLD;
  const bool sensor2High = pm2 >= PM_HIGH_THRESHOLD;

  // Sensor 1 protects the first site edge (Zones 1–2); Sensor 2 protects the opposite edge (Zones 3–4).
  setZone(0, sensor1Moderate);
  setZone(1, sensor1High);
  setZone(2, sensor2Moderate);
  setZone(3, sensor2High);
  fanOutputActive = sensor1High || sensor2High;
}

void handleSerialCommands() {
  while (Serial.available() > 0) {
    const char command = Serial.read();
    if (command == 'a' || command == 'A') {
      controlMode = AUTO_MODE;
      Serial.println("AUTO MODE selected");
    } else if (command == 'm' || command == 'M') {
      controlMode = MANUAL_MODE;
      fanOutputActive = false;
      Serial.println("MANUAL / TEST MODE selected");
      Serial.println("Send 1-4 to toggle a zone, 0 to clear zones, or F to test the fan.");
    } else if (controlMode == MANUAL_MODE && command >= '1' && command <= '4') {
      const uint8_t zone = static_cast<uint8_t>(command - '1');
      setZone(zone, !zoneActive[zone]);
    } else if (controlMode == MANUAL_MODE && command == '0') {
      setAllZones(false);
      fanOutputActive = false;
    } else if (controlMode == MANUAL_MODE && (command == 'f' || command == 'F')) {
      fanOutputActive = !fanOutputActive;
    }
  }
}

void applyAccessoryOutputs() {
  const bool anyZoneActive = zoneActive[0] || zoneActive[1] || zoneActive[2] || zoneActive[3];
  digitalWrite(PUMP_OUTPUT_PIN, anyZoneActive ? HIGH : LOW);
  digitalWrite(FAN_OUTPUT_PIN, fanOutputActive ? HIGH : LOW);
}

const char* riskLabel(int pm1, int pm2) {
  const int peakPm = max(pm1, pm2);
  if (peakPm >= PM_HIGH_THRESHOLD) return "HIGH";
  if (peakPm >= PM_MODERATE_THRESHOLD) return "ELEVATED";
  return "LOW";
}

const char* predictedZone(int pm1, int pm2) {
  const bool sensor1Moderate = pm1 >= PM_MODERATE_THRESHOLD;
  const bool sensor2Moderate = pm2 >= PM_MODERATE_THRESHOLD;
  const bool sensor1High = pm1 >= PM_HIGH_THRESHOLD;
  const bool sensor2High = pm2 >= PM_HIGH_THRESHOLD;

  if (sensor1High && sensor2High) return "Zones 1-4";
  if (sensor1High && sensor2Moderate) return "Zones 1-2 + 3";
  if (sensor2High && sensor1Moderate) return "Zone 1 + Zones 3-4";
  if (sensor1Moderate && sensor2Moderate) return "Zones 1 + 3";
  if (sensor1Moderate) return sensor1High ? "Zones 1-2" : "Zone 1";
  if (sensor2Moderate) return sensor2High ? "Zones 3-4" : "Zone 3";
  return "None";
}

void printStatus(int pm1, int pm2, const TempAndHumidity& weather) {
  Serial.println("\nDustTwin System Status");
  Serial.printf("Mode: %s\n", controlMode == AUTO_MODE ? "AUTO" : "MANUAL / TEST");
  Serial.printf("PM Sensor 1 (sim): %d ug/m3\n", pm1);
  Serial.printf("PM Sensor 2 (sim): %d ug/m3\n", pm2);
  Serial.printf("Temperature: %.1f C\n", weather.temperature);
  Serial.printf("Humidity: %.1f %%\n", weather.humidity);
  Serial.printf("Boundary Risk: %s\n", riskLabel(pm1, pm2));
  Serial.printf("Predicted Zone: %s\n", controlMode == AUTO_MODE ? predictedZone(pm1, pm2) : "Manual test");

  for (uint8_t zone = 0; zone < 4; zone++) {
    Serial.printf("Zone %u: %s\n", zone + 1, zoneActive[zone] ? "ACTIVE" : "OFF");
  }
  const bool pumpOn = zoneActive[0] || zoneActive[1] || zoneActive[2] || zoneActive[3];
  Serial.printf("Water Pump: %s\n", pumpOn ? "ON" : "OFF");
  Serial.printf("Fan Output: %s\n", fanOutputActive ? "ON" : "OFF");
  Serial.println("--------------------------------");
}

void setup() {
  Serial.begin(115200);
  weatherSensor.setup(DHT_PIN, DHTesp::DHT22);

  for (uint8_t zone = 0; zone < 4; zone++) {
    pinMode(RELAY_PINS[zone], OUTPUT);
    pinMode(ZONE_LED_PINS[zone], OUTPUT);
    setZone(zone, false);
  }
  pinMode(PUMP_OUTPUT_PIN, OUTPUT);
  pinMode(FAN_OUTPUT_PIN, OUTPUT);
  digitalWrite(PUMP_OUTPUT_PIN, LOW);
  digitalWrite(FAN_OUTPUT_PIN, LOW);

  Serial.println();
  Serial.println("DustTwin System Started");
  Serial.println("AUTO MODE | Send A for auto, M for manual test");
}

void loop() {
  handleSerialCommands();

  const int pm1 = readSimulatedPm(PM1_PIN);
  const int pm2 = readSimulatedPm(PM2_PIN);
  const TempAndHumidity weather = weatherSensor.getTempAndHumidity();

  if (controlMode == AUTO_MODE) updateAutomaticControl(pm1, pm2);
  applyAccessoryOutputs();
  printStatus(pm1, pm2, weather);
  delay(2000);
}
