import { useState } from 'react';
import { Code2, Download, RotateCcw, Save } from 'lucide-react';
import sensorSource from '../../../wokwi/dusttwin/sketch.ino?raw';
import actuatorSource from '../../../wokwi/hybrid-actuator/actuator.ino?raw';
import piSource from '../../../ai-backend/src/dusttwin/inference.py?raw';
import engineSource from './engine.ts?raw';
import { DEFAULT_CONFIG, validateConfig, type Config } from './engine';

export function download(name: string, content: string, mime = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const SOURCES = [
  { name: 'ESP32 Sensor Controller', filename: 'sensor-reference.ino', source: sensorSource, note: 'Existing wokwi/dusttwin/sketch.ino: legacy two-PM-input / DHT demo. Reference only; this is not firmware for six SPS30 sensors. Hardware acquisition still requires a sensor-controller implementation for the selected field devices.' },
  { name: 'ESP32 Actuator Controller', filename: 'actuator.ino', source: actuatorSource, note: 'New proposed USB/UART driver scaffold. Eleven channels, fail-off watchdog and emergency inhibit. Not compiled or executed by this website; requires bench validation, selected drivers and independent hardware emergency chain.' },
  { name: 'Raspberry Pi Controller', filename: 'inference.py', source: piSource, note: 'Actual existing backend inference module. Shared host control rules are shown in the logic tab. This Python source is a reference; no physical serial bridge is installed or running.' },
  { name: 'Simulation Configuration', filename: 'hardware-config.json', source: JSON.stringify(DEFAULT_CONFIG, null, 2), note: 'Validated JSON is applied to the browser logic when saved: damper travel, nominal airflow and HEPA trip point. These are functional assumptions, not calibrated equipment specifications.' },
  { name: 'Shared control logic', filename: 'engine.ts', source: engineSource, note: 'Actual TypeScript engine used by this page. Source edits are working copies for export and review. They do not dynamically execute. Configuration changes do affect the simulator.' },
];
const STORAGE = 'dusttwin-hardware-workspace-v1';
function loadCopies(): string[] {
  try { const saved: unknown = JSON.parse(localStorage.getItem(STORAGE) ?? 'null'); if (Array.isArray(saved) && saved.length === SOURCES.length && saved.every(v => typeof v === 'string')) return saved; } catch { /* defaults if storage is unavailable or corrupt */ }
  return SOURCES.map(s => s.source);
}
export default function CodeWorkspace({ applyConfig }: { applyConfig: (config: Config) => void }) {
  const [tab, setTab] = useState(0);
  const [copies, setCopies] = useState(loadCopies);
  const [message, setMessage] = useState('Working copies stay in this browser. Export to use outside the simulator.');
  const source = SOURCES[tab];
  function save() {
    try {
      const config = validateConfig(JSON.parse(copies[3]));
      localStorage.setItem(STORAGE, JSON.stringify(copies));
      applyConfig(config);
      setMessage('Working copies saved locally. Validated simulation configuration applied.');
    } catch (error) { setMessage(`Could not save: ${error instanceof Error ? error.message : 'browser storage unavailable'}`); }
  }
  return <section className="hw-panel hw-code"><div className="hw-panel-head"><div><span className="hw-kicker">03 / CODE WORKSPACE</span><h2><Code2 size={19} /> Controller sources</h2></div><span className="hw-chip">Logic simulation · no firmware emulator</span></div><div className="hw-code-tabs" role="tablist" aria-label="Controller source files">{SOURCES.map((s, i) => <button role="tab" aria-selected={tab === i} aria-controls="hw-code-editor" id={`hw-code-tab-${i}`} key={s.name} className={tab === i ? 'selected' : ''} onClick={() => setTab(i)}>{s.name}</button>)}</div><p className="hw-code-note">{source.note}</p><div className="hw-editor-bar"><code>{source.filename}</code><span>{copies[tab].split('\n').length} lines · editable copy</span></div><textarea id="hw-code-editor" role="tabpanel" aria-labelledby={`hw-code-tab-${tab}`} aria-label={`Edit ${source.name}`} spellCheck={false} value={copies[tab]} onChange={e => { const value = e.target.value; setCopies(v => v.map((s, i) => i === tab ? value : s)); }} /><div className="hw-code-actions"><button onClick={save}><Save size={15} /> Save working copies & apply config</button><button onClick={() => { setCopies(v => v.map((s, i) => i === tab ? source.source : s)); if (tab === 3) applyConfig({ ...DEFAULT_CONFIG }); setMessage('Selected working copy reset to project source. Save to persist.'); }}><RotateCcw size={15} /> Reset file</button><button onClick={() => download(source.filename, copies[tab])}><Download size={15} /> Export file</button><button onClick={() => download('dusttwin-workspace.json', JSON.stringify(Object.fromEntries(SOURCES.map((s, i) => [s.filename, copies[i]])), null, 2), 'application/json')}>Export all</button></div><p className="hw-save-message" role="status">{message}</p></section>;
}
