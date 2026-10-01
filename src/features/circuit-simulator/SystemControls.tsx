import { useState } from 'react';
import { Compass, Cpu, Droplet, Fan, Play, Settings, Square } from 'lucide-react';
import type { ControlMode, OutputName, SimulatorState } from './simulatorTypes';

type Props = {
  state: SimulatorState;
  onModeChange: (mode: ControlMode) => void;
  onSetAllZones: (active: boolean) => void;
  onToggleOutput: (output: OutputName, active: boolean) => void;
  aiOptimized?: boolean;
  onToggleAiOptimization?: () => void;
};

export default function SystemControls({
  state,
  onModeChange,
  onSetAllZones,
  onToggleOutput,
  aiOptimized = true,
  onToggleAiOptimization,
}: Props) {
  const autoMode = state.mode === 'auto';
  const allZonesActive = state.zones.every(Boolean);

  return (
    <article className="output-panel system-controls-panel" aria-label="System control mode and overrides">
      <div className="system-controls-header">
        <h2><Settings size={15} aria-hidden="true" /> System Controls</h2>
      </div>

      <div className="system-mode-tabs" role="group" aria-label="Control mode">
        <button
          type="button"
          className={`system-mode-tab ${autoMode ? 'active' : ''}`}
          aria-pressed={autoMode}
          onClick={() => onModeChange('auto')}
        >
          Auto Mode
        </button>
        <button
          type="button"
          className={`system-mode-tab ${!autoMode ? 'active' : ''}`}
          aria-pressed={!autoMode}
          onClick={() => onModeChange('manual')}
        >
          Manual Mode
        </button>
      </div>

      <p className="system-mode-desc">
        {autoMode
          ? `Auto decision mode · Combined risk (${state.riskStatus}) & directional targeting toward ${state.predictedDirection}`
          : 'Manual mode · Independently override Zone A–D relays, high-pressure pump and fan'}
      </p>

      <div className="system-ctrl-row">
        <button
          type="button"
          className={`system-ctrl-btn ${allZonesActive ? 'active' : ''}`}
          disabled={autoMode}
          aria-pressed={allZonesActive}
          onClick={() => onSetAllZones(true)}
        >
          <Play size={11} fill="currentColor" aria-hidden="true" /> Turn All Zones ON
        </button>
        <button
          type="button"
          className="system-ctrl-btn"
          disabled={autoMode}
          aria-pressed={!state.zones.some(Boolean)}
          onClick={() => onSetAllZones(false)}
        >
          <Square size={10} aria-hidden="true" /> Turn All Zones OFF
        </button>
      </div>

      <div className="system-ctrl-row">
        <button
          type="button"
          className={`system-ctrl-btn ${state.pumpOn ? 'active' : ''}`}
          disabled={autoMode}
          aria-pressed={state.pumpOn}
          onClick={() => onToggleOutput('pump', !state.pumpOn)}
        >
          <Droplet size={12} aria-hidden="true" /> Pump {state.pumpOn ? 'ON' : 'OFF'}
        </button>
        <button
          type="button"
          className={`system-ctrl-btn ${state.fanOn ? 'active' : ''}`}
          disabled={autoMode}
          aria-pressed={state.fanOn}
          onClick={() => onToggleOutput('fan', !state.fanOn)}
        >
          <Fan size={12} aria-hidden="true" /> Fan {state.fanOn ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Bottom two info widgets matching reference */}
      <div className="system-strategy-cards">
        <div
          className={`strategy-mini-card ai-card ${aiOptimized ? 'is-active' : ''}`}
          role="button"
          tabIndex={0}
          onClick={onToggleAiOptimization}
          title="Toggle AI Optimization"
        >
          <div className="strategy-mini-icon purple" aria-hidden="true">
            <Cpu size={14} />
          </div>
          <div className="strategy-mini-content">
            <span className="strategy-mini-label">AI Control</span>
            <strong className="strategy-mini-val purple">AI Optimization</strong>
            <small className="strategy-mini-sub">Use AI predictions for proactive zone control</small>
          </div>
        </div>

        <div className="strategy-mini-card strategy-card">
          <div className="strategy-mini-icon cyan" aria-hidden="true">
            <Compass size={14} />
          </div>
          <div className="strategy-mini-content">
            <span className="strategy-mini-label">Current Strategy</span>
            <strong className="strategy-mini-val cyan">Directional Targeting</strong>
            <small className="strategy-mini-sub">Focus on {state.predictedDirection} (Wind: {state.windDirection}°)</small>
          </div>
        </div>
      </div>
    </article>
  );
}
