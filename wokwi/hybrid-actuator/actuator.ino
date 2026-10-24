// Proposed ESP32-WROOM-32 driver scaffold, not a compiled/validated hardware release.
// USB UART at 115200. Command: SET <decimal bitmask>\n or STOP\n.
// Bits 0..3 dampers A..D, 4..7 valves A..D, 8 pump, 9 suction contactor, 10 fan.
// Host must enforce travel, airflow, pressure and communication interlocks.
// Active-HIGH 3.3V compatible external drivers with fail-off pull-downs required.
// Independent NC emergency chain must physically remove actuator energy.
#include <Arduino.h>
const uint8_t PINS[] = {13, 14, 18, 19, 21, 22, 23, 25, 26, 27, 32};
constexpr unsigned long WATCHDOG_MS = 1500;
unsigned long lastCommand = 0;
char line[32];
size_t used = 0;
bool discardLine = false;
void outputs(uint16_t mask) {
  for (size_t i = 0; i < 11; ++i) digitalWrite(PINS[i], (mask & (1U << i)) ? HIGH : LOW);
}
void command() {
  line[used] = '\0';
  if (strcmp(line, "STOP") == 0) { outputs(0); lastCommand = millis(); Serial.println("ACK STOP"); return; }
  if (strncmp(line, "SET ", 4) == 0 && line[4] >= '0' && line[4] <= '9') {
    char* end;
    const unsigned long mask = strtoul(line + 4, &end, 10);
    if (*end == '\0' && mask <= 2047) {
      // Avoid energizing pump without valve, or contactor without damper command.
      if (((mask & 256) && !(mask & 240)) || ((mask & 512) && !(mask & 15))) { outputs(0); Serial.println("ERR INTERLOCK"); return; }
      outputs(static_cast<uint16_t>(mask)); lastCommand = millis(); Serial.println("ACK SET"); return;
    }
  }
  outputs(0); Serial.println("ERR COMMAND");
}
void setup() {
  for (const uint8_t pin : PINS) { digitalWrite(pin, LOW); pinMode(pin, OUTPUT); }
  Serial.begin(115200); outputs(0); Serial.println("READY FAIL-OFF");
}
void loop() {
  if (millis() - lastCommand > WATCHDOG_MS) outputs(0);
  while (Serial.available()) {
    const char ch = Serial.read();
    if (ch == '\r') continue;
    if (ch == '\n') {
      if (!discardLine) command();
      used = 0; discardLine = false;
    } else if (!discardLine && used + 1 < sizeof(line)) line[used++] = ch;
    else { used = 0; discardLine = true; outputs(0); }
  }
}
