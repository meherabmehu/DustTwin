#include <Arduino.h>
#include "protocol.h"

JsonLines lines;
uint32_t sequence = 0, lastCommand = 0, lastStatus = 0, lastSeq = 0;
uint32_t openingSince[4] = {};
bool requested[11] = {}, output[11] = {}, confirmed[4] = {};
bool armed = false, hasSequence = false, emergency = true, simulationEmergency = false;
String session;
const char* errorState = "not_armed";
void off() { for (int i = 0; i < 11; i++) { output[i] = false; requested[i] = false; digitalWrite(Hardware::OUTPUTS[i], LOW); } }
bool emergencyInput() {
#ifdef DUSTTWIN_VIRTUAL_INPUT
  return simulationEmergency || digitalRead(Hardware::ESTOP) != LOW;
#else
  return digitalRead(Hardware::ESTOP) != LOW;
#endif
}
void report(const char* type, uint32_t commandId = 0) {
  JsonDocument d; envelope(d, type, "actuator-esp32", sequence++);
  d["commandId"] = commandId; d["session"] = session; d["armed"] = armed; d["estop"] = emergencyInput(); d["error"] = errorState;
  auto gpio = d["outputs"].to<JsonArray>(); for (bool on : output) gpio.add(on);
  auto feedback = d["openFeedback"].to<JsonArray>(); for (bool open : confirmed) feedback.add(open);
  emit(d);
}
bool boolArray(JsonVariant v, size_t count) { if (!v.is<JsonArray>() || v.size() != count) return false; for (JsonVariant item : v.as<JsonArray>()) if (!item.is<bool>()) return false; return true; }
void receive(JsonDocument& d) {
#ifdef DUSTTWIN_VIRTUAL_INPUT
  if (validEnvelope(d, "inject") && d["device"] == "hardware-lab") { simulationEmergency = d["payload"]["estop"] | false; return; }
#endif
  if (!validEnvelope(d, "command") || d["device"] != "raspberry-pi" || !d["session"].is<const char*>() || !d["payload"].is<JsonObject>()) { off(); armed = false; errorState = "invalid_envelope"; report("error"); return; }
  uint32_t id = d["seq"]; String nextSession = d["session"].as<String>();
  // Reconnection requires explicit arm. A new session cannot inherit energized output.
  if (nextSession != session) { off(); armed = false; hasSequence = false; session = nextSession; }
  if (hasSequence && id <= lastSeq) { off(); armed = false; errorState = "duplicate_or_reordered"; report("error", id); return; }
  lastSeq = id; hasSequence = true;
  JsonObject p = d["payload"];
  if (p["stop"] == true || emergencyInput()) { off(); armed = false; errorState = emergencyInput() ? "emergency_stop" : "host_stop"; report("ack", id); return; }
  if (p["arm"] == true) { off(); armed = true; lastCommand = millis(); errorState = ""; report("ack", id); return; }
  if (!armed || !boolArray(p["dampers"], 4) || !boolArray(p["valves"], 4) || !p["motor"].is<bool>() || !p["pump"].is<bool>() || !p["fan"].is<bool>() || !p["safe"].is<bool>()) { off(); armed = false; errorState = "invalid_or_unarmed"; report("error", id); return; }
  if (!p["safe"].as<bool>()) { off(); armed = false; errorState = "host_safety_inhibit"; report("ack", id); return; }
  for (int i = 0; i < 4; i++) {
    bool wanted = p["dampers"][i];
    if (wanted && !requested[i]) openingSince[i] = millis();
    requested[i] = wanted; requested[i + 4] = p["valves"][i];
  }
  requested[8] = p["pump"]; requested[9] = p["motor"]; requested[10] = p["fan"];
  lastCommand = millis(); errorState = "";
  report("ack", id); // acceptance; status/feedback reports applied GPIO, not assumed movement
}
void setup() {
  Serial.begin(Hardware::BAUD);
  for (uint8_t pin : Hardware::OUTPUTS) { digitalWrite(pin, LOW); pinMode(pin, OUTPUT); }
  for (uint8_t pin : Hardware::OPEN_FEEDBACK) pinMode(pin, INPUT); // external pull-ups on GPIO34–39
  pinMode(Hardware::ESTOP, INPUT_PULLUP); off(); report("hello");
}
void loop() {
  lines.poll(receive);
  emergency = emergencyInput();
  if (emergency || (armed && millis() - lastCommand > Hardware::TIMEOUTMS)) {
    if (armed) { off(); armed = false; errorState = emergency ? "emergency_stop" : "heartbeat_timeout"; report("error"); }
  }
  bool anyRequested = false, allOpen = true, anyValve = false;
  for (int i = 0; i < 4; i++) {
#ifdef DUSTTWIN_VIRTUAL_INPUT
    confirmed[i] = requested[i] && millis() - openingSince[i] >= DUSTTWIN_SIM_TRAVEL_MS;
#else
    confirmed[i] = digitalRead(Hardware::OPEN_FEEDBACK[i]) == LOW;
#endif
    anyRequested |= requested[i];
    allOpen &= confirmed[i] == requested[i];
    anyValve |= requested[i + 4];
    output[i] = armed && requested[i]; output[i + 4] = armed && requested[i + 4];
    if (requested[i] && !confirmed[i] && millis() - openingSince[i] > Hardware::DAMPERTRAVELMS + 5000) { off(); armed = false; errorState = "damper_feedback_timeout"; }
  }
  output[8] = armed && requested[8] && anyValve;
  output[9] = armed && requested[9] && anyRequested && allOpen;
  output[10] = armed && requested[10];
  for (int i = 0; i < 11; i++) digitalWrite(Hardware::OUTPUTS[i], output[i] ? HIGH : LOW);
  if (millis() - lastStatus >= Hardware::HEARTBEATMS) { lastStatus = millis(); report("status", lastSeq); }
  delay(1);
}
