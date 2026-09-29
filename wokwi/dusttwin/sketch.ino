#include "DHTesp.h"

constexpr uint8_t PM1_PIN = 34;  // PM Sensor 1 substitute: potentiometer on ADC1
constexpr uint8_t PM2_PIN = 35;  // PM Sensor 2 substitute: potentiometer on ADC1
constexpr uint8_t DHT_PIN = 15;
constexpr int PM_SIMULATED_MAX_UG_M3 = 150;

DHTesp weatherSensor;

int readSimulatedPm(uint8_t pin) {
  const int raw = analogRead(pin);  // ESP32 ADC: 0–4095
  return map(raw, 0, 4095, 0, PM_SIMULATED_MAX_UG_M3);
}

void setup() {
  Serial.begin(115200);
  weatherSensor.setup(DHT_PIN, DHTesp::DHT22);
  Serial.println();
  Serial.println("DustTwin ESP32 demo booting...");
}

void loop() {
  const int pm1 = readSimulatedPm(PM1_PIN);
  const int pm2 = readSimulatedPm(PM2_PIN);
  const TempAndHumidity weather = weatherSensor.getTempAndHumidity();

  Serial.println("DustTwin sensor inputs");
  Serial.printf("PM Sensor 1 (sim): %d ug/m3\n", pm1);
  Serial.printf("PM Sensor 2 (sim): %d ug/m3\n", pm2);
  Serial.printf("Temperature:       %.1f C\n", weather.temperature);
  Serial.printf("Humidity:          %.1f %%\n", weather.humidity);
  Serial.println("------------------------------");
  delay(2000);
}
