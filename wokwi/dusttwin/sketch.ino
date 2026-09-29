#include "DHTesp.h"

constexpr uint8_t DHT_PIN = 15;
DHTesp weatherSensor;

void setup() {
  Serial.begin(115200);
  weatherSensor.setup(DHT_PIN, DHTesp::DHT22);
  Serial.println();
  Serial.println("DustTwin ESP32 demo booting...");
}

void loop() {
  const TempAndHumidity weather = weatherSensor.getTempAndHumidity();

  Serial.println("DustTwin weather input");
  Serial.printf("Temperature: %.1f C\n", weather.temperature);
  Serial.printf("Humidity:    %.1f %%\n", weather.humidity);
  Serial.println("------------------------------");
  delay(2000);
}
