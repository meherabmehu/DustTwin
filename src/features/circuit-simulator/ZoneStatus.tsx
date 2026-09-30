import { Settings } from 'lucide-react';
import { ZONE_GPIO_MAP } from '../../config/simulationThresholds';
import type { SimulatorState } from './simulatorTypes';

type Props = {
  state: SimulatorState;
  onToggle: (index: number, active: boolean) => void;
};

const ZONE_METADATA = [
  { id: 'A', name: 'Zone A', direction: 'North', gpio: ZONE_GPIO_MAP.zone1, relay: 'Relay 1', valve: 'Valve A', led: 'LED A' },
  { id: 'B', name: 'Zone B', direction: 'East', gpio: ZONE_GPIO_MAP.zone2, relay: 'Relay 2', valve: 'Valve B', led: 'LED B' },
  { id: 'C', name: 'Zone C', direction: 'South', gpio: ZONE_GPIO_MAP.zone3, relay: 'Relay 3', valve: 'Valve C', led: 'LED C' },
  { id: 'D', name: 'Zone D', direction: 'West', gpio: ZONE_GPIO_MAP.zone4, relay: 'Relay 4', valve: 'Valve D', led: 'LED D' },
];

export default function ZoneStatus({ state, onToggle }: Props) {
  const autoMode = state.mode === 'auto';
  return (
    <article className="output-panel zone-status-panel" aria-label="Circuit zone actuator and relay status">
      <h2><Settings aria-hidden="true" /> Zone Status (Relays & Solenoid Valves)</h2>
      <div className="zone-grid">
        {state.zones.map((active, index) => {
          const mapping = ZONE_METADATA[index];
          return (
            <button
              className={`zone-toggle ${active ? 'active' : ''}`}
              key={mapping.id}
              type="button"
              disabled={autoMode}
              aria-pressed={active}
              title={autoMode ? 'Switch to Manual Mode to change this zone' : `Toggle ${mapping.name} (${mapping.direction})`}
              onClick={() => onToggle(index, !active)}
            >
              <span className="zone-bulb" aria-hidden="true" />
              <span className="zone-copy">
                <b>{mapping.name}</b>
                <small>{mapping.direction} · GPIO {mapping.gpio}</small>
              </span>
              <strong className="zone-state">{active ? 'ACTIVE' : 'STANDBY'}</strong>
              <small className="zone-source">{mapping.relay} · {active ? `${mapping.valve} OPEN` : `${mapping.valve} CLOSED`}</small>
            </button>
          );
        })}
      </div>
      <div className="zone-mapping-note">
        {autoMode
          ? `Auto Directional Mapping: North → Zone A · East → Zone B · South → Zone C · West → Zone D · Target: ${state.predictedDirection} (${state.riskStatus} Risk)`
          : 'Manual Hardware Override Active · Tap any zone card to toggle its relay and valve channel'}
      </div>
    </article>
  );
}
