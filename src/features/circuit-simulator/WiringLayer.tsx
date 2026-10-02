import { SIMULATION_PIN_MAP } from '../../config/simulationThresholds';
import type { SimulatorState } from './simulatorTypes';

type Props = { state: SimulatorState };

export default function WiringLayer({ state }: Props) {
  const isRunning = state.simulationRunning;
  const zone = state.zones;
  return (
    <svg className="wire-layer" viewBox="0 0 1000 650" preserveAspectRatio="none" role="img" aria-label="DustTwin circuit wiring diagram including Anemometer GPIO 32 and Wind Vane GPIO 33 inputs, power, ground, UART and GPIO connections">
      <title>DustTwin wiring map · wind sensors on GPIO 32 and 33 · red 12 volt · yellow 5 volt · black ground · blue UART · green GPIO</title>
      <defs>
        <filter id="wireGlow"><feGaussianBlur stdDeviation="2.1" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>

      {/* Wind, PM and DHT22 sensor data inputs */}
      <g className={isRunning ? 'wire-bundle wire-flowing' : 'wire-bundle'}>
        <path className="wire-green" d="M280 85 H328 V145 H380"><title>Anemometer wind speed input to ESP32 GPIO {SIMULATION_PIN_MAP.anemometer}</title></path>
        <path className="wire-green" d="M280 168 H358 V210 H380"><title>Wind Vane direction input to ESP32 GPIO {SIMULATION_PIN_MAP.windVane}</title></path>
        <path className="wire-blue" d="M280 255 H318 V238 H380"><title>Sensor 1 TX {SIMULATION_PIN_MAP.pmSensor1.tx} to ESP32 RX {SIMULATION_PIN_MAP.pmSensor1.rx}</title></path>
        <path className="wire-blue" d="M380 255 H348 V280 H280"><title>ESP32 TX {SIMULATION_PIN_MAP.pmSensor1.tx} to Sensor 1 RX {SIMULATION_PIN_MAP.pmSensor1.rx}</title></path>
        <path className="wire-blue" d="M280 353 H328 V297 H380"><title>Sensor 2 TX {SIMULATION_PIN_MAP.pmSensor2.tx} to ESP32 RX {SIMULATION_PIN_MAP.pmSensor2.rx}</title></path>
        <path className="wire-blue" d="M380 315 H360 V379 H280"><title>ESP32 TX {SIMULATION_PIN_MAP.pmSensor2.tx} to Sensor 2 RX {SIMULATION_PIN_MAP.pmSensor2.rx}</title></path>
        <path className="wire-green" d="M280 463 H340 V389 H380"><title>DHT22 data to ESP32 GPIO {SIMULATION_PIN_MAP.dht22}</title></path>
      </g>

      {/* 5 V sensor supply branches and the shared sensor ground rail */}
      <path className="wire-yellow" d="M420 558 H435 V38 H25 V442" />
      <path className="wire-yellow" d="M25 64 H50 M25 148 H50 M25 246 H50 M25 344 H50 M25 442 H50"><title>5 volt regulated sensor supply to Anemometer, Wind Vane, PM sensors and DHT22</title></path>
      <path className="wire-yellow" d="M435 38 H520 V156 H500"><title>5 volt regulated rail to ESP32 VIN</title></path>
      <path className="wire-yellow" d="M520 156 H600 V170 H610"><title>5 volt relay-module logic supply</title></path>
      <path className="wire-red" d="M240 596 H272 V582 H280"><title>12 volt input to 5 volt buck converter</title></path>
      <path className="wire-black" d="M72 610 V626 H962 M40 626 V103" />
      <path className="wire-black" d="M40 103 H50 M40 185 H50 M40 283 H50 M40 380 H50 M40 478 H50"><title>Shared sensor ground</title></path>
      <path className="wire-black" d="M155 594 V626 M350 574 V626 M455 416 V480 H350 M620 590 V626 M780 590 V626 M914 586 V626" />

      {/* ESP32 GPIO relay signals, one trace for each misting zone */}
      <path className={`wire-green ${zone[0] ? 'wire-zone-active' : ''}`} d="M530 178 H583 V186 H610"><title>ESP32 GPIO {SIMULATION_PIN_MAP.relayZones.zone1} to relay channel 1 / Zone 1</title></path>
      <path className={`wire-green ${zone[1] ? 'wire-zone-active' : ''}`} d="M530 228 H592 V238 H610"><title>ESP32 GPIO {SIMULATION_PIN_MAP.relayZones.zone2} to relay channel 2 / Zone 2</title></path>
      <path className={`wire-green ${zone[2] ? 'wire-zone-active' : ''}`} d="M530 280 H598 V290 H610"><title>ESP32 GPIO {SIMULATION_PIN_MAP.relayZones.zone3} to relay channel 3 / Zone 3</title></path>
      <path className={`wire-green ${zone[3] ? 'wire-zone-active' : ''}`} d="M530 332 H603 V342 H610"><title>ESP32 GPIO {SIMULATION_PIN_MAP.relayZones.zone4} to relay channel 4 / Zone 4</title></path>
      <path className={`wire-green ${state.pumpOn ? 'wire-zone-active' : ''}`} d="M530 365 H548 V516 H620 V548"><title>ESP32 GPIO {SIMULATION_PIN_MAP.pump} pump-driver control</title></path>
      <path className={`wire-green ${state.fanOn ? 'wire-zone-active' : ''}`} d="M530 384 H556 V507 H780 V548"><title>ESP32 GPIO {SIMULATION_PIN_MAP.fan} site airflow fan control</title></path>

      {/* Switched 12 V relay outputs to four normally-closed zone valves */}
      <path className={`wire-red ${zone[0] ? 'wire-zone-active' : ''}`} d="M760 186 H792 V104 H830"><title>Relay 1 switched 12 volt supply to Zone 1 valve</title></path>
      <path className={`wire-red ${zone[1] ? 'wire-zone-active' : ''}`} d="M760 238 H800 V222 H830"><title>Relay 2 switched 12 volt supply to Zone 2 valve</title></path>
      <path className={`wire-red ${zone[2] ? 'wire-zone-active' : ''}`} d="M760 290 H804 V340 H830"><title>Relay 3 switched 12 volt supply to Zone 3 valve</title></path>
      <path className={`wire-red ${zone[3] ? 'wire-zone-active' : ''}`} d="M760 342 H810 V458 H830"><title>Relay 4 switched 12 volt supply to Zone 4 valve</title></path>

      {/* 12 V distribution from supply to relays, pump and airflow fan */}
      <path className={`wire-red ${state.pumpOn ? 'wire-zone-active' : ''}`} d="M240 574 H520 V592 H560"><title>12 volt supply positive to water pump</title></path>
      <path className={`wire-red ${state.fanOn ? 'wire-zone-active' : ''}`} d="M520 592 H700 V590 H720"><title>12 volt distribution to site airflow fan</title></path>
      <path className="wire-red" d="M240 560 H258 V525 H542 V420 H586 V208 H610"><title>12 volt supply positive to relay common contacts</title></path>
      <path className="wire-red" d="M542 525 H818 V498 H858"><title>12 volt actuator distribution rail</title></path>

      <g className="wire-pin-labels" aria-hidden="true">
        <text x="284" y="77">GPIO {SIMULATION_PIN_MAP.anemometer}</text>
        <text x="284" y="160">GPIO {SIMULATION_PIN_MAP.windVane}</text>
        <text x="284" y="231">UART 1 · RX16/TX17</text>
        <text x="284" y="328">UART 2 · RX25/TX26</text>
        <text x="284" y="455">DHT · GPIO {SIMULATION_PIN_MAP.dht22}</text>
        <text x="544" y="173">GPIO {SIMULATION_PIN_MAP.relayZones.zone1}</text>
        <text x="548" y="225">GPIO {SIMULATION_PIN_MAP.relayZones.zone2}</text>
        <text x="548" y="277">GPIO {SIMULATION_PIN_MAP.relayZones.zone3}</text>
        <text x="548" y="329">GPIO {SIMULATION_PIN_MAP.relayZones.zone4}</text>
        <text x="28" y="32">5V SENSOR RAIL</text>
        <text x="282" y="618">COMMON GND</text>
      </g>
    </svg>
  );
}
