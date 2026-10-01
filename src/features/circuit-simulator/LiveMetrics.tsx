import { Activity, Droplet, Gauge, ShieldCheck, Thermometer, Waves } from 'lucide-react';
import { SIMULATION_THRESHOLDS } from '../../config/simulationThresholds';
import type { SimulatorState } from './simulatorTypes';

type Props = { state: SimulatorState };

const ZONE_NAMES = ['Zone A', 'Zone B', 'Zone C', 'Zone D'];

export default function LiveMetrics({ state }: Props) {
  const activeZoneNames = state.zones
    .map((active, index) => (active ? ZONE_NAMES[index] : null))
    .filter((name): name is string => name !== null);
  const activeZonesLabel = activeZoneNames.length ? activeZoneNames.join(' · ') : 'None (Standby)';
  const riskClass = state.riskStatus.toLowerCase().replace(' ', '-');

  return (
    <article className="output-panel live-metrics-panel" aria-label="Circuit simulation live output metrics">
      <div className="output-panel-header">
        <h2>
          <Activity aria-hidden="true" /> Live Simulation Output
        </h2>
        <div className="output-header-badges">
          <span className={`status-pill ${state.simulationRunning ? 'is-running' : 'is-stopped'}`}>
            <i className="status-dot" />{state.simulationRunning ? 'RUNNING' : 'STOPPED'}
          </span>
          <span className={`risk-pill risk-${riskClass}`}>
            <ShieldCheck size={11} aria-hidden="true" style={{ marginRight: 3, verticalAlign: -1 }} />
            {state.riskStatus} RISK ({state.riskScore}/100)
          </span>
        </div>
      </div>

      <div className="output-metrics">
        <div className="output-metric">
          <small>PM2.5 · Sensor 1</small>
          <strong><Gauge size={13} aria-hidden="true" /> {state.pm1} µg/m³</strong>
          <span>Derived PM10: {state.pm10_1} µg/m³</span>
        </div>
        <div className="output-metric">
          <small>PM10 · Sensor 2</small>
          <strong><Gauge size={13} aria-hidden="true" /> {state.pm2} µg/m³</strong>
          <span>Derived PM10: {state.pm10_2} µg/m³</span>
        </div>
        <div className="output-metric">
          <small>Ambient Temperature</small>
          <strong><Thermometer size={13} aria-hidden="true" /> {state.temperature.toFixed(1)}°C</strong>
          <span>{state.temperature >= SIMULATION_THRESHOLDS.temperatureWarningC ? 'High dispersion' : 'Baseline 28°C'}</span>
        </div>
        <div className="output-metric">
          <small>Relative Humidity</small>
          <strong><Droplet size={13} aria-hidden="true" /> {state.humidity}% RH</strong>
          <span>{state.humidity >= SIMULATION_THRESHOLDS.humidityWarningPercent ? 'Settling enhanced' : 'Normal'}</span>
        </div>
      </div>

      <div className="output-metrics" style={{ marginTop: '6px' }}>
        <div className="output-metric">
          <small>Active Misting Zones</small>
          <strong>{state.simulationRunning && activeZoneNames.length ? activeZonesLabel : 'None (Standby)'}</strong>
          <span>{state.simulationRunning ? `Targeted: ${state.predictedDirection}` : `Targeted: ${state.predictedDirection} (Standby)`}</span>
        </div>
        <div className="output-metric">
          <small>Required System Flow</small>
          <strong><Waves size={13} aria-hidden="true" /> {state.simulationRunning ? `${state.requiredFlowLpm.toFixed(2)} L/min` : '0.00 L/min'}</strong>
          <span>{state.simulationRunning && state.flowPerZoneLpm > 0 ? `${state.flowPerZoneLpm.toFixed(2)} L/min / zone` : 'Hardware Standby'}</span>
        </div>
        <div className="output-metric">
          <small>Estimated Duration</small>
          <strong>{state.simulationRunning ? `${state.mistingDurationSeconds} sec` : '0 sec (Standby)'}</strong>
          <span>{state.simulationRunning ? 'Targeted suppression burst' : 'Click Run Scenario to spray'}</span>
        </div>
        <div className="output-metric">
          <small>Projected Water Use</small>
          <strong><Droplet size={13} aria-hidden="true" /> {state.simulationRunning ? `${state.projectedWaterL.toFixed(2)} L` : '0.00 L'}</strong>
          <span>Pump State: <b>{state.pumpOn ? 'ENERGIZED (ON)' : 'STANDBY (OFF)'}</b></span>
        </div>
      </div>
    </article>
  );
}
