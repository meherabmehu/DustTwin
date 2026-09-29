import { Code2 } from 'lucide-react';
import { SIMULATION_PIN_MAP, SIMULATION_THRESHOLDS } from '../../config/simulationThresholds';
import { DEFAULT_SIMULATOR_INPUTS } from './simulatorConfig';

type CodeTone = 'keyword' | 'comment' | 'fn' | 'code';

const p = SIMULATION_PIN_MAP;
const referenceCode = [
  '// DustTwin · ESP32 air-quality and zone-control reference',
  '// Fixed threshold logic only — no ML or external simulator.',
  '#include <HardwareSerial.h>',
  '#include <DHT.h>',
  '',
  `constexpr uint8_t DHT_PIN = ${p.dht22};`,
  `constexpr uint8_t PM1_RX = ${p.pmSensor1.rx}, PM1_TX = ${p.pmSensor1.tx};`,
  `constexpr uint8_t PM2_RX = ${p.pmSensor2.rx}, PM2_TX = ${p.pmSensor2.tx};`,
  `constexpr uint8_t RELAY_Z1 = ${p.relayZones.zone1}, RELAY_Z2 = ${p.relayZones.zone2};`,
  `constexpr uint8_t RELAY_Z3 = ${p.relayZones.zone3}, RELAY_Z4 = ${p.relayZones.zone4};`,
  `constexpr uint8_t LED_Z1 = ${p.ledZones.zone1}, LED_Z2 = ${p.ledZones.zone2};`,
  `constexpr uint8_t LED_Z3 = ${p.ledZones.zone3}, LED_Z4 = ${p.ledZones.zone4};`,
  `constexpr uint8_t PUMP_PIN = ${p.pump}, FAN_PIN = ${p.fan};`,
  `constexpr int PM25_MODERATE = ${SIMULATION_THRESHOLDS.pm25Moderate};`,
  `constexpr int PM25_HIGH = ${SIMULATION_THRESHOLDS.pm25High};`,
  `constexpr float PM10_DISPLAY_FACTOR = ${SIMULATION_THRESHOLDS.pm10Factor.toFixed(2)};`,
  `constexpr float TEMP_STATUS_HIGH_C = ${SIMULATION_THRESHOLDS.temperatureWarningC};`,
  `constexpr int RH_STATUS_HIGH_PERCENT = ${SIMULATION_THRESHOLDS.humidityWarningPercent};`,
  '',
  'HardwareSerial pmSensor1(1);',
  'HardwareSerial pmSensor2(2);',
  'DHT dht(DHT_PIN, DHT22);',
  'enum ControlMode { AUTO, MANUAL };',
  'ControlMode mode = AUTO;',
  'bool zone[4] = {false, false, false, false};',
  'bool pumpOn = false, fanOn = false;',
  `float currentPm1 = ${DEFAULT_SIMULATOR_INPUTS.pm1}, currentPm2 = ${DEFAULT_SIMULATOR_INPUTS.pm2};`,
  'float readPM25(HardwareSerial &port);  // PMS5003 frame-parser interface',
  'void writeRelayAndActuatorPins();',
  '',
  'void setup() {',
  '  Serial.begin(115200);',
  '  pmSensor1.begin(9600, SERIAL_8N1, PM1_RX, PM1_TX);',
  '  pmSensor2.begin(9600, SERIAL_8N1, PM2_RX, PM2_TX);',
  '  dht.begin();',
  '  pinMode(RELAY_Z1, OUTPUT); pinMode(RELAY_Z2, OUTPUT);',
  '  pinMode(RELAY_Z3, OUTPUT); pinMode(RELAY_Z4, OUTPUT);',
  '  pinMode(PUMP_PIN, OUTPUT); pinMode(FAN_PIN, OUTPUT);',
  '  pinMode(LED_Z1, OUTPUT); pinMode(LED_Z2, OUTPUT);',
  '  pinMode(LED_Z3, OUTPUT); pinMode(LED_Z4, OUTPUT);',
  '}',
  '',
  'void applyAutoControl(float pm1, float pm2) {',
  '  zone[0] = pm1 >= PM25_MODERATE;  // Sensor 1 → Zone 1',
  '  zone[1] = pm1 >= PM25_HIGH;      // Sensor 1 → Zone 2',
  '  zone[2] = pm2 >= PM25_MODERATE;  // Sensor 2 → Zone 3',
  '  zone[3] = pm2 >= PM25_HIGH;      // Sensor 2 → Zone 4',
  '  pumpOn = zone[0] || zone[1] || zone[2] || zone[3];',
  '  fanOn = pm1 >= PM25_HIGH || pm2 >= PM25_HIGH;',
  '}',
  'void setControlMode(ControlMode next) {',
  '  mode = next;',
  '  if (mode == AUTO) applyAutoControl(currentPm1, currentPm2);',
  '}',
  '',
  'void setManualZone(uint8_t i, bool on) {',
  '  if (mode == MANUAL && i < 4) zone[i] = on;',
  '}',
  'void setManualPump(bool on) { if (mode == MANUAL) pumpOn = on; }',
  'void setManualFan(bool on) { if (mode == MANUAL) fanOn = on; }',
  '',
  'void stopAllOutputs() {',
  '  for (uint8_t i = 0; i < 4; i++) zone[i] = false;',
  '  pumpOn = false; fanOn = false;',
  '  writeRelayAndActuatorPins();  // de-energize immediately on Stop',
  '}',
  '',
  'void writeRelayAndActuatorPins() {',
  '  digitalWrite(RELAY_Z1, zone[0] ? HIGH : LOW);',
  '  digitalWrite(RELAY_Z2, zone[1] ? HIGH : LOW);',
  '  digitalWrite(RELAY_Z3, zone[2] ? HIGH : LOW);',
  '  digitalWrite(RELAY_Z4, zone[3] ? HIGH : LOW);',
  '  digitalWrite(LED_Z1, zone[0] ? HIGH : LOW);',
  '  digitalWrite(LED_Z2, zone[1] ? HIGH : LOW);',
  '  digitalWrite(LED_Z3, zone[2] ? HIGH : LOW);',
  '  digitalWrite(LED_Z4, zone[3] ? HIGH : LOW);',
  '  digitalWrite(PUMP_PIN, pumpOn ? HIGH : LOW);',
  '  digitalWrite(FAN_PIN, fanOn ? HIGH : LOW);',
  '}',
  '',
  'void loop() {',
  '  currentPm1 = readPM25(pmSensor1);  // PMS5003 frame parser',
  '  currentPm2 = readPM25(pmSensor2);',
  '  const float pm10_1 = currentPm1 * PM10_DISPLAY_FACTOR;  // estimate only',
  '  const float pm10_2 = currentPm2 * PM10_DISPLAY_FACTOR;  // derived, not read',
  '  const float temperature = dht.readTemperature();',
  '  const float humidity = dht.readHumidity();',
  '  const bool tempHigh = temperature >= TEMP_STATUS_HIGH_C;  // metric alert only',
  '  const bool humidityHigh = humidity >= RH_STATUS_HIGH_PERCENT;',
  '  if (mode == AUTO) applyAutoControl(currentPm1, currentPm2);',
  '  writeRelayAndActuatorPins();',
  '  Serial.printf("PM1 %.0f/%.0f · PM2 %.0f/%.0f\\n",',
  '                currentPm1, pm10_1, currentPm2, pm10_2);',
  '  Serial.printf("DHT22 %.1f C · %.0f%% RH · %s/%s\\n", temperature, humidity, tempHigh ? "HIGH" : "OK", humidityHigh ? "HIGH" : "OK");',
  '  delay(1000);',
  '}',
  '// Wind values are browser context inputs; no wind sensor is drawn.',
];

function toneFor(line: string): CodeTone {
  const trimmed = line.trim();
  if (trimmed.startsWith('//')) return 'comment';
  if (trimmed.startsWith('#') || trimmed.startsWith('constexpr') || trimmed.startsWith('enum')) return 'keyword';
  if (/^(void|if \(|for \(|ControlMode mode)/.test(trimmed)) return 'fn';
  return 'code';
}

export default function CodePanel() {
  return (
    <aside className="code-panel" aria-label="Arduino-style reference code">
      <div className="code-head">
        <span><Code2 size={15} aria-hidden="true" /> ESP32 Code · Arduino reference</span>
        <span className="code-reference-tag">THRESHOLD ONLY</span>
      </div>
      <div className="code-view" role="region" aria-label="Scrollable Arduino reference code" tabIndex={0}>
        {referenceCode.map((line, index) => {
          const tone = toneFor(line);
          return (
            <code className="code-line" key={`${index}-${line}`}>
              <span className="line-no">{index + 1}</span>
              <span className={tone === 'keyword' ? 'code-keyword' : tone === 'comment' ? 'code-comment' : tone === 'fn' ? 'code-fn' : 'code-code'}>{line}</span>
            </code>
          );
        })}
      </div>
    </aside>
  );
}
