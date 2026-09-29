import { Droplet, Fan, Play, Settings, Square } from 'lucide-react';
import { SIMULATION_THRESHOLDS } from '../../config/simulationThresholds';
import type { ControlMode, OutputName, SimulatorState } from './simulatorTypes';

type Props = {
  state: SimulatorState;
  onModeChange: (mode: ControlMode) => void;
  onSetAllZones: (active: boolean) => void;
  onToggleOutput: (output: OutputName, active: boolean) => void;
};

export default function SystemControls({ state, onModeChange, onSetAllZones, onToggleOutput }: Props) {
  const autoMode = state.mode === 'auto';
  const allZonesActive = state.zones.every(Boolean);
  return (
    <article className="output-panel system-controls">
      <h2><Settings aria-hidden="true" /> System Controls</h2>
      <div className="mode-row" role="group" aria-label="Control mode">
        <button type="button" className={`mode-btn ${autoMode ? 'active' : ''}`} aria-pressed={autoMode} onClick={() => onModeChange('auto')}>Auto Mode</button>
        <button type="button" className={`mode-btn ${!autoMode ? 'active' : ''}`} aria-pressed={!autoMode} onClick={() => onModeChange('manual')}>Manual Mode</button>
      </div>
      <p className="mode-description">
        {autoMode
          ? `Fixed thresholds · moderate ≥ ${SIMULATION_THRESHOLDS.pm25Moderate} · high ≥ ${SIMULATION_THRESHOLDS.pm25High} µg/m³`
          : 'Manual mode · independently control zones, pump and fan'}
      </p>
      <div className="manual-row">
        <button type="button" className={`small-control-btn ${allZonesActive ? 'active' : ''}`} disabled={autoMode} aria-pressed={allZonesActive} onClick={() => onSetAllZones(true)}>
          <Play size={12} fill="currentColor" /> Turn All Zones ON
        </button>
        <button type="button" className="small-control-btn" disabled={autoMode} aria-pressed={!state.zones.some(Boolean)} onClick={() => onSetAllZones(false)}>
          <Square size={11} /> Turn All Zones OFF
        </button>
      </div>
      <div className="manual-row">
        <button type="button" className={`small-control-btn ${state.pumpOn ? 'active' : ''}`} disabled={autoMode} aria-pressed={state.pumpOn} onClick={() => onToggleOutput('pump', !state.pumpOn)}>
          <Droplet size={13} /> Pump {state.pumpOn ? 'ON' : 'OFF'}
        </button>
        <button type="button" className={`small-control-btn ${state.fanOn ? 'active' : ''}`} disabled={autoMode} aria-pressed={state.fanOn} onClick={() => onToggleOutput('fan', !state.fanOn)}>
          <Fan size={13} /> Fan {state.fanOn ? 'ON' : 'OFF'}
        </button>
      </div>
      <div className="system-status-strip">{state.simulationRunning ? 'Simulator running' : 'Simulator paused'} · {autoMode ? 'threshold control' : 'manual overrides'}</div>
    </article>
  );
}
