import { useEffect, useState } from 'react';
import { Maximize2, Minus, Play, Plus, RotateCcw, Square } from 'lucide-react';
import type { SimulatorState } from './simulatorTypes';

type Props = {
  state: SimulatorState;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onRun: () => void;
  onStop: () => void;
  onReset: () => void;
};

export default function CircuitToolbar({ state, zoom, onZoomChange, onRun, onStop, onReset }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const outputsActive = state.zones.some(Boolean) || state.pumpOn || state.fanOn;

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    const workspace = document.querySelector<HTMLElement>('.circuit-workspace');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (workspace?.requestFullscreen) await workspace.requestFullscreen();
    } catch {
      // Fullscreen can be disabled by browser or embedding permissions; the circuit remains usable.
    }
  };

  return (
    <div className="workspace-toolbar" role="toolbar" aria-label="Circuit simulation controls">
      <button type="button" className="tool-button run" onClick={onRun} disabled={state.simulationRunning}>
        <Play size={13} fill="currentColor" aria-hidden="true" />Run
      </button>
      <button type="button" className="tool-button stop" onClick={onStop} disabled={!state.simulationRunning && !outputsActive}>
        <Square size={12} fill="currentColor" aria-hidden="true" />Stop
      </button>
      <button type="button" className="tool-button" onClick={onReset} aria-label="Reset simulation">
        <RotateCcw size={13} aria-hidden="true" />Reset
      </button>
      <span className="toolbar-spacer" />
      <div className="zoom-controls" role="group" aria-label="Circuit zoom controls">
        <button type="button" aria-label="Zoom out" onClick={() => onZoomChange(Math.max(70, zoom - 10))} disabled={zoom <= 70}><Minus size={12} aria-hidden="true" /></button>
        <span className="zoom-label" aria-live="polite">{zoom}%</span>
        <button type="button" aria-label="Zoom in" onClick={() => onZoomChange(Math.min(130, zoom + 10))} disabled={zoom >= 130}><Plus size={12} aria-hidden="true" /></button>
      </div>
      <button type="button" className="tool-button fullscreen-btn" onClick={() => void toggleFullscreen()} aria-label={isFullscreen ? 'Exit fullscreen circuit' : 'Fullscreen circuit'} title={isFullscreen ? 'Exit fullscreen circuit' : 'Fullscreen circuit'}>
        <Maximize2 size={13} aria-hidden="true" />
      </button>
    </div>
  );
}
