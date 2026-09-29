import { useMemo, useState } from 'react';
import { Activity, BatteryCharging, Code2, Cpu, Droplet, Fan, Gauge, Maximize2, Minus, Monitor, Play, Plus, Power, RotateCcw, Search, Settings, Square, Thermometer, Waves, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatElapsedTime, getRiskLevel } from '../features/circuit-simulator/simulatorEngine';
import { useSimulator } from '../features/circuit-simulator/useSimulator';
import SensorInputs from '../features/circuit-simulator/SensorInputs';
import SystemControls from '../features/circuit-simulator/SystemControls';
import ZoneStatus from '../features/circuit-simulator/ZoneStatus';
import SerialMonitor from '../features/circuit-simulator/SerialMonitor';
import OutputStateBadge from '../features/circuit-simulator/OutputStateBadge';

const components = [
  { group: 'Controllers', name: 'ESP32 DevKit V1', info: 'WiFi + Bluetooth · 38 GPIO', icon: <Cpu /> },
  { group: 'Sensors', name: 'PM2.5 Sensor 1', info: 'PMS5003 · UART (RX 16 / TX 17)', icon: <Gauge /> },
  { group: 'Sensors', name: 'PM2.5 Sensor 2', info: 'PMS5003 · UART (RX 25 / TX 26)', icon: <Gauge /> },
  { group: 'Sensors', name: 'DHT22', info: 'Temperature & Humidity · GPIO 4', icon: <Thermometer /> },
  { group: 'Actuators', name: '4 Channel Relay Module', info: '12V · GPIO 5, 18, 19, 21', icon: <Settings /> },
  { group: 'Actuators', name: '12V DC Water Pump', info: 'Submersible · Inline', icon: <Droplet /> },
  { group: 'Actuators', name: '12V Solenoid Valves × 4', info: 'Normally Closed · Zone control', icon: <Power /> },
  { group: 'Actuators', name: '12V DC Fan', info: 'Cooling fan · 80mm', icon: <Fan /> },
  { group: 'Power Modules', name: '12V to 5V Buck Converter', info: 'DC-DC Step Down', icon: <BatteryCharging /> },
  { group: 'Power Modules', name: '12V Power Supply', info: 'AC to DC Adapter', icon: <Zap /> },
];

const code = [
  ['// DustTwin deterministic threshold control', 'comment'],
  ['// Reference sketch; the browser engine is implemented in TypeScript.', 'comment'],
  ['', 'plain'],
  ['#include <HardwareSerial.h>', 'keyword'],
  ['#include <DHT.h>', 'keyword'],
  ['', 'plain'],
  ['#define DHT_PIN 4', 'keyword'],
  ['#define PM1_RX 16', 'keyword'],
  ['#define PM1_TX 17', 'keyword'],
  ['#define PM2_RX 25', 'keyword'],
  ['#define PM2_TX 26', 'keyword'],
  ['', 'plain'],
  ['#define RELAY_ZONE_1 5', 'keyword'],
  ['#define RELAY_ZONE_2 18', 'keyword'],
  ['#define RELAY_ZONE_3 19', 'keyword'],
  ['#define RELAY_ZONE_4 21', 'keyword'],
  ['', 'plain'],
  ['const int PM25_MODERATE = 40;  // µg/m³', 'code'],
  ['const int PM25_HIGH = 75;      // µg/m³', 'code'],
  ['', 'plain'],
  ['void loop() {', 'fn'],
  ['  const int pm1 = readPM25(sensor1);', 'code'],
  ['  const int pm2 = readPM25(sensor2);', 'code'],
  ['  const bool z1 = pm1 >= PM25_MODERATE;', 'code'],
  ['  const bool z2 = pm1 >= PM25_HIGH;', 'code'],
  ['  const bool z3 = pm2 >= PM25_MODERATE;', 'code'],
  ['  const bool z4 = pm2 >= PM25_HIGH;', 'code'],
  ['  setZones(z1, z2, z3, z4);', 'code'],
  ['  setPump(z1 || z2 || z3 || z4);', 'code'],
  ['  setFan(pm1 >= PM25_HIGH || pm2 >= PM25_HIGH);', 'code'],
  ['  delay(1000);', 'code'],
  ['}', 'fn'],
];

function InventoryGroup({ title, items }: { title: string; items: typeof components }) {
  return <div className="component-group"><h3>{title}<span>⌃</span></h3><div className="component-list">{items.map((item) => <div className="component-item" key={item.name}><span className="component-thumb">{item.icon}</span><span><strong>{item.name}</strong><small>{item.info}</small></span></div>)}</div></div>;
}

function CircuitPart({ className, icon, name, children, active, showState }: { className: string; icon: React.ReactNode; name: string; children?: React.ReactNode; active?: boolean; showState?: boolean }) {
  return <div className={`circuit-part ${className} ${showState ? (active ? 'is-active' : 'is-inactive') : ''}`} data-state={showState ? (active ? 'on' : 'off') : undefined} aria-label={showState ? `${name}: ${active ? 'ON' : 'OFF'}` : undefined}>{showState && <OutputStateBadge active={Boolean(active)} />}<div className="part-art">{children ?? icon}</div><div className="part-name">{name}</div></div>;
}

export default function CircuitSimulation() {
  const { state, dispatch } = useSimulator();
  const [zoom, setZoom] = useState(100);
  const [search, setSearch] = useState('');
  const running = state.simulationRunning;
  const zones = state.zones;
  const pm1 = state.pm1;
  const pm2 = state.pm2;
  const temperature = state.temperature;
  const humidity = state.humidity;
  const pumpOn = state.pumpOn;
  const fanOn = state.fanOn;
  const risk = getRiskLevel(state);

  const grouped = useMemo(() => ['Controllers', 'Sensors', 'Actuators', 'Power Modules'].map((group) => ({ group, items: components.filter((item) => item.group === group && `${item.name} ${item.info}`.toLowerCase().includes(search.toLowerCase())) })).filter((g) => g.items.length), [search]);
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
          <aside className="component-sidebar">
            <h2 className="sidebar-title"><span><Settings size={15} /> Components</span><span style={{ color: 'var(--cyan)' }}>×</span></h2>
            <label className="component-search"><Search size={14} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search components..." /></label>
            {grouped.map((entry) => <InventoryGroup key={entry.group} title={entry.group} items={entry.items} />)}
          </aside>

          <section className="circuit-workspace">
            <div className="workspace-toolbar">
              <button className="tool-button run" onClick={() => dispatch({ type: 'RUN' })} disabled={running}><Play size={13} fill="currentColor" />Run</button>
              <button className="tool-button stop" onClick={() => dispatch({ type: 'STOP' })} disabled={!running && !zones.some(Boolean) && !pumpOn && !fanOn}><Square size={12} fill="currentColor" />Stop</button>
              <button className="tool-button" onClick={reset}><RotateCcw size={13} />Reset</button>
              <span className="toolbar-spacer" />
              <div className="zoom-controls"><button aria-label="Zoom out" onClick={() => setZoom((v) => Math.max(70, v - 10))}><Minus size={12} /></button><span className="zoom-label">{zoom}%</span><button aria-label="Zoom in" onClick={() => setZoom((v) => Math.min(130, v + 10))}><Plus size={12} /></button></div>
              <button className="tool-button fullscreen-btn" onClick={() => { const el = document.querySelector('.circuit-workspace'); if (el?.requestFullscreen) void el.requestFullscreen(); }} title="Fullscreen circuit"><Maximize2 size={13} /></button>
            </div>
            <div className="circuit-canvas">
              <div className="circuit-board-inner" style={{ '--board-zoom': zoom / 100 } as React.CSSProperties}>
                <svg className="wire-layer" viewBox="0 0 1000 650" preserveAspectRatio="none" aria-hidden="true">
                  <path className="wire-red" d="M205 153 H295 V168 H380 M205 300 H314 V201 H380 M530 196 H610 V105 H830 M530 245 H588 V218 H830 M530 294 H591 V337 H830 M530 340 H602 V455 H830" />
                  <path className="wire-yellow" d="M205 177 H305 V192 H380 M205 325 H330 V219 H380 M264 474 H340 V345 H380 M530 220 H598 V135 H830 M530 270 H606 V253 H830 M530 315 H615 V372 H830" />
                  <path className="wire-blue" d="M205 201 H324 V239 H380 M205 348 H343 V265 H380 M530 244 H622 V166 H830 M530 290 H635 V281 H830" />
                  <path className="wire-green" d="M530 316 H627 V402 H830 M530 346 H638 V485 H830 M490 400 V535 H410 M455 400 V548 H245" />
                  <path className="wire-black" d="M150 565 H285 M412 565 H560 M675 566 H724 M842 566 H872 M765 398 V565 M720 398 V566" />
                  <path className="wire-red" d="M242 565 H280 M419 565 H554 M674 565 H719 M765 395 V440 H830" />
                  <path className="wire-yellow" d="M242 581 H272 V541 H382 M674 581 H706 V480 H830" />
                </svg>
                <CircuitPart className="sensor-board pm-sensor" icon={<Gauge />} name="PM2.5 / PM10 Sensor 1" active={running} showState><span className="sensor-chip">PMS5003</span></CircuitPart>
                <CircuitPart className="sensor-board pm-sensor2" icon={<Gauge />} name="PM2.5 / PM10 Sensor 2" active={running} showState><span className="sensor-chip">PMS5003</span></CircuitPart>
                <CircuitPart className="dht-board" icon={<Thermometer />} name="DHT22 · T/H" active={running} showState />
                <CircuitPart className="esp-board" icon={<Cpu />} name="ESP32 DevKit V1" active={running} showState><span className="esp-chip"><small>ESP32</small><b>◉</b><small>WiFi · BLE</small></span></CircuitPart>
                <CircuitPart className="relay-board" icon={<Settings />} name="4 Channel Relay Module" active={zones.some(Boolean)} showState><span className="relay-blocks"><i /><i /><i /><i /></span></CircuitPart>
                <div className="part-label" style={{ left: '78%', top: '8%' }}>Zone 1<b>12V Solenoid Valve</b></div>
                <div className="part-label" style={{ left: '78%', top: '26%' }}>Zone 2<b>12V Solenoid Valve</b></div>
                <div className="part-label" style={{ left: '78%', top: '44%' }}>Zone 3<b>12V Solenoid Valve</b></div>
                <div className="part-label" style={{ left: '78%', top: '62%' }}>Zone 4<b>12V Solenoid Valve</b></div>
                <CircuitPart className="valve-part valve-1" icon={<Power />} name="Zone 1 Valve" active={zones[0]} showState />
                <CircuitPart className="valve-part valve-2" icon={<Power />} name="Zone 2 Valve" active={zones[1]} showState />
                <CircuitPart className="valve-part valve-3" icon={<Power />} name="Zone 3 Valve" active={zones[2]} showState />
                <CircuitPart className="valve-part valve-4" icon={<Power />} name="Zone 4 Valve" active={zones[3]} showState />
                <CircuitPart className="power-part" icon={<BatteryCharging />} name="12V DC Power Supply" active showState><span className="power-label">12V DC<br /><small>5A</small></span></CircuitPart>
                <CircuitPart className="buck-part" icon={<Zap />} name="12V → 5V Buck Converter" active={running} showState><span className="buck-chip">5V OUT</span></CircuitPart>
                <CircuitPart className="pump-part" icon={<Droplet />} name="12V DC Water Pump" active={pumpOn} showState />
                <CircuitPart className="fan-part" icon={<Fan />} name="12V DC Fan" active={fanOn} showState />
                <div className="circuit-part led-bank"><div className="part-art">{zones.map((active, i) => <span className={`led-dot ${active ? (risk === 'high' ? 'danger' : 'on') : ''}`} key={i} />)}</div><div className="part-name">Zone LEDs · Z1–Z4</div></div>
              </div>
            </div>
          </section>

          <aside className="code-panel">
            <div className="code-head"><span><Code2 size={15} />ESP32 Code (Arduino)</span><div className="code-actions"><span>↻</span><span>□</span></div></div>
            <div className="code-view">{code.map(([line, kind], i) => <code className="code-line" key={`${i}-${line}`}><span className="line-no">{i + 1}</span><span className={kind === 'keyword' ? 'code-keyword' : kind === 'comment' ? 'code-comment' : kind === 'fn' ? 'code-fn' : kind === 'string' ? 'code-string' : 'code-code'}>{line}</span></code>)}</div>
          </aside>
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
