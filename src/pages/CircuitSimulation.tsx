import { useEffect, useMemo, useState } from 'react';
import { Activity, BatteryCharging, Cable, Check, Code2, Cpu, Droplet, Fan, Gauge, Lightbulb, Maximize2, Minus, Monitor, Play, Plus, Power, RotateCcw, Search, Settings, Square, Thermometer, Waves, Wind, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

const components = [
  { group: 'Controllers', name: 'ESP32 DevKit V1', info: 'WiFi + Bluetooth · 38 GPIO', icon: <Cpu /> },
  { group: 'Sensors', name: 'PM2.5 / PM10 Sensor', info: 'Plantower PMS5003 · UART (TX/RX)', icon: <Gauge /> },
  { group: 'Sensors', name: 'DHT22', info: 'Temperature & Humidity · Digital', icon: <Thermometer /> },
  { group: 'Actuators', name: '4 Channel Relay Module', info: '12V · High/Low Trigger', icon: <Settings /> },
  { group: 'Actuators', name: '12V DC Water Pump', info: 'Submersible · Inline', icon: <Droplet /> },
  { group: 'Actuators', name: '12V Solenoid Valve', info: 'Normally Closed · Zone control', icon: <Power /> },
  { group: 'Actuators', name: '12V DC Fan', info: 'Cooling fan · 80mm', icon: <Fan /> },
  { group: 'Power Modules', name: '12V to 5V Buck Converter', info: 'DC-DC Step Down', icon: <BatteryCharging /> },
  { group: 'Power Modules', name: '12V Power Supply', info: 'AC to DC Adapter', icon: <Zap /> },
];

const code = [
  ['// DustTwin - Air Quality Monitoring & Zone Control', 'comment'],
  ['// ESP32, PM2.5 Sensors, DHT22, 4-channel Relays', 'comment'],
  ['', 'plain'],
  ['#include <WiFi.h>', 'keyword'],
  ['#include <HardwareSerial.h>', 'keyword'],
  ['#include <DHT.h>', 'keyword'],
  ['', 'plain'],
  ['// Pin definitions', 'comment'],
  ['#define DHT_PIN 4', 'keyword'],
  ['#define DHT_TYPE DHT22', 'keyword'],
  ['', 'plain'],
  ['#define PM1_RX 16', 'keyword'],
  ['#define PM1_TX 17', 'keyword'],
  ['#define PM2_RX 25', 'keyword'],
  ['#define PM2_TX 26', 'keyword'],
  ['', 'plain'],
  ['#define RELAY_1 5', 'keyword'],
  ['#define RELAY_2 18', 'keyword'],
  ['#define RELAY_3 19', 'keyword'],
  ['#define RELAY_4 21', 'keyword'],
  ['', 'plain'],
  ['#define LED_1 32', 'keyword'],
  ['#define LED_2 33', 'keyword'],
  ['#define LED_3 27', 'keyword'],
  ['#define LED_4 14', 'keyword'],
  ['', 'plain'],
  ['// Thresholds', 'comment'],
  ['const int PM25_THRESHOLD = 50;  // μg/m³', 'code'],
  ['const float TEMP_THRESHOLD = 40.0;  // °C', 'code'],
  ['const int HUMIDITY_THRESHOLD = 80;  // %RH', 'code'],
  ['', 'plain'],
  ['HardwareSerial pm1Serial(1);', 'code'],
  ['HardwareSerial pm2Serial(2);', 'code'],
  ['DHT dht(DHT_PIN, DHT_TYPE);', 'code'],
  ['', 'plain'],
  ['void setup() {', 'fn'],
  ['  Serial.begin(115200);', 'code'],
  ['  pinMode(RELAY_1, OUTPUT);', 'code'],
  ['  pm1Serial.begin(9600, SERIAL_8N1, PM1_RX, PM1_TX);', 'code'],
  ['  dht.begin();', 'code'],
  ['}', 'fn'],
  ['', 'plain'],
  ['void loop() {', 'fn'],
  ['  readSensors();', 'code'],
  ['  updateDustTwinPrediction();', 'code'],
  ['  controlMistingZones();', 'code'],
  ['  delay(1000);', 'code'],
  ['}', 'fn'],
];

function InventoryGroup({ title, items }: { title: string; items: typeof components }) {
  return <div className="component-group"><h3>{title}<span>⌃</span></h3><div className="component-list">{items.map((item) => <div className="component-item" key={item.name}><span className="component-thumb">{item.icon}</span><span><strong>{item.name}</strong><small>{item.info}</small></span></div>)}</div></div>;
}

function CircuitPart({ className, icon, name, children }: { className: string; icon: React.ReactNode; name: string; children?: React.ReactNode }) {
  return <div className={`circuit-part ${className}`}><div className="part-art">{children ?? icon}</div><div className="part-name">{name}</div></div>;
}

export default function CircuitSimulation() {
  const [running, setRunning] = useState(true);
  const [autoMode, setAutoMode] = useState(true);
  const [zones, setZones] = useState([false, true, false, true]);
  const [pmLevel, setPmLevel] = useState(38);
  const [threshold, setThreshold] = useState(50);
  const [pm1, setPm1] = useState(28);
  const [pm2, setPm2] = useState(32);
  const [temperature, setTemperature] = useState(28.4);
  const [humidity, setHumidity] = useState(62);
  const [pumpOn, setPumpOn] = useState(true);
  const [fanOn, setFanOn] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const jitter = Math.round(Math.sin(Date.now() / 1500) * 5);
      const value1 = Math.max(5, pmLevel + jitter);
      const value2 = Math.max(5, Math.round(pmLevel * .91 - jitter / 2));
      setPm1(value1);
      setPm2(value2);
      setTemperature((v) => Math.round((v + Math.sin(Date.now() / 6000) * .025) * 10) / 10);
      if (autoMode) {
        const a = value1 >= threshold;
        const b = value2 >= threshold;
        setZones([a, b, value1 >= threshold * 1.3, value2 >= threshold * 1.25]);
        setPumpOn(a || b || value1 >= threshold * 1.3 || value2 >= threshold * 1.25);
      }
    }, 950);
    return () => window.clearInterval(timer);
  }, [running, autoMode, pmLevel, threshold]);

  const grouped = useMemo(() => ['Controllers', 'Sensors', 'Actuators', 'Power Modules'].map((group) => ({ group, items: components.filter((item) => item.group === group && `${item.name} ${item.info}`.toLowerCase().includes(search.toLowerCase())) })).filter((g) => g.items.length), [search]);
  const reset = () => { setRunning(true); setPmLevel(38); setThreshold(50); setPm1(28); setPm2(32); setTemperature(28.4); setHumidity(62); setZones([false, true, false, true]); setAutoMode(true); setPumpOn(true); setFanOn(false); setZoom(100); };
  const manualToggle = (index: number) => setZones((prev) => prev.map((state, i) => i === index ? !state : state));
  const turnAll = (state: boolean) => { setZones([state, state, state, state]); setPumpOn(state); };

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
              <button className="tool-button run" onClick={() => setRunning(true)}><Play size={13} fill="currentColor" />Run</button>
              <button className="tool-button stop" onClick={() => setRunning(false)}><Square size={12} fill="currentColor" />Stop</button>
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
                <CircuitPart className="sensor-board pm-sensor" icon={<Gauge />} name="PM2.5 / PM10 Sensor 1"><span className="sensor-chip">PMS5003</span></CircuitPart>
                <CircuitPart className="sensor-board pm-sensor2" icon={<Gauge />} name="PM2.5 / PM10 Sensor 2"><span className="sensor-chip">PMS5003</span></CircuitPart>
                <CircuitPart className="dht-board" icon={<Thermometer />} name="DHT22 · T/H" />
                <CircuitPart className="esp-board" icon={<Cpu />} name="ESP32 DevKit V1"><span className="esp-chip"><small>ESP32</small><b>◉</b><small>WiFi · BLE</small></span></CircuitPart>
                <CircuitPart className="relay-board" icon={<Settings />} name="4 Channel Relay Module"><span className="relay-blocks"><i /><i /><i /><i /></span></CircuitPart>
                <div className="part-label" style={{ left: '78%', top: '8%' }}>Zone 1<b>12V Solenoid Valve</b></div>
                <div className="part-label" style={{ left: '78%', top: '26%' }}>Zone 2<b>12V Solenoid Valve</b></div>
                <div className="part-label" style={{ left: '78%', top: '44%' }}>Zone 3<b>12V Solenoid Valve</b></div>
                <div className="part-label" style={{ left: '78%', top: '62%' }}>Zone 4<b>12V Solenoid Valve</b></div>
                <CircuitPart className="valve-part valve-1" icon={<Power />} name="12V Valve" />
                <CircuitPart className="valve-part valve-2" icon={<Power />} name="12V Valve" />
                <CircuitPart className="valve-part valve-3" icon={<Power />} name="12V Valve" />
                <CircuitPart className="valve-part valve-4" icon={<Power />} name="12V Valve" />
                <CircuitPart className="power-part" icon={<BatteryCharging />} name="12V DC Power Supply"><span className="power-label">12V DC<br /><small>5A</small></span></CircuitPart>
                <CircuitPart className="buck-part" icon={<Zap />} name="12V → 5V Buck Converter"><span className="buck-chip">5V OUT</span></CircuitPart>
                <CircuitPart className="pump-part" icon={<Droplet />} name="12V DC Water Pump" />
                <CircuitPart className="fan-part" icon={<Fan />} name="12V DC Fan" />
                <div className="circuit-part led-bank"><div className="part-art">{zones.map((active, i) => <span className={`led-dot ${active ? (pm1 > threshold * 1.35 ? 'danger' : 'on') : ''}`} key={i} />)}</div><div className="part-name">Zone LEDs · Z1–Z4</div></div>
              </div>
            </div>
          </section>

          <aside className="code-panel">
            <div className="code-head"><span><Code2 size={15} />ESP32 Code (Arduino)</span><div className="code-actions"><span>↻</span><span>□</span></div></div>
            <div className="code-view">{code.map(([line, kind], i) => <code className="code-line" key={`${i}-${line}`}><span className="line-no">{i + 1}</span><span className={kind === 'keyword' ? 'code-keyword' : kind === 'comment' ? 'code-comment' : kind === 'fn' ? 'code-fn' : kind === 'string' ? 'code-string' : 'code-code'}>{line}</span></code>)}</div>
          </aside>
        </div>

        <section className="circuit-output">
          <article className="output-panel"><h2><Activity />Live Simulation Output <span className="status-pill" style={{ marginLeft: 'auto' }}><i />{running ? 'RUNNING' : 'STOPPED'}</span></h2><div className="output-metrics"><div className="output-metric"><small>PM-1 (Zone 1)</small><strong>☀ {pm1} μg/m³</strong><span>{pm1 >= threshold ? 'Elevated' : 'Good'}</span></div><div className="output-metric"><small>PM-2 (Zone 2)</small><strong>☀ {pm2} μg/m³</strong><span>{pm2 >= threshold ? 'Elevated' : 'Good'}</span></div><div className="output-metric"><small>Temperature</small><strong><Thermometer size={14} /> {temperature.toFixed(1)}°C</strong><span>Normal</span></div><div className="output-metric"><small>Humidity</small><strong><Droplet size={14} /> {humidity}%</strong><span>Normal</span></div></div></article>
          <article className="output-panel"><h2><Settings />Zone Status</h2><div className="zone-grid">{zones.map((on, i) => <button className={`zone-toggle ${on ? 'active' : ''}`} key={i} onClick={() => !autoMode && manualToggle(i)} title={autoMode ? 'Switch to Manual Mode to toggle zones' : `Toggle Zone ${i + 1}`}><span className="zone-bulb" />Zone {i + 1}<b>{on ? 'ON' : 'OFF'}</b></button>)}</div><div className="system-status-strip">{autoMode ? 'Auto logic: PM threshold ' + threshold + ' μg/m³' : 'Manual control · select a zone to toggle'}</div></article>
          <article className="output-panel system-controls"><h2><Settings />System Controls</h2><div className="mode-row"><button className={`mode-btn ${autoMode ? 'active' : ''}`} onClick={() => setAutoMode(true)}>Auto Mode</button><button className={`mode-btn ${!autoMode ? 'active' : ''}`} onClick={() => setAutoMode(false)}>Manual Mode</button></div><label className="pm-range-label">Simulated PM level <b>{pmLevel} μg/m³</b><input type="range" min="5" max="120" value={pmLevel} onChange={(e) => setPmLevel(Number(e.target.value))} /></label><label className="pm-range-label">Auto trigger threshold <b>{threshold} μg/m³</b><input type="range" min="20" max="100" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} /></label><div className="manual-row"><button className={`small-control-btn ${zones.some(Boolean) ? 'active' : ''}`} onClick={() => turnAll(true)}><Play size={12} fill="currentColor" />Turn All Zones ON</button><button className="small-control-btn" onClick={() => turnAll(false)}><Square size={11} />Turn All Zones OFF</button></div><div className="manual-row"><button className={`small-control-btn ${pumpOn ? 'active' : ''}`} onClick={() => setPumpOn((v) => !v)}><Droplet size={13} />Pump {pumpOn ? 'ON' : 'OFF'}</button><button className={`small-control-btn ${fanOn ? 'active' : ''}`} onClick={() => setFanOn((v) => !v)}><Fan size={13} />Fan {fanOn ? 'ON' : 'OFF'}</button></div></article>
        </section>
      </div>
  );
}

function Feature({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) { return <div className="circuit-feature"><span>{icon}</span><strong>{title}</strong><small>{detail.split('\n').map((line) => <span key={line}>{line}<br /></span>)}</small></div>; }
function BarIcon() { return <Activity />; }
