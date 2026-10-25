#pragma once
#include <Arduino.h>
#include <ArduinoJson.h>
#include "hardware.generated.h"

// Newline-delimited JSON. No allocation based on an untrusted line length.
class JsonLines {
  char buffer[Hardware::MAXLINEBYTES + 1];
  size_t used = 0;
  bool discarding = false;
 public:
  template <typename Callback> void poll(Callback receive) {
    while (Serial.available()) {
      char ch = Serial.read();
      if (ch == '\r') continue;
      if (ch == '\n') {
        if (!discarding && used) {
          buffer[used] = 0;
          JsonDocument doc;
          auto error = deserializeJson(doc, buffer);
          if (!error) receive(doc);
          else Serial.println("{\"v\":1,\"type\":\"error\",\"error\":\"invalid_json\"}");
        }
        used = 0; discarding = false;
      } else if (!discarding && used < Hardware::MAXLINEBYTES) buffer[used++] = ch;
      else { discarding = true; used = 0; }
    }
  }
};
inline void envelope(JsonDocument& doc, const char* type, const char* device, uint32_t seq) {
  doc["v"] = Hardware::VERSION;
  doc["type"] = type;
  doc["device"] = device;
  doc["seq"] = seq;
  doc["ms"] = millis();
}
inline void emit(JsonDocument& doc) { serializeJson(doc, Serial); Serial.println(); }
inline bool validEnvelope(JsonDocument& doc, const char* type) {
  return doc["v"] == Hardware::VERSION && doc["type"] == type && doc["seq"].is<uint32_t>() && doc["ms"].is<uint64_t>();
}
