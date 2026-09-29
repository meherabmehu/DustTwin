import { SIMULATION_PIN_MAP } from '../../config/simulationThresholds';
import type { SimulatorState } from './simulatorTypes';

type Props = { state: SimulatorState };

export default function WiringLayer({ state }: Props) {
  const isRunning = state.simulationRunning;
  const zone = state.zones;
  return (
    <svg className="wire-layer" viewBox="0 0 1000 650" preserveAspectRatio="none" role="img" aria-label="DustTwin circuit wiring diagram with power, ground, UART and GPIO connections">
      <title>DustTwin wiring map · red 12 volt · yellow 5 volt · black ground · blue UART · green GPIO</title>
      <defs>
        <filter id="wireGlow"><feGaussianBlur stdDeviation="2.1" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>

      {/* PM sensor UART and DHT22 data */}
      <g className={isRunning ? 'wire-bundle wire-flowing' : 'wire-bundle'}>
        <path className="wire-blue" d="M220 143 H305 V176 H380"><title>Sensor 1 TX {SIMULATION_PIN_MAP.pmSensor1.tx} to ESP32 RX {SIMULATION_PIN_MAP.pmSensor1.rx}</title></path>
        <path className="wire-blue" d="M380 192 H290 V132 H220"><title>ESP32 TX {SIMULATION_PIN_MAP.pmSensor1.tx} to Sensor 1 RX {SIMULATION_PIN_MAP.pmSensor1.rx}</title></path>
        <path className="wire-blue" d="M220 298 H326 V316 H380"><title>Sensor 2 TX {SIMULATION_PIN_MAP.pmSensor2.tx} to ESP32 RX {SIMULATION_PIN_MAP.pmSensor2.rx}</title></path>
        <path className="wire-blue" d="M380 333 H312 V282 H220"><title>ESP32 TX {SIMULATION_PIN_MAP.pmSensor2.tx} to Sensor 2 RX {SIMULATION_PIN_MAP.pmSensor2.rx}</title></path>
        <path className="wire-green" d="M260 457 H342 V244 H380"><title>DHT22 data to ESP32 GPIO {SIMULATION_PIN_MAP.dht22}</title></path>
      </g>

      {/* ESP32 GPIO relay signals, one trace for each misting zone */}
      <path className={`wire-green ${zone[0] ? 'wire-zone-active' : ''}`} d="M530 178 H583 V186 H610"><title>ESP32 GPIO {SIMULATION_PIN_MAP.relayZones.zone1} to relay channel 1 / Zone 1</title></path>
      <path className={`wire-green ${zone[1] ? 'wire-zone-active' : ''}`} d="M530 228 H592 V238 H610"><title>ESP32 GPIO {SIMULATION_PIN_MAP.relayZones.zone2} to relay channel 2 / Zone 2</title></path>
      <path className={`wire-green ${zone[2] ? 'wire-zone-active' : ''}`} d="M530 280 H598 V290 H610"><title>ESP32 GPIO {SIMULATION_PIN_MAP.relayZones.zone3} to relay channel 3 / Zone 3</title></path>
      <path className={`wire-green ${zone[3] ? 'wire-zone-active' : ''}`} d="M530 332 H603 V342 H610"><title>ESP32 GPIO {SIMULATION_PIN_MAP.relayZones.zone4} to relay channel 4 / Zone 4</title></path>
      <path className={`wire-green ${state.pumpOn ? 'wire-zone-active' : ''}`} d="M530 365 H548 V516 H620 V548"><title>ESP32 GPIO {SIMULATION_PIN_MAP.pump} pump-driver control</title></path>
      <path className={`wire-green ${state.fanOn ? 'wire-zone-active' : ''}`} d="M530 384 H556 V507 H780 V548"><title>ESP32 GPIO {SIMULATION_PIN_MAP.fan} fan-driver control</title></path>

      {/* Switched 12 V relay outputs to four normally-closed zone valves */}
      <path className={`wire-red ${zone[0] ? 'wire-zone-active' : ''}`} d="M760 186 H792 V104 H830"><title>Relay 1 switched 12 volt supply to Zone 1 valve</title></path>
      <path className={`wire-red ${zone[1] ? 'wire-zone-active' : ''}`} d="M760 238 H800 V222 H830"><title>Relay 2 switched 12 volt supply to Zone 2 valve</title></path>
      <path className={`wire-red ${zone[2] ? 'wire-zone-active' : ''}`} d="M760 290 H804 V340 H830"><title>Relay 3 switched 12 volt supply to Zone 3 valve</title></path>
      <path className={`wire-red ${zone[3] ? 'wire-zone-active' : ''}`} d="M760 342 H810 V458 H830"><title>Relay 4 switched 12 volt supply to Zone 4 valve</title></path>

      {/* 12 V distribution from supply to relays, pump and fan */}
      <path className={`wire-red ${state.pumpOn ? 'wire-zone-active' : ''}`} d="M240 574 H520 V592 H560"><title>12 volt supply positive to water pump</title></path>
      <path className={`wire-red ${state.fanOn ? 'wire-zone-active' : ''}`} d="M520 592 H700 V590 H720"><title>12 volt distribution to cooling fan</title></path>
      <path className="wire-red" d="M240 560 H258 V525 H542 V420 H586 V208 H610"><title>12 volt supply positive to relay common contacts</title></path>
      <path className="wire-red" d="M542 525 H818 V498 H858"><title>12 volt actuator distribution rail</title></path>

      {/* Buck converter 5 V rails */}
      <path className="wire-yellow" d="M420 558 H435 V82 H260 V122 H220"><title>5 volt regulated rail to PM sensor 1</title></path>
      <path className="wire-yellow" d="M260 82 V278 H220"><title>5 volt regulated rail to PM sensor 2</title></path>
      <path className="wire-yellow" d="M260 82 V450 H260"><title>5 volt regulated rail to DHT22</title></path>
      <path className="wire-yellow" d="M435 82 H520 V156 H500"><title>5 volt regulated rail to ESP32 VIN</title></path>
      <path className="wire-yellow" d="M520 156 H600 V170 H610"><title>5 volt relay-module logic supply</title></path>
      <path className="wire-red" d="M240 596 H272 V582 H280"><title>12 volt input to 5 volt buck converter</title></path>

      {/* Shared ground bus */}
      <path className="wire-black" d="M72 610 V626 H962" />
      <path className="wire-black" d="M155 594 V626 M350 574 V626 M455 416 V480 H350 M620 590 V626 M780 590 V626 M914 586 V626" />
      <path className="wire-black" d="M215 188 V204 H350 V416 M215 343 V360 H350 M260 480 V500 H350" />

      <g className="wire-pin-labels" aria-hidden="true">
        <text x="309" y="168">UART 1 · RX16/TX17</text>
        <text x="318" y="309">UART 2 · RX25/TX26</text>
        <text x="343" y="237">DHT · GPIO4</text>
        <text x="544" y="173">GPIO {SIMULATION_PIN_MAP.relayZones.zone1}</text>
        <text x="548" y="225">GPIO {SIMULATION_PIN_MAP.relayZones.zone2}</text>
        <text x="548" y="277">GPIO {SIMULATION_PIN_MAP.relayZones.zone3}</text>
        <text x="548" y="329">GPIO {SIMULATION_PIN_MAP.relayZones.zone4}</text>
        <text x="293" y="72">5V REGULATED</text>
        <text x="282" y="618">COMMON GND</text>
      </g>
    </svg>
  );
}
