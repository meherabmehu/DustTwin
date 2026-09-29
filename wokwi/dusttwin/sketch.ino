#include "DHTesp.h"

constexpr uint8_t PM1_PIN = 34;  // PM Sensor 1 substitute: potentiometer on ADC1
constexpr uint8_t PM2_PIN = 35;  // PM Sensor 2 substitute: potentiometer on ADC1
constexpr uint8_t DHT_PIN = 15;
constexpr int PM_SIMULATED_MAX_UG_M3 = 150;
constexpr int PM_MODERATE_THRESHOLD = 40;

const uint8_t RELAY_PINS[4] = {18, 19, 21, 22};  // One virtual relay per misting zone
const uint8_t ZONE_LED_PINS[4] = {13, 14, 27, 32};
constexpr uint8_t PUMP_OUTPUT_PIN = 25;
constexpr uint8_t FAN_OUTPUT_PIN = 26;

DHTesp weatherSensor;
bool zoneActive[4] = {false, false, false, false};

int readSimulatedPm(uint8_t pin) {
  const int raw = analogRead(pin);  // ESP32 ADC: 0–4095
  return map(raw, 0, 4095, 0, PM_SIMULATED_MAX_UG_M3);
}

void setZone(uint8_t zone, bool active) {
  zoneActive[zone] = active;
  digitalWrite(RELAY_PINS[zone], active ? HIGH : LOW);
  digitalWrite(ZONE_LED_PINS[zone], active ? HIGH : LOW);
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
}

void loop() {
  const int pm1 = readSimulatedPm(PM1_PIN);
  const int pm2 = readSimulatedPm(PM2_PIN);
  const TempAndHumidity weather = weatherSensor.getTempAndHumidity();

  // First-pass mapping: each simulated boundary sensor activates its nearby zone.
  setZone(0, pm1 >= PM_MODERATE_THRESHOLD);
  setZone(1, false);
  setZone(2, pm2 >= PM_MODERATE_THRESHOLD);
  setZone(3, false);

  const bool anyZoneActive = zoneActive[0] || zoneActive[1] || zoneActive[2] || zoneActive[3];
  digitalWrite(PUMP_OUTPUT_PIN, anyZoneActive ? HIGH : LOW);
  digitalWrite(FAN_OUTPUT_PIN, LOW);

  Serial.println("DustTwin sensor inputs");
  Serial.printf("PM Sensor 1 (sim): %d ug/m3\n", pm1);
  Serial.printf("PM Sensor 2 (sim): %d ug/m3\n", pm2);
  Serial.printf("Temperature:       %.1f C\n", weather.temperature);
  Serial.printf("Humidity:          %.1f %%\n", weather.humidity);
  Serial.println("Misting zones:     Zone 1 / Zone 3 follow their nearest PM input");
  delay(2000);
}
