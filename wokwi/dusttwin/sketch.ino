#include "DHTesp.h"

constexpr uint8_t PM1_PIN = 34;  // PM Sensor 1 substitute: potentiometer on ADC1
constexpr uint8_t PM2_PIN = 35;  // PM Sensor 2 substitute: potentiometer on ADC1
constexpr uint8_t DHT_PIN = 15;
constexpr int PM_SIMULATED_MAX_UG_M3 = 150;
constexpr int PM_MODERATE_THRESHOLD = 40;
constexpr int PM_HIGH_THRESHOLD = 75;

const uint8_t RELAY_PINS[4] = {18, 19, 21, 22};  // One virtual relay per misting zone
const uint8_t ZONE_LED_PINS[4] = {13, 14, 27, 32};
constexpr uint8_t PUMP_OUTPUT_PIN = 25;
constexpr uint8_t FAN_OUTPUT_PIN = 26;

enum ControlMode { AUTO_MODE, MANUAL_MODE };
ControlMode controlMode = AUTO_MODE;

DHTesp weatherSensor;
bool zoneActive[4] = {false, false, false, false};
bool manualFanActive = false;

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
  manualFanActive = (sensor1High || sensor2High);
}

void handleSerialCommands() {
  while (Serial.available() > 0) {
    const char command = Serial.read();
    if (command == 'a' || command == 'A') {
      controlMode = AUTO_MODE;
      Serial.println("AUTO MODE selected");
    } else if (command == 'm' || command == 'M') {
      controlMode = MANUAL_MODE;
      manualFanActive = false;
      Serial.println("MANUAL / TEST MODE selected; send 1-4 to toggle a zone, 0 to clear, F to test fan");
    } else if (controlMode == MANUAL_MODE && command >= '1' && command <= '4') {
      const uint8_t zone = static_cast<uint8_t>(command - '1');
      setZone(zone, !zoneActive[zone]);
    } else if (controlMode == MANUAL_MODE && command == '0') {
      setAllZones(false);
      manualFanActive = false;
    } else if (controlMode == MANUAL_MODE && (command == 'f' || command == 'F')) {
      manualFanActive = !manualFanActive;
    }
  }
}

void applyAccessoryOutputs() {
  const bool anyZoneActive = zoneActive[0] || zoneActive[1] || zoneActive[2] || zoneActive[3];
  digitalWrite(PUMP_OUTPUT_PIN, anyZoneActive ? HIGH : LOW);
  digitalWrite(FAN_OUTPUT_PIN, manualFanActive ? HIGH : LOW);
}

const char* riskLabel(int pm1, int pm2) {
  const int peakPm = max(pm1, pm2);
  if (peakPm >= PM_HIGH_THRESHOLD) return "HIGH";
  if (peakPm >= PM_MODERATE_THRESHOLD) return "ELEVATED";
  return "LOW";
}

const char* predictedZone(int pm1, int pm2) {
  const bool leftRisk = pm1 >= PM_MODERATE_THRESHOLD;
  const bool rightRisk = pm2 >= PM_MODERATE_THRESHOLD;
  if (leftRisk && rightRisk) return "Zones 1-4";
  if (leftRisk) return pm1 >= PM_HIGH_THRESHOLD ? "Zones 1-2" : "Zone 1";
  if (rightRisk) return pm2 >= PM_HIGH_THRESHOLD ? "Zones 3-4" : "Zone 3";
  return "None";
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
  Serial.println("DustTwin ESP32 demo booting...");
  Serial.println("AUTO MODE | Send M for manual test, A for auto");
}

void loop() {
  handleSerialCommands();

  const int pm1 = readSimulatedPm(PM1_PIN);
  const int pm2 = readSimulatedPm(PM2_PIN);
  const TempAndHumidity weather = weatherSensor.getTempAndHumidity();

  if (controlMode == AUTO_MODE) updateAutomaticControl(pm1, pm2);
  applyAccessoryOutputs();

  Serial.printf("PM1 %d | PM2 %d | T %.1f C | RH %.1f %% | Risk %s | %s\n",
                pm1, pm2, weather.temperature, weather.humidity,
                riskLabel(pm1, pm2), predictedZone(pm1, pm2));
  delay(1500);
}
