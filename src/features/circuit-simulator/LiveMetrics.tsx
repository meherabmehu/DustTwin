import { Activity, Droplet, Thermometer } from 'lucide-react';
import { formatElapsedTime, getRiskLevel } from './simulatorEngine';
import type { SimulatorState } from './simulatorTypes';

type Props = { state: SimulatorState };

export default function LiveMetrics({ state }: Props) {
  const risk = getRiskLevel(state);
  return (
    <article className="output-panel live-metrics-panel">
      <h2>
        <Activity aria-hidden="true" /> Live Simulation Output
        <span className="status-pill" style={{ marginLeft: 'auto' }}><i />{state.simulationRunning ? 'RUNNING' : 'STOPPED'}</span>
        <span className={`risk-pill risk-${risk}`}>{risk.toUpperCase()} RISK</span>
        <span className="runtime-chip">{formatElapsedTime(state.elapsedSeconds)}</span>
      </h2>
      <div className="output-metrics">
        <div className="output-metric">
          <small>PM2.5 · Sensor 1</small>
          <strong>☀ {state.pm1} µg/m³</strong>
          <span>Derived PM10 · {state.pm10_1} µg/m³</span>
        </div>
        <div className="output-metric">
          <small>PM2.5 · Sensor 2</small>
          <strong>☀ {state.pm2} µg/m³</strong>
          <span>Derived PM10 · {state.pm10_2} µg/m³</span>
        </div>
        <div className="output-metric">
          <small>Temperature</small>
          <strong><Thermometer size={14} /> {state.temperature.toFixed(1)}°C</strong>
          <span>{state.temperature >= 40 ? 'High' : 'Normal'}</span>
        </div>
        <div className="output-metric">
          <small>Humidity</small>
          <strong><Droplet size={14} /> {state.humidity}%</strong>
          <span>{state.humidity >= 80 ? 'High' : 'Normal'}</span>
        </div>
      </div>
    </article>
  );
}
