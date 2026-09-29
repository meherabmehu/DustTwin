import { Settings } from 'lucide-react';
import { SIMULATION_THRESHOLDS, ZONE_GPIO_MAP } from '../../config/simulationThresholds';
import type { SimulatorState } from './simulatorTypes';

type Props = {
  state: SimulatorState;
  onToggle: (index: number, active: boolean) => void;
};

const ZONE_LABELS = [
  { gpio: ZONE_GPIO_MAP.zone1, sensor: 'Sensor 1', threshold: SIMULATION_THRESHOLDS.pm25Moderate },
  { gpio: ZONE_GPIO_MAP.zone2, sensor: 'Sensor 1', threshold: SIMULATION_THRESHOLDS.pm25High },
  { gpio: ZONE_GPIO_MAP.zone3, sensor: 'Sensor 2', threshold: SIMULATION_THRESHOLDS.pm25Moderate },
  { gpio: ZONE_GPIO_MAP.zone4, sensor: 'Sensor 2', threshold: SIMULATION_THRESHOLDS.pm25High },
];

export default function ZoneStatus({ state, onToggle }: Props) {
  const autoMode = state.mode === 'auto';
  return (
    <article className="output-panel zone-status-panel">
      <h2><Settings aria-hidden="true" /> Zone Status</h2>
      <div className="zone-grid">
        {state.zones.map((active, index) => {
          const mapping = ZONE_LABELS[index];
          return (
            <button
              className={`zone-toggle ${active ? 'active' : ''}`}
              key={index}
              type="button"
              disabled={autoMode}
              aria-pressed={active}
              title={autoMode ? 'Switch to Manual Mode to change this zone' : `Toggle Zone ${index + 1}`}
              onClick={() => onToggle(index, !active)}
            >
              <span className="zone-bulb" aria-hidden="true" />
              <span className="zone-copy"><b>Zone {index + 1}</b><small>GPIO {mapping.gpio}</small></span>
              <strong className="zone-state">{active ? 'ON' : 'OFF'}</strong>
              <small className="zone-source">{mapping.sensor} · ≥{mapping.threshold}</small>
            </button>
          );
        })}
      </div>
      <div className="zone-mapping-note">
        {autoMode
          ? `Auto map: PM2.5 Sensor 1 → Zones 1–2 · Sensor 2 → Zones 3–4 · ${SIMULATION_THRESHOLDS.pm25Moderate}/${SIMULATION_THRESHOLDS.pm25High} µg/m³`
          : 'Manual override active · tap any zone to toggle its relay'}
      </div>
    </article>
  );
}
