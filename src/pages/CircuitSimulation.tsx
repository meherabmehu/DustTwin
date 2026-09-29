import { useState } from 'react';
import { Activity, Cpu, Droplet, Maximize2, Minus, Monitor, Play, Plus, RotateCcw, Settings, Square, Thermometer, Waves, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatElapsedTime, getRiskLevel } from '../features/circuit-simulator/simulatorEngine';
import { useSimulator } from '../features/circuit-simulator/useSimulator';
import SensorInputs from '../features/circuit-simulator/SensorInputs';
import SystemControls from '../features/circuit-simulator/SystemControls';
import ZoneStatus from '../features/circuit-simulator/ZoneStatus';
import SerialMonitor from '../features/circuit-simulator/SerialMonitor';
import CircuitCanvas from '../features/circuit-simulator/CircuitCanvas';
import CodePanel from '../features/circuit-simulator/CodePanel';
import ComponentSidebar from '../features/circuit-simulator/ComponentSidebar';

export default function CircuitSimulation() {
  const { state, dispatch } = useSimulator();
  const [zoom, setZoom] = useState(100);
  const running = state.simulationRunning;
  const zones = state.zones;
  const pm1 = state.pm1;
  const pm2 = state.pm2;
  const temperature = state.temperature;
  const humidity = state.humidity;
  const pumpOn = state.pumpOn;
  const fanOn = state.fanOn;
  const risk = getRiskLevel(state);

  const reset = () => { dispatch({ type: 'RESET' }); setZoom(100); };

  return (
    <div className="circuit-page">
        <section className="circuit-intro">
          <div className="circuit-title"><div className="eyebrow">CUSTOM HARDWARE SIMULATOR <span>•</span> IoT <span>FOR CLEANER, SAFER COMMUNITIES</span></div><h1>DustTwin <span>Circuit Simulation</span></h1><p>Design, simulate and test the DustTwin hardware in your browser.<br />A complete IoT dust control system with sensors, actuators and real-time feedback.</p></div>
          <div className="circuit-features">
            <Feature icon={<Monitor />} title="Browser-based" detail="No installation\nJust open and simulate" />
            <Feature icon={<Cpu />} title="Real hardware" detail="Use actual components\nlike ESP32, sensors, relays" />
            <Feature icon={<Settings />} title="Test logic" detail="Validate control logic\nand zone activation" />
            <Feature icon={<BarIcon />} title="See results" detail="Real-time sensor data\nand system behavior" />
          </div>
        </section>
        <nav className="circuit-tabs" aria-label="DustTwin demo modules">
          <Link to="/"><Waves />Overview</Link><Link to="/simulation"><Activity />Live Simulation</Link><Link to="/results"><BarIcon />Analytics Dashboard</Link><Link className="active" to="/circuit-simulation"><Cpu />Circuit Simulation</Link><Link to="/prototype"><Zap />Prototype Model</Link><Link to="/results"><Activity />Results & Impact</Link>
        </nav>

        <div className="circuit-shell">
          <ComponentSidebar />

          <section className="circuit-workspace">
            <div className="workspace-toolbar">
              <button className="tool-button run" onClick={() => dispatch({ type: 'RUN' })} disabled={running}><Play size={13} fill="currentColor" />Run</button>
              <button className="tool-button stop" onClick={() => dispatch({ type: 'STOP' })} disabled={!running && !zones.some(Boolean) && !pumpOn && !fanOn}><Square size={12} fill="currentColor" />Stop</button>
              <button className="tool-button" onClick={reset}><RotateCcw size={13} />Reset</button>
              <span className="toolbar-spacer" />
              <div className="zoom-controls"><button aria-label="Zoom out" onClick={() => setZoom((v) => Math.max(70, v - 10))}><Minus size={12} /></button><span className="zoom-label">{zoom}%</span><button aria-label="Zoom in" onClick={() => setZoom((v) => Math.min(130, v + 10))}><Plus size={12} /></button></div>
              <button className="tool-button fullscreen-btn" onClick={() => { const el = document.querySelector('.circuit-workspace'); if (el?.requestFullscreen) void el.requestFullscreen(); }} title="Fullscreen circuit"><Maximize2 size={13} /></button>
            </div>
            <CircuitCanvas state={state} zoom={zoom} />
          </section>

          <CodePanel />
        </div>

        <section className="sensor-inputs-section" aria-label="Environmental sensor controls">
          <SensorInputs state={state} onChange={(key, value) => dispatch({ type: 'SET_SENSOR', key, value })} />
        </section>

        <section className="circuit-output">
          <article className="output-panel"><h2><Activity />Live Simulation Output <span className="status-pill" style={{ marginLeft: 'auto' }}><i />{running ? 'RUNNING' : 'STOPPED'}</span><span className={`risk-pill risk-${risk}`}>{risk.toUpperCase()} RISK</span><span className="runtime-chip">{formatElapsedTime(state.elapsedSeconds)}</span></h2><div className="output-metrics"><div className="output-metric"><small>PM2.5 · Sensor 1</small><strong>☀ {pm1} µg/m³</strong><span>Derived PM10 · {state.pm10_1} µg/m³</span></div><div className="output-metric"><small>PM2.5 · Sensor 2</small><strong>☀ {pm2} µg/m³</strong><span>Derived PM10 · {state.pm10_2} µg/m³</span></div><div className="output-metric"><small>Temperature</small><strong><Thermometer size={14} /> {temperature.toFixed(1)}°C</strong><span>{temperature >= 40 ? 'High' : 'Normal'}</span></div><div className="output-metric"><small>Humidity</small><strong><Droplet size={14} /> {humidity}%</strong><span>{humidity >= 80 ? 'High' : 'Normal'}</span></div></div></article>
          <ZoneStatus state={state} onToggle={(index, active) => dispatch({ type: 'SET_ZONE', index, active })} />
          <SystemControls
            state={state}
            onModeChange={(mode) => dispatch({ type: 'SET_MODE', mode })}
            onSetAllZones={(active) => dispatch({ type: 'SET_ALL_ZONES', active })}
            onToggleOutput={(output, active) => dispatch({ type: 'SET_OUTPUT', output, active })}
          />
          <SerialMonitor entries={state.serialLogs} running={running} />
        </section>
      </div>
  );
}

function Feature({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) { return <div className="circuit-feature"><span>{icon}</span><strong>{title}</strong><small>{detail.split('\n').map((line) => <span key={line}>{line}<br /></span>)}</small></div>; }
function BarIcon() { return <Activity />; }
