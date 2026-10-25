#include <Arduino.h>
#include <Wire.h>
#include "protocol.h"

JsonLines lines;
HardwareSerial field(2);
uint32_t sequence = 0, lastSample = 0, lastVirtual = 0;
volatile uint32_t pulses = 0;
bool started[4] = {};
JsonDocument injected;
void IRAM_ATTR flowPulse() { pulses++; }
uint8_t crc8(const uint8_t* data, size_t size) {
  uint8_t crc = 0xff;
  for (size_t i = 0; i < size; i++) { crc ^= data[i]; for (int j = 0; j < 8; j++) crc = crc & 0x80 ? (crc << 1) ^ 0x31 : crc << 1; }
  return crc;
}
bool selectChannel(uint8_t n) { Wire.beginTransmission(0x70); Wire.write(1 << n); return Wire.endTransmission() == 0; }
bool command(uint8_t addr, uint16_t code) { Wire.beginTransmission(addr); Wire.write(code >> 8); Wire.write(code & 255); return Wire.endTransmission() == 0; }
bool readWords(uint8_t addr, uint8_t* result, size_t words) {
  const size_t length = words * 3;
  if (Wire.requestFrom(addr, (uint8_t)length) != length) { while (Wire.available()) Wire.read(); return false; }
  for (size_t i = 0; i < words; i++) {
    uint8_t pair[2] = {(uint8_t)Wire.read(), (uint8_t)Wire.read()};
    if ((uint8_t)Wire.read() != crc8(pair, 2)) { while (Wire.available()) Wire.read(); return false; }
    result[2 * i] = pair[0]; result[2 * i + 1] = pair[1];
  }
  return true;
}
float bigFloat(const uint8_t* data) { uint32_t bits = ((uint32_t)data[0] << 24) | ((uint32_t)data[1] << 16) | ((uint32_t)data[2] << 8) | data[3]; float v; memcpy(&v, &bits, 4); return v; }
bool readPm(uint8_t index, float& pm1, float& pm25, float& pm4, float& pm10) {
  if (!selectChannel(index)) return false;
  if (!started[index]) {
    Wire.beginTransmission(0x69); Wire.write(0x00); Wire.write(0x10);
    const uint8_t format[] = {0x03, 0x00}; Wire.write(format, 2); Wire.write(crc8(format, 2));
    started[index] = Wire.endTransmission() == 0;
    return false; // real SPS30 startup/readiness, never fabricate a first sample
  }
  uint8_t ready[2];
  if (!command(0x69, 0x0202)) { started[index] = false; return false; }
  delay(2);
  if (!readWords(0x69, ready, 1) || !ready[1]) return false;
  if (!command(0x69, 0x0300)) return false;
  delay(2);
  uint8_t data[40]; if (!readWords(0x69, data, 20)) return false;
  pm1 = bigFloat(data); pm25 = bigFloat(data + 4); pm4 = bigFloat(data + 8); pm10 = bigFloat(data + 12);
  return isfinite(pm1) && isfinite(pm25) && isfinite(pm4) && isfinite(pm10) && pm1 >= 0 && pm1 <= pm25 && pm4 >= pm25 && pm4 <= pm10 && pm10 <= 1000;
}
bool readSht(uint8_t channel, float& temp, float& humidity) {
  if (!selectChannel(channel) || !command(0x44, 0x2400)) return false;
  delay(16); uint8_t data[4]; if (!readWords(0x44, data, 2)) return false;
  temp = -45 + 175.0f * ((data[0] << 8) | data[1]) / 65535;
  humidity = 100.0f * ((data[2] << 8) | data[3]) / 65535;
  return isfinite(temp) && humidity >= 0 && humidity <= 100;
}
uint16_t crc16(const uint8_t* data, size_t size) {
  uint16_t crc = 0xffff;
  for (size_t i = 0; i < size; i++) { crc ^= data[i]; for (int j = 0; j < 8; j++) crc = crc & 1 ? (crc >> 1) ^ 0xa001 : crc >> 1; }
  return crc;
}
bool modbus(uint8_t id, uint16_t& value) {
  uint8_t query[8] = {id, 3, 0, (uint8_t)Hardware::WINDREGISTER, 0, 1, 0, 0};
  uint16_t crc = crc16(query, 6); query[6] = crc; query[7] = crc >> 8;
  while (field.available()) field.read();
  digitalWrite(Hardware::RS485DE, HIGH); delayMicroseconds(100);
  field.write(query, 8); field.flush(); digitalWrite(Hardware::RS485DE, LOW);
  uint8_t reply[7]; size_t used = 0; uint32_t begin = millis();
  while (used < 7 && millis() - begin < 150) { if (field.available()) reply[used++] = field.read(); else delay(1); }
  if (used != 7 || reply[0] != id || reply[1] != 3 || reply[2] != 2 || crc16(reply, 5) != (uint16_t)(reply[5] | (reply[6] << 8))) return false;
  value = (reply[3] << 8) | reply[4]; return true;
}
void setup() {
  Serial.begin(Hardware::BAUD); Wire.begin(Hardware::SDA, Hardware::SCL, 100000); Wire.setTimeOut(30);
  pinMode(Hardware::RS485DE, OUTPUT); digitalWrite(Hardware::RS485DE, LOW);
  field.begin(9600, SERIAL_8N1, Hardware::RS485RX, Hardware::RS485TX);
  pinMode(Hardware::FLOW, INPUT); attachInterrupt(Hardware::FLOW, flowPulse, RISING);
  pinMode(Hardware::TANKLEVEL, INPUT_PULLUP); analogSetPinAttenuation(Hardware::PRESSURE, ADC_11db);
  command(0x25, 0x3615); // SDP810 continuous differential pressure, no mux conflict
  JsonDocument ready; envelope(ready, "hello", "sensor-esp32", sequence++);
  ready["runtime"] =
#ifdef DUSTTWIN_VIRTUAL_INPUT
  "firmware-virtual-peripherals";
#else
  "firmware-physical-inputs";
#endif
  emit(ready);
}
void loop() {
  lines.poll([](JsonDocument& doc) {
#ifdef DUSTTWIN_VIRTUAL_INPUT
    if (validEnvelope(doc, "inject") && doc["device"] == "hardware-lab" && doc["payload"].is<JsonObject>()) { injected.set(doc["payload"]); lastVirtual = millis(); }
#endif
  });
  if (millis() - lastSample < 1000) return;
  uint32_t interval = millis() - lastSample; lastSample = millis();
  JsonDocument doc; envelope(doc, "telemetry", "sensor-esp32", sequence++);
  JsonObject payload = doc["payload"].to<JsonObject>();
#ifdef DUSTTWIN_VIRTUAL_INPUT
  if (injected.isNull() || millis() - lastVirtual > Hardware::TIMEOUTMS) { doc["type"] = "error"; doc["error"] = "virtual_input_timeout"; emit(doc); return; }
  payload.set(injected.as<JsonObject>());
  for (JsonObject sample : payload["pm"].as<JsonArray>()) sample["sampleMs"] = millis();
  payload["origin"] = "executed-firmware-virtual-input";
#else
  JsonArray pm = payload["pm"].to<JsonArray>();
  for (int i = 0; i < 4; i++) {
    float p1 = 0, p25 = 0, p4 = 0, p10 = 0; bool valid = readPm(i, p1, p25, p4, p10);
    JsonObject sensor = pm.add<JsonObject>(); sensor["id"] = i; sensor["valid"] = valid; sensor["sampleMs"] = millis();
    if (valid) { sensor["pm1"] = p1; sensor["pm25"] = p25; sensor["pm4"] = p4; sensor["pm10"] = p10; }
    else { sensor["pm25"] = nullptr; sensor["pm10"] = nullptr; }
  }
  JsonArray sht = payload["sht"].to<JsonArray>();
  { float t = 0, h = 0; bool ok = readSht(4, t, h); JsonObject r = sht.add<JsonObject>(); r["valid"] = ok; if (ok) { r["temperatureC"] = t; r["humidity"] = h; } }
  uint16_t speed = 0, angle = 0;
  bool windOk = modbus(Hardware::WINDSPEEDADDRESS, speed) && modbus(Hardware::WINDDIRECTIONADDRESS, angle) && speed <= 324 && angle <= 3600;
  payload["windValid"] = windOk;
  if (windOk) { payload["windSpeed"] = speed / 10.0; payload["windDirection"] = fmod(angle / 10.0 + (Hardware::WINDDIRECTIONISFROM ? 180 : 0), 360); }
  noInterrupts(); uint32_t count = pulses; pulses = 0; interrupts();
  payload["flowLpm"] = count * 60000.0 / interval / Hardware::FLOWPULSESPERLITER;
  float voltage = analogReadMilliVolts(Hardware::PRESSURE) / 1000.0 / Hardware::PRESSUREDIVIDERRATIO;
  payload["pressureValid"] = voltage >= 0.4 && voltage <= 4.6;
  payload["pressureBar"] = max(0.0, (voltage - Hardware::PRESSUREOFFSETV) * Hardware::PRESSUREFULLSCALEBAR / 4.0);
  payload["tankOk"] = digitalRead(Hardware::TANKLEVEL) == LOW;
  uint8_t dp[6] = {}; bool dpOk = readWords(0x25, dp, 3);
  int16_t scale = (dp[4] << 8) | dp[5];
  payload["hepaValid"] = dpOk && scale > 0;
  if (dpOk && scale > 0) payload["hepaPa"] = max(0.0, (double)(int16_t)((dp[0] << 8) | dp[1]) / scale);
  payload["origin"] = "physical-esp32";
#endif
  doc["ms"] = millis(); // enclosing timestamp follows completed sensor reads
  emit(doc);
}
