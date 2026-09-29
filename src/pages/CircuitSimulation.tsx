import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Activity, AlertTriangle, BatteryCharging, Cable, CheckCircle2, Cpu, Droplet, ExternalLink, Fan, Gauge, Lightbulb, Maximize2, Minimize2, RotateCcw, Search, Settings, Terminal, Thermometer, Waves, Wind, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WOKWI_EMBED_URL, WOKWI_PROJECT_URL } from '../config/wokwi';

type ComponentItem = { group: string; name: string; info: string; icon: ReactNode };
type FrameStatus = 'loading' | 'ready' | 'error';

const components: ComponentItem[] = [
  { group: 'Controller', name: 'ESP32 DevKit V1', info: 'Arduino-compatible · 38 GPIO', icon: <Cpu /> },
  { group: 'Sensors', name: 'PM Sensor 1 · Potentiometer', info: 'Simulated PMS5003 · ADC GPIO 34', icon: <Gauge /> },
  { group: 'Sensors', name: 'PM Sensor 2 · Potentiometer', info: 'Simulated PMS5003 · ADC GPIO 35', icon: <Gauge /> },
  { group: 'Sensors', name: 'DHT22', info: 'Temperature + humidity · GPIO 15', icon: <Thermometer /> },
  { group: 'Actuators', name: 'Four relay modules', info: 'One switched output per misting zone', icon: <Settings /> },
  { group: 'Actuators', name: 'Zone LEDs · 1–4', info: 'Visual relay / valve state indicators', icon: <Lightbulb /> },
  { group: 'Actuators', name: 'Pump + fan indicators', info: 'LED substitutes · GPIO 25 / 26', icon: <Wind /> },
  { group: 'Power & Output', name: 'Serial terminal', info: 'Live sensor, risk, and output status', icon: <Terminal /> },
  { group: 'Power & Output', name: 'Physical prototype loads', info: 'Pump, fan, valves are not actuated here', icon: <BatteryCharging /> },
];

const featureItems = [
  { icon: <Waves />, title: 'Browser-based', detail: 'Real Wokwi simulator\nembedded on this page' },
  { icon: <Cpu />, title: 'ESP32 hardware', detail: 'Firmware runs on a\nsimulated DevKit V1' },
  { icon: <Settings />, title: 'Auto response', detail: 'Threshold-driven\nfour-zone outputs' },
  { icon: <Activity />, title: 'Live serial data', detail: 'Sensor readings and\nrelay status updates' },
];

function InventoryGroup({ title, items }: { title: string; items: ComponentItem[] }) {
  return (
    <div className="component-group">
      <h3>{title}<span>⌃</span></h3>
      <div className="component-list">
        {items.map((item) => (
          <div className="component-item" key={item.name}>
            <span className="component-thumb">{item.icon}</span>
            <span><strong>{item.name}</strong><small>{item.info}</small></span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CircuitSimulation() {
  const [search, setSearch] = useState('');
  const [frameKey, setFrameKey] = useState(0);
  const [frameStatus, setFrameStatus] = useState<FrameStatus>('loading');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const workspaceRef = useRef<HTMLElement>(null);

  const grouped = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const groupNames = ['Controller', 'Sensors', 'Actuators', 'Power & Output'];
    return groupNames.map((group) => ({
      group,
      items: components.filter((item) => item.group === group && `${item.name} ${item.info}`.toLowerCase().includes(normalizedSearch)),
    })).filter((entry) => entry.items.length > 0);
  }, [search]);

  useEffect(() => {
    setFrameStatus('loading');
    const timeout = window.setTimeout(() => {
      setFrameStatus((status) => status === 'loading' ? 'error' : status);
    }, 30000);
    return () => window.clearTimeout(timeout);
  }, [frameKey]);

  useEffect(() => {
    const syncFullscreenState = () => setIsFullscreen(document.fullscreenElement === workspaceRef.current);
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

  const restartSimulator = () => {
    setFrameStatus('loading');
    setFrameKey((key) => key + 1);
  };

  const verifyFrameLoaded = async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      // An iframe fires onLoad for browser network-error pages too. This no-cors probe distinguishes
      // a reachable Wokwi project from a failed navigation without reading cross-origin contents.
      await fetch(WOKWI_PROJECT_URL, { mode: 'no-cors', cache: 'no-store', credentials: 'omit', signal: controller.signal });
      setFrameStatus('ready');
    } catch {
      setFrameStatus('error');
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const toggleFullscreen = async () => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    try {
      if (document.fullscreenElement === workspace) await document.exitFullscreen();
      else await workspace.requestFullscreen();
    } catch {
      // Fullscreen can be denied by browser policy; the embedded simulator remains usable in place.
    }
  };

  const statusLabel = frameStatus === 'ready' ? 'SIMULATOR LOADED' : frameStatus === 'error' ? 'LOAD ISSUE' : 'LOADING WOKWI';

  return (
    <div className="circuit-page">
      <section className="circuit-intro">
        <div className="circuit-title">
          <div className="eyebrow">EMBEDDED WOKWI SIMULATOR <span>•</span> ESP32 <span>FOR CLEANER, SAFER COMMUNITIES</span></div>
          <h1>Wokwi <span>Circuit Simulation</span></h1>
          <p>Run DustTwin’s threshold-based ESP32 control demo in a real Wokwi simulator, right here on the page.<br />Adjust the simulated PM inputs and watch all four zone outputs respond.</p>
        </div>
        <div className="circuit-features">
          {featureItems.map((feature) => <Feature key={feature.title} {...feature} />)}
        </div>
      </section>

      <nav className="circuit-tabs" aria-label="DustTwin demo modules">
        <Link to="/"><Waves />Overview</Link><Link to="/simulation"><Activity />Live Simulation</Link><Link to="/results"><BarIcon />Analytics Dashboard</Link><Link className="active" to="/circuit-simulation"><Cpu />Circuit Simulation</Link><Link to="/prototype"><Zap />Prototype Model</Link><Link to="/results"><Activity />Results &amp; Impact</Link>
      </nav>

      <div className="circuit-shell wokwi-shell">
        <aside className="component-sidebar">
          <h2 className="sidebar-title"><span><Settings size={15} /> Circuit components</span><span className="inventory-count">9</span></h2>
          <label className="component-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search components..." /></label>
          {grouped.length ? grouped.map((entry) => <InventoryGroup key={entry.group} title={entry.group} items={entry.items} />) : <p className="empty-search">No matching components.</p>}
          <div className="substitute-note"><AlertTriangle size={14} /><span>PM potentiometers and output LEDs are simulation substitutes; the physical sensor and loads are not connected.</span></div>
        </aside>

        <section className="circuit-workspace wokwi-workspace" ref={workspaceRef} aria-label="Embedded Wokwi simulator workspace">
          <div className="workspace-toolbar">
            <div className="wokwi-toolbar-title"><span className={`wokwi-status-dot ${frameStatus}`} /><span><strong>DustTwin ESP32 demo</strong><small>{statusLabel}</small></span></div>
            <span className="toolbar-spacer" />
            <button className="tool-button" onClick={restartSimulator} title="Reload the Wokwi project"><RotateCcw size={13} />Restart</button>
            <button className="tool-button fullscreen-btn" onClick={() => void toggleFullscreen()} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen simulation'}><span className="fullscreen-icon">{isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}</span><span className="fullscreen-label">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Simulation'}</span></button>
            <a className="tool-button wokwi-fallback-link" href={WOKWI_PROJECT_URL} target="_blank" rel="noreferrer"><ExternalLink size={13} />Open in Wokwi</a>
          </div>
          <div className="wokwi-frame-wrap">
            <iframe
              key={frameKey}
              className="wokwi-frame"
              src={WOKWI_EMBED_URL}
              title="DustTwin ESP32 dust-control circuit running in Wokwi"
              loading="eager"
              allow="fullscreen; clipboard-read; clipboard-write"
              onLoad={() => void verifyFrameLoaded()}
              onError={() => setFrameStatus('error')}
            />
            {frameStatus === 'loading' && <div className="wokwi-frame-state" role="status"><span className="wokwi-spinner" /><strong>Loading the live Wokwi simulator…</strong><p>The public ESP32 project is opening inside this workspace.</p></div>}
            {frameStatus === 'error' && <div className="wokwi-frame-state error" role="alert"><AlertTriangle size={26} /><strong>Wokwi did not finish loading here.</strong><p>Try again, or use the secondary link to open the same public project directly.</p><div><button className="tool-button run" onClick={restartSimulator}><RotateCcw size={13} />Retry embed</button><a className="tool-button" href={WOKWI_PROJECT_URL} target="_blank" rel="noreferrer"><ExternalLink size={13} />Open in Wokwi</a></div></div>}
          </div>
        </section>

        <aside className="code-panel wokwi-guide-panel">
          <div className="code-head"><span><Activity size={15} />Control logic</span><span className="logic-badge">AUTO FIRST</span></div>
          <div className="wokwi-guide-body">
            <p className="guide-lead">Deterministic threshold demo — no ML model or training is used.</p>
            <h3><Gauge size={14} />Automatic response</h3>
            <div className="threshold-rule"><span>≥ 40 µg/m³</span><p>Enable the first misting zone on the matching site edge.</p></div>
            <div className="threshold-rule high"><span>≥ 75 µg/m³</span><p>Enable both zones on that edge and switch on the fan output.</p></div>
            <div className="threshold-rule"><span>Any zone ON</span><p>Switch on the water-pump indicator.</p></div>
            <p className="guide-caution">Illustrative demo thresholds only—not exposure limits or deployment settings.</p>

            <h3><Cable size={14} />ESP32 signal map</h3>
            <ul className="pin-map">
              <li><span>PM 1 / PM 2</span><b>GPIO 34 / 35</b></li>
              <li><span>DHT22</span><b>GPIO 15</b></li>
              <li><span>Zones 1–4 relay</span><b>18 / 19 / 21 / 22</b></li>
              <li><span>Zone LEDs</span><b>13 / 14 / 27 / 32</b></li>
              <li><span>Pump / fan LED</span><b>25 / 26</b></li>
            </ul>

            <h3><Terminal size={14} />Serial test commands</h3>
            <p className="terminal-hint">Use the Wokwi terminal inside the simulation; send one character and press Enter.</p>
            <div className="command-grid"><span><kbd>A</kbd>Auto mode</span><span><kbd>M</kbd>Manual test</span><span><kbd>1–4</kbd>Toggle a zone</span><span><kbd>0</kbd>All zones off</span><span><kbd>F</kbd>Fan test</span></div>
            <div className="physical-note"><CheckCircle2 size={14} /><span>Four relays map to the tabletop prototype’s four separately controlled misting zones.</span></div>
          </div>
        </aside>
      </div>

      <section className="circuit-output wokwi-info-grid" aria-label="Simulation notes">
        <article className="output-panel"><h2><Cable />Prototype relationship</h2><p>The ESP32 reads two boundary PM inputs and a DHT22, then switches one relay per misting zone. Relay states are visible on four LEDs; pump and fan loads are represented by labeled LEDs.</p><div className="output-chip-row"><span>ESP32 DevKit V1</span><span>4 × relay</span><span>2 × simulated PM</span></div></article>
        <article className="output-panel"><h2><Activity />Try the circuit</h2><ol className="test-steps"><li>Start the simulator with Wokwi’s own Run control.</li><li>Turn either PM potentiometer above 40; its zone LED and pump indicator turn on.</li><li>Raise a reading above 75; the second zone on that edge and the fan indicator turn on.</li><li>Use the serial terminal to inspect readings or test manual commands.</li></ol></article>
        <article className="output-panel"><h2><Droplet />Simulation limits</h2><p>Potentiometers stand in for PMS5003 particulate sensors. LEDs stand in for pump and fan loads. Wokwi does not energize real valves, water, or electrical equipment.</p><p className="limits-note">The direct project link is available only as a fallback beside the embedded workspace.</p></article>
      </section>
    </div>
  );
}

function Feature({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <div className="circuit-feature"><span>{icon}</span><strong>{title}</strong><small>{detail.split('\n').map((line) => <span key={line}>{line}<br /></span>)}</small></div>;
}

function BarIcon() { return <Activity />; }
