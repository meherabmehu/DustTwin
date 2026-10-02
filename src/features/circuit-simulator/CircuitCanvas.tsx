import type { CSSProperties, ReactNode } from 'react';
import { BatteryCharging, Compass, Cpu, Droplet, Fan, Gauge, Power, Settings, Thermometer, Wind, Zap } from 'lucide-react';
import { SIMULATION_PIN_MAP } from '../../config/simulationThresholds';
import { getRiskLevel } from './simulatorEngine';
import type { SimulatorState } from './simulatorTypes';
import OutputStateBadge from './OutputStateBadge';
import WiringLayer from './WiringLayer';

type Props = { state: SimulatorState; zoom: number };

type PartProps = {
  className: string;
  icon: ReactNode;
  name: string;
  children?: ReactNode;
  active?: boolean;
  showState?: boolean;
  stateLabel?: string;
  accessibleLabel?: string;
};

const ZONE_LETTERS = ['Zone A (North)', 'Zone B (East)', 'Zone C (South)', 'Zone D (West)'];

function CircuitPart({ className, icon, name, children, active = false, showState = false, stateLabel, accessibleLabel }: PartProps) {
  return (
    <div
      className={`circuit-part ${className} ${showState ? (active ? 'is-active' : 'is-inactive') : ''}`}
      data-state={showState ? (active ? 'on' : 'off') : undefined}
      role={showState ? 'img' : undefined}
      aria-label={showState ? (accessibleLabel ?? `${name}: ${stateLabel ?? (active ? 'ON' : 'OFF')}`) : undefined}
    >
      {showState && <OutputStateBadge active={active} label={stateLabel} />}
      <div className="part-art">{children ?? icon}</div>
      <div className="part-name">{name}</div>
    </div>
  );
}

function WireLegend() {
  return (
    <div className="wire-legend" aria-label="Wire color key">
      <span><i className="legend-red" />12V</span>
      <span><i className="legend-yellow" />5V</span>
      <span><i className="legend-black" />GND</span>
      <span><i className="legend-blue" />UART</span>
      <span><i className="legend-green" />GPIO</span>
    </div>
  );
}

function compassDirection(degrees: number) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const normalized = ((degrees % 360) + 360) % 360;
  return directions[Math.round(normalized / 45) % directions.length];
}

export default function CircuitCanvas({ state, zoom }: Props) {
  const risk = getRiskLevel(state);
  const anyZoneActive = state.zones.some(Boolean);

  return (
    <div className="circuit-canvas" aria-label="Interactive DustTwin circuit schematic">
      <div className="circuit-board-inner" style={{ '--board-zoom': zoom / 100 } as CSSProperties}>
        <WiringLayer state={state} />

        <CircuitPart
          className="sensor-board anemometer-board"
          icon={<Wind />}
          name={`Anemometer · GPIO ${SIMULATION_PIN_MAP.anemometer}`}
          active={state.simulationRunning}
          showState
          accessibleLabel={`Anemometer wind speed input ${state.windSpeed.toFixed(1)} meters per second on GPIO ${SIMULATION_PIN_MAP.anemometer}`}
        >
          <div className="wind-sensor-readout">
            <Wind aria-hidden="true" />
            <span><strong>{state.windSpeed.toFixed(1)} m/s</strong><small>Wind Speed Sensor</small></span>
          </div>
        </CircuitPart>

        <CircuitPart
          className="sensor-board wind-vane-board"
          icon={<Compass />}
          name={`Wind Vane · GPIO ${SIMULATION_PIN_MAP.windVane}`}
          active={state.simulationRunning}
          showState
          accessibleLabel={`Wind Vane direction input ${state.windDirection} degrees, ${compassDirection(state.windDirection)}, on GPIO ${SIMULATION_PIN_MAP.windVane}`}
        >
          <div className="wind-sensor-readout">
            <Compass aria-hidden="true" />
            <span><strong>{state.windDirection}° / {compassDirection(state.windDirection)}</strong><small>Wind Direction Sensor</small></span>
          </div>
        </CircuitPart>

        <CircuitPart
          className="sensor-board pm-sensor"
          icon={<Gauge />}
          name="PM2.5 / PM10 Sensor 1"
          active={state.simulationRunning}
          showState
        >
          <span className="sensor-chip">PMS5003 · UART1</span>
        </CircuitPart>

        <CircuitPart
          className="sensor-board pm-sensor2"
          icon={<Gauge />}
          name="PM2.5 / PM10 Sensor 2"
          active={state.simulationRunning}
          showState
        >
          <span className="sensor-chip">PMS5003 · UART2</span>
        </CircuitPart>

        <CircuitPart
          className="dht-board"
          icon={<Thermometer />}
          name="DHT22 · T/H · GPIO4"
          active={state.simulationRunning}
          showState
        />

        <CircuitPart
          className="esp-board"
          icon={<Cpu />}
          name="ESP32 DevKit V1"
          active={state.simulationRunning}
          showState
        >
          <span className="esp-chip">
            <small>ESP32</small><b>◉</b><small>WiFi · BLE</small>
          </span>
        </CircuitPart>

        <CircuitPart
          className="relay-board"
          icon={<Settings />}
          name="4 Channel Relay Module (A–D)"
          active={anyZoneActive}
          showState
          stateLabel={anyZoneActive ? 'ACTIVE' : 'STANDBY'}
        >
          <span className="relay-blocks">
            {state.zones.map((active, index) => (
              <i
                className={active ? 'relay-channel active' : 'relay-channel'}
                key={index}
                title={`Relay ${['A', 'B', 'C', 'D'][index]} (${ZONE_LETTERS[index]}): ${active ? 'ON' : 'OFF'}`}
              >
                <small className="relay-tag">{['A', 'B', 'C', 'D'][index]}:{active ? 'ON' : 'OFF'}</small>
              </i>
            ))}
          </span>
        </CircuitPart>

        {state.zones.map((active, index) => (
          <CircuitPart
            className={`valve-part valve-${index + 1}`}
            icon={<Power />}
            name={`${ZONE_LETTERS[index]} Valve`}
            active={active}
            showState
            stateLabel={active ? 'OPEN' : 'CLOSED'}
            key={index}
          />
        ))}

        <CircuitPart
          className="power-part"
          icon={<BatteryCharging />}
          name="12V DC Power Supply"
          active
          showState
        >
          <span className="power-label">12V DC<br /><small>5A</small></span>
        </CircuitPart>

        <CircuitPart
          className="buck-part"
          icon={<Zap />}
          name="12V → 5V Buck Converter"
          active={state.simulationRunning}
          showState
        >
          <span className="buck-chip">5V OUT</span>
        </CircuitPart>

        <CircuitPart
          className="pump-part"
          icon={<Droplet />}
          name={`12V DC Water Pump · GPIO ${SIMULATION_PIN_MAP.pump}`}
          active={state.pumpOn}
          showState
        />

        <CircuitPart
          className="fan-part"
          icon={<Fan />}
          name={`12V DC Fan · GPIO ${SIMULATION_PIN_MAP.fan}`}
          active={state.fanOn}
          showState
          accessibleLabel={`12V DC Fan simulates site airflow; GPIO ${SIMULATION_PIN_MAP.fan}; ${state.fanOn ? 'ON' : 'OFF'}`}
        />

        <div className="circuit-part led-bank" role="img" aria-label={`Zone indicator LEDs, air quality ${risk}`}>
          <div className="part-art">
            {state.zones.map((active, index) => (
              <span
                className={`led-dot ${active ? (risk === 'HIGH' || risk === 'VERY HIGH' ? 'danger' : 'on') : ''}`}
                key={index}
                title={`${ZONE_LETTERS[index]} LED ${active ? 'ON' : 'OFF'}`}
              />
            ))}
          </div>
          <div className="part-name">Zone A–D LEDs</div>
        </div>
      </div>

      <WireLegend />
    </div>
  );
}
