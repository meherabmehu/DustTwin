import { Code2 } from 'lucide-react';
import { SIMULATION_PIN_MAP, SIMULATION_THRESHOLDS } from '../../config/simulationThresholds';
import { DEFAULT_SIMULATOR_INPUTS } from './simulatorConfig';

type CodeTone = 'keyword' | 'comment' | 'fn' | 'code';

const p = SIMULATION_PIN_MAP;
const referenceCode = [
  '// DustTwin · ESP32 Air-Quality & Directional Zone Control',
  '// Multi-factor weighted risk model + directional misting',
  '#include <HardwareSerial.h>',
  '#include <DHT.h>',
  '',
  `constexpr uint8_t DHT_PIN = ${p.dht22};`,
  `constexpr uint8_t PM1_RX = ${p.pmSensor1.rx}, PM1_TX = ${p.pmSensor1.tx};`,
  `constexpr uint8_t PM2_RX = ${p.pmSensor2.rx}, PM2_TX = ${p.pmSensor2.tx};`,
  `constexpr uint8_t RELAY_ZA = ${p.relayZones.zone1}; // Zone A · North`,
  `constexpr uint8_t RELAY_ZB = ${p.relayZones.zone2}; // Zone B · East`,
  `constexpr uint8_t RELAY_ZC = ${p.relayZones.zone3}; // Zone C · South`,
  `constexpr uint8_t RELAY_ZD = ${p.relayZones.zone4}; // Zone D · West`,
  `constexpr uint8_t LED_ZA = ${p.ledZones.zone1}, LED_ZB = ${p.ledZones.zone2};`,
  `constexpr uint8_t LED_ZC = ${p.ledZones.zone3}, LED_ZD = ${p.ledZones.zone4};`,
  `constexpr uint8_t PUMP_PIN = ${p.pump}, FAN_PIN = ${p.fan};`,
  `constexpr float PM10_DISPLAY_FACTOR = ${SIMULATION_THRESHOLDS.pm10Factor.toFixed(2)};`,
  '',
  'HardwareSerial pmSensor1(1);',
  'HardwareSerial pmSensor2(2);',
  'DHT dht(DHT_PIN, DHT22);',
  'enum ControlMode { AUTO, MANUAL };',
  'ControlMode mode = AUTO;',
  'bool zone[4] = {false, false, false, false}; // A, B, C, D',
  'bool pumpOn = false, fanOn = false;',
  `float dustIntensity = ${DEFAULT_SIMULATOR_INPUTS.dustIntensity}.0;`,
  `float currentPm1 = ${DEFAULT_SIMULATOR_INPUTS.pm1}.0, currentPm2 = ${DEFAULT_SIMULATOR_INPUTS.pm2}.0;`,
  `float windSpeed = ${DEFAULT_SIMULATOR_INPUTS.windSpeed}, windDirection = ${DEFAULT_SIMULATOR_INPUTS.windDirection};`,
  '',
  '// Transparent Weighted Deterministic Risk Score (0-100 pts)',
  '// Dust: 30%, Wind: 20%, Boundary PM: 35%, Humidity: 10%, Temp: 5%',
  'float calculateRiskScore(float dust, float wind, float peakPm, float rh, float temp) {',
  '  float s_dust = (dust / 100.0f) * 30.0f;',
  '  float s_wind = (constrain(wind, 0.0f, 10.0f) / 10.0f) * 20.0f;',
  '  float s_pm   = (constrain(peakPm - 8.0f, 0.0f, 142.0f) / 142.0f) * 35.0f;',
  '  float s_rh   = (1.0f - constrain(rh, 0.0f, 100.0f) / 100.0f) * 10.0f;',
  '  float s_temp = constrain(2.5f + ((temp - 28.0f) / 22.0f) * 2.5f, 0.0f, 5.0f);',
  '  return s_dust + s_wind + s_pm + s_rh + s_temp;',
  '}',
  '',
  '// Directional zone selection based on plume alignment',
  'void applyDirectionalZones(float degrees) {',
  '  float norm = fmod(fmod(degrees, 360.0f) + 360.0f, 360.0f);',
  '  zone[0] = (norm >= 292.5f || norm < 67.5f);   // Zone A (North/NE/NW)',
  '  zone[1] = (norm >= 22.5f && norm < 157.5f);   // Zone B (East/NE/SE)',
  '  zone[2] = (norm >= 112.5f && norm < 247.5f);  // Zone C (South/SE/SW)',
  '  zone[3] = (norm >= 202.5f && norm < 337.5f);  // Zone D (West/SW/NW)',
  '}',
  '',
  '// Variable misting flow rate selection',
  'float getRequiredFlowRate(float score) {',
  '  if (score < 32.0f) return 0.0f;       // Standby',
  '  if (score < 55.0f) return 0.50f;      // Moderate: 0.50 L/min/zone',
  '  if (score < 80.0f) return 0.75f;      // High: 0.75 L/min/zone',
  '  return 1.00f;                         // Very High: 1.00 L/min/zone',
  '}',
  '',
  'void applyAutoControl() {',
  '  float peakPm = max(currentPm1, currentPm2);',
  '  float temp = dht.readTemperature();',
  '  float rh = dht.readHumidity();',
  '  float score = calculateRiskScore(dustIntensity, windSpeed, peakPm, rh, temp);',
  '  if (score < 32.0f && peakPm < 40.0f) {',
  '    for (int i = 0; i < 4; i++) zone[i] = false;',
  '    pumpOn = false;',
  '  } else {',
  '    applyDirectionalZones(windDirection);',
  '    pumpOn = zone[0] || zone[1] || zone[2] || zone[3];',
  '  }',
  '  fanOn = (temp >= 40.0f || score >= 55.0f);',
  '}',
  '',
  'void setup() {',
  '  Serial.begin(115200);',
  '  pmSensor1.begin(9600, SERIAL_8N1, PM1_RX, PM1_TX);',
  '  pmSensor2.begin(9600, SERIAL_8N1, PM2_RX, PM2_TX);',
  '  dht.begin();',
  '  pinMode(RELAY_ZA, OUTPUT); pinMode(RELAY_ZB, OUTPUT);',
  '  pinMode(RELAY_ZC, OUTPUT); pinMode(RELAY_ZD, OUTPUT);',
  '  pinMode(PUMP_PIN, OUTPUT); pinMode(FAN_PIN, OUTPUT);',
  '  pinMode(LED_ZA, OUTPUT); pinMode(LED_ZB, OUTPUT);',
  '  pinMode(LED_ZC, OUTPUT); pinMode(LED_ZD, OUTPUT);',
  '}',
  '',
  'void writeRelayAndActuatorPins() {',
  '  digitalWrite(RELAY_ZA, zone[0] ? HIGH : LOW);',
  '  digitalWrite(RELAY_ZB, zone[1] ? HIGH : LOW);',
  '  digitalWrite(RELAY_ZC, zone[2] ? HIGH : LOW);',
  '  digitalWrite(RELAY_ZD, zone[3] ? HIGH : LOW);',
  '  digitalWrite(LED_ZA, zone[0] ? HIGH : LOW);',
  '  digitalWrite(LED_ZB, zone[1] ? HIGH : LOW);',
  '  digitalWrite(LED_ZC, zone[2] ? HIGH : LOW);',
  '  digitalWrite(LED_ZD, zone[3] ? HIGH : LOW);',
  '  digitalWrite(PUMP_PIN, pumpOn ? HIGH : LOW);',
  '  digitalWrite(FAN_PIN, fanOn ? HIGH : LOW);',
  '}',
  '',
  'void loop() {',
  '  if (mode == AUTO) applyAutoControl();',
  '  writeRelayAndActuatorPins();',
  '  delay(1000);',
  '}',
];

function toneFor(line: string): CodeTone {
  const trimmed = line.trim();
  if (trimmed.startsWith('//')) return 'comment';
  if (trimmed.startsWith('#') || trimmed.startsWith('constexpr') || trimmed.startsWith('enum')) return 'keyword';
  if (/^(void|if \(|for \(|float |ControlMode mode)/.test(trimmed)) return 'fn';
  return 'code';
}

export default function CodePanel() {
  return (
    <aside className="code-panel" aria-label="Arduino-style reference code">
      <div className="code-head">
        <span><Code2 size={15} aria-hidden="true" /> ESP32 Code · Arduino reference</span>
        <span className="code-reference-tag">MULTI-FACTOR LOGIC</span>
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
