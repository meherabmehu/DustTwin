import { Droplet, Fan, Power, Settings } from 'lucide-react';
import { ZONE_GPIO_MAP } from '../../config/simulationThresholds';
import type { SimulatorState } from './simulatorTypes';

type Props = {
  state: SimulatorState;
  onToggle: (index: number, active: boolean) => void;
};

const ZONE_METADATA = [
  {
    id: 'A',
    name: 'Zone A - North',
    gpio: ZONE_GPIO_MAP.zone1,
    relay: 'Relay 1 - Valve A',
    subtitle: 'Misting Valve',
    icon: <Droplet size={14} />,
  },
  {
    id: 'B',
    name: 'Zone B - East',
    gpio: ZONE_GPIO_MAP.zone2,
    relay: 'Relay 2 - Valve B',
    subtitle: 'Misting Valve',
    icon: <Settings size={14} />,
  },
  {
    id: 'C',
    name: 'Zone C - South',
    gpio: ZONE_GPIO_MAP.zone3,
    relay: 'Relay 3 - Valve C',
    subtitle: 'Water Pump',
    icon: <Power size={14} />,
  },
  {
    id: 'D',
    name: 'Zone D - West',
    gpio: ZONE_GPIO_MAP.zone4,
    relay: 'Relay 4 - Valve D',
    subtitle: 'Fan / Exhaust',
    icon: <Fan size={14} />,
  },
];

export default function ZoneStatus({ state, onToggle }: Props) {
  const autoMode = state.mode === 'auto';

  return (
    <article className="output-panel zone-status-panel" aria-label="Circuit zone actuator and relay status">
      <div className="zone-status-header">
        <h2><Settings size={15} aria-hidden="true" /> Zone Status (Relays &amp; Solenoid Valves)</h2>
      </div>

      <div className="zone-grid-cards">
        {state.zones.map((active, index) => {
          const m = ZONE_METADATA[index];
          return (
            <button
              className={`zone-card ${active ? 'is-active' : 'is-standby'}`}
              key={m.id}
              type="button"
              disabled={autoMode}
              aria-pressed={active}
              title={autoMode ? 'Switch to Manual Mode to toggle this zone' : `Toggle ${m.name}`}
              onClick={() => onToggle(index, !active)}
            >
              <div className="zone-card-top">
                <span className="zone-card-name">{m.name}</span>
                <span className={`zone-card-pill ${active ? 'active' : 'standby'}`}>
                  {active ? 'ACTIVE' : 'STANDBY'}
                </span>
              </div>

              <div className="zone-card-body">
                <div className="zone-card-icon" aria-hidden="true">
                  {m.icon}
                </div>
                <div className="zone-card-info">
                  <span className="zone-gpio">GPIO {m.gpio}</span>
                  <span className="zone-relay-name">{m.relay}</span>
                  <span className="zone-subtext">{m.subtitle}</span>
                </div>
                <div className="zone-card-state">
                  <span className={`zone-state-indicator ${active ? 'on' : 'off'}`}>
                    <i className="zone-state-dot" /> {active ? 'ON' : 'OFF'}
                  </span>
                  <span className="zone-valve-state">{active ? 'OPEN' : 'CLOSED'}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="zone-mapping-footer">
        <p>Auto Directional Mapping: North → Zone A · East → Zone B · South → Zone C · West → Zone D</p>
        <p className="zone-target-text">
          Current Target: {state.predictedDirection} (Based on Risk &amp; Wind Direction)
        </p>
      </div>
    </article>
  );
}
