import { useState } from 'react';
import { Activity, Cpu, Monitor, Settings, Waves, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSimulator } from '../features/circuit-simulator/useSimulator';
import SensorInputs from '../features/circuit-simulator/SensorInputs';
import SystemControls from '../features/circuit-simulator/SystemControls';
import ZoneStatus from '../features/circuit-simulator/ZoneStatus';
import SerialMonitor from '../features/circuit-simulator/SerialMonitor';
import CircuitCanvas from '../features/circuit-simulator/CircuitCanvas';
import CodePanel from '../features/circuit-simulator/CodePanel';
import ComponentSidebar from '../features/circuit-simulator/ComponentSidebar';
import LiveMetrics from '../features/circuit-simulator/LiveMetrics';
import CircuitToolbar from '../features/circuit-simulator/CircuitToolbar';

export default function CircuitSimulation() {
  const { state, dispatch } = useSimulator();
  const [zoom, setZoom] = useState(100);
  const running = state.simulationRunning;

  const reset = () => { dispatch({ type: 'RESET' }); setZoom(100); };

  return (
    <div className="circuit-page">
        <section className="circuit-intro">
          <div className="circuit-title"><div className="eyebrow">CUSTOM HARDWARE SIMULATOR <span>•</span> IoT <span>FOR CLEANER, SAFER COMMUNITIES</span></div><h1>DustTwin <span>Circuit Simulation</span></h1><p>Design, simulate and test the DustTwin hardware in your browser.<br />A complete IoT dust control system with sensors, actuators and real-time feedback.</p></div>
          <div className="circuit-features">
            <Feature icon={<Monitor />} title="Browser-based" detail="No installation\nJust open and simulate" />
            <Feature icon={<Cpu />} title="Hardware model" detail="ESP32, sensors and relays\nmodeled in the browser" />
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
            <CircuitToolbar
              state={state}
              zoom={zoom}
              onZoomChange={setZoom}
              onRun={() => dispatch({ type: 'RUN' })}
              onStop={() => dispatch({ type: 'STOP' })}
              onReset={reset}
            />
            <CircuitCanvas state={state} zoom={zoom} />
          </section>

          <CodePanel />
        </div>

        <section className="sensor-inputs-section" aria-label="Environmental sensor controls">
          <SensorInputs state={state} onChange={(key, value) => dispatch({ type: 'SET_SENSOR', key, value })} />
        </section>

        <section className="circuit-output">
          <LiveMetrics state={state} />
          <ZoneStatus state={state} onToggle={(index, active) => dispatch({ type: 'SET_ZONE', index, active })} />
          <SystemControls
            state={state}
            onModeChange={(mode) => dispatch({ type: 'SET_MODE', mode })}
            onSetAllZones={(active) => dispatch({ type: 'SET_ALL_ZONES', active })}
            onToggleOutput={(output, active) => dispatch({ type: 'SET_OUTPUT', output, active })}
          />
          <SerialMonitor entries={state.serialLogs} running={running} onClear={() => dispatch({ type: 'CLEAR_LOGS' })} />
        </section>
      </div>
  );
}

function Feature({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) { return <div className="circuit-feature"><span>{icon}</span><strong>{title}</strong><small>{detail.split('\n').map((line) => <span key={line}>{line}<br /></span>)}</small></div>; }
function BarIcon() { return <Activity />; }
