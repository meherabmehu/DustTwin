import { useRef, useState } from 'react';
import { Maximize2, Minus, Plus, Cpu, Radio, Wind, Droplets, Zap } from 'lucide-react';
import { GROUPS, PARTS, WIRES, WIRE_COLORS, partStatus, validateWiring, WIRING_NOTES, type Group, type Part } from './hardware';
import type { HardwareState } from './engine';

const WIDTH = 1740;
const HEIGHT = 1610;
const icons = { board: Cpu, sensor: Radio, motor: Wind, valve: Droplets, passive: Wind, power: Zap };
export default function CircuitWorkspace({ state }: { state: HardwareState }) {
  const [filter, setFilter] = useState<Group | 'Complete System'>('Complete System');
  const [selected, setSelected] = useState('pi');
  const [selectedWire, setSelectedWire] = useState<string | null>(null);
  const [zoom, setZoom] = useState(.75);
  const [showPower, setShowPower] = useState(false);
  const [collapsed, setCollapsed] = useState<Group[]>([]);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const activeGroups = filter === 'Complete System' ? [...GROUPS] : [filter, ...(filter === 'Raspberry Pi and ESP32' ? [] : ['Raspberry Pi and ESP32' as Group])];
  const shown = PARTS.filter(p => activeGroups.includes(p.group) && !collapsed.includes(p.group));
  const locations = new Map<string, { x: number; y: number }>();
  activeGroups.forEach((group, column) => PARTS.filter(p => p.group === group).forEach((p, row) => locations.set(p.id, { x: 30 + column * 344, y: 75 + row * 108 })));
  const filteredWidth = filter === 'Complete System' ? WIDTH : 720;
  const height = Math.max(400, ...shown.map(p => (locations.get(p.id)?.y ?? 0) + 130));
  const connected = WIRES.filter(w => w.from === selected || w.to === selected);
  const pickedPart = PARTS.find(p => p.id === selected)!;
  const pickedWire = WIRES.find(w => w.id === selectedWire);
  const errors = validateWiring();
  const choose = (p: Part) => { setSelected(p.id); setSelectedWire(null); };
  function fit() { if (viewport.current) setZoom(Math.max(.25, Math.min(1.4, (viewport.current.clientWidth - 20) / filteredWidth))); }
  return <section className="hw-panel hw-circuit" aria-label="Interactive circuit diagram">
    <div className="hw-panel-head"><div><span className="hw-kicker">01 / CIRCUIT WORKSPACE</span><h2>Hybrid prototype topology</h2></div><span className="hw-chip">{PARTS.length} components · {WIRES.length} connections</span></div>
    <div className="hw-filter-row">{['Complete System', ...GROUPS].map(g => <button key={g} className={filter === g ? 'selected' : ''} onClick={() => { setFilter(g as typeof filter); setSelectedWire(null); setZoom(g === 'Complete System' ? .75 : 1); }}>{g}</button>)}</div>
    <div className="hw-circuit-tools"><div className="hw-legend">{Object.entries(WIRE_COLORS).map(([kind, color]) => <span key={kind}><i style={{ background: color }} />{kind}</span>)}</div><div className="hw-inline"><label><input type="checkbox" checked={showPower} onChange={e => setShowPower(e.target.checked)} /> All power wires</label><button aria-label="Zoom out" onClick={() => setZoom(z => Math.max(.25, z - .15))}><Minus size={15} /></button><span>{Math.round(zoom * 100)}%</span><button aria-label="Zoom in" onClick={() => setZoom(z => Math.min(2, z + .15))}><Plus size={15} /></button><button onClick={fit}><Maximize2 size={14} /> Fit width</button></div></div>
    <div className="hw-viewport" ref={viewport} onPointerDown={e => { if ((e.target as Element).closest('[data-interactive]')) return; const el = e.currentTarget; drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop }; el.setPointerCapture(e.pointerId); }} onPointerMove={e => { if (!drag.current) return; e.currentTarget.scrollLeft = drag.current.left - (e.clientX - drag.current.x); e.currentTarget.scrollTop = drag.current.top - (e.clientY - drag.current.y); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <svg width={filteredWidth * zoom} height={Math.min(HEIGHT, height) * zoom} viewBox={`0 0 ${filteredWidth} ${Math.min(HEIGHT, height)}`} aria-label="Hardware components and modeled pin connections">
        <defs><pattern id="hw-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#1d3b4b" /></pattern></defs><rect width="100%" height="100%" fill="url(#hw-grid)" />
        {activeGroups.map((g, i) => <g key={g} data-interactive="true" role="button" tabIndex={0} aria-label={`${collapsed.includes(g) ? 'Expand' : 'Collapse'} ${g}`} onClick={() => setCollapsed(v => v.includes(g) ? v.filter(x => x !== g) : [...v, g])} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCollapsed(v => v.includes(g) ? v.filter(x => x !== g) : [...v, g]); } }} className="hw-group-label"><rect x={30 + i * 344} y="18" width="290" height="36" rx="8" /><text x={44 + i * 344} y="42">{collapsed.includes(g) ? '+' : '−'} {g}</text></g>)}
        {WIRES.filter(w => shown.some(p => p.id === w.from) && shown.some(p => p.id === w.to) && (showPower || !['power', 'ground'].includes(w.type) || w.from === selected || w.to === selected)).map((w, index) => {
          const a = locations.get(w.from)!, b = locations.get(w.to)!;
          const highlight = w.from === selected || w.to === selected || w.id === selectedWire;
          const x1 = a.x + 285, y1 = a.y + 47, x2 = b.x, y2 = b.y + 47;
          const same = a.x === b.x;
          const lane = a.x + 300 + (index % 5) * 5;
          const path = same ? `M${x1},${y1} H${lane} V${y2} H${x2 + 285}` : `M${x1},${y1} C${x1 + 45},${y1} ${x2 - 45},${y2} ${x2},${y2}`;
          const activeFlow = w.type === 'air' && state.motor && (!w.from.startsWith('damper') || state.position[Number(w.from.slice(-1))] > 0) && (!w.from.startsWith('inlet') || state.position[Number(w.from.slice(-1))] > 0) || w.type === 'water' && state.pump && (!w.to.startsWith('valve') || state.valves[Number(w.to.slice(-1))]) && (!w.from.startsWith('valve') || state.valves[Number(w.from.slice(-1))]);
          return <g key={w.id} data-interactive="true" className="hw-wire" onClick={() => setSelectedWire(w.id)}><title>{w.from}:{w.fromPin} → {w.to}:{w.toPin} · {w.purpose}</title><path d={path} fill="none" stroke="transparent" strokeWidth="14" /><path d={path} fill="none" stroke={WIRE_COLORS[w.type]} strokeWidth={w.id === selectedWire ? 4 : highlight ? 2.5 : 1.3} opacity={highlight || activeFlow ? 1 : .2} className={activeFlow && state.running ? 'hw-flow' : ''} strokeDasharray={activeFlow ? '8 5' : undefined} /></g>;
        })}
        {shown.map(p => {
          const pos = locations.get(p.id)!; const status = partStatus(p.id, state); const Icon = icons[p.kind];
          const active = ['ON', 'OPEN', 'SPRAY', 'OPENING'].includes(status); const fault = status === 'FAULT' || status === 'DISCONNECTED';
          return <g key={p.id} transform={`translate(${pos.x},${pos.y})`} data-interactive="true" className={`hw-part ${p.kind} ${p.id === selected ? 'selected' : ''} ${active ? 'active' : ''} ${fault ? 'fault' : ''}`} role="button" tabIndex={0} aria-label={`${p.name}: ${status}`} onClick={() => choose(p)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(p); } }}><title>{p.name}: {p.note}</title><rect width="285" height="88" rx="10" /><rect className="hw-part-icon" x="12" y="14" width="42" height="42" rx={p.kind === 'board' ? 3 : 20} /><Icon x="22" y="24" width="22" height="22" strokeWidth="1.6" />{p.kind === 'board' && [0, 1, 2, 3].map(i => <path key={i} d={`M8 ${22 + i * 8}h7 M51 ${22 + i * 8}h7`} stroke="#e5c377" strokeWidth="3" />)}<text x="65" y="30" className="hw-part-name">{p.name}</text><text x="65" y="53" className="hw-part-status">● {status}</text><text x="14" y="76" className="hw-pin-preview">{p.pins.slice(0, 4).join(' · ')}{p.pins.length > 4 ? ' …' : ''}</text></g>;
        })}
      </svg>
    </div>
    <p className="hw-hint">Drag the grid to pan · scroll to explore · select a component to trace its connections · use subsystem tabs for detail</p>
    <div className="hw-inspector"><div><span className="hw-kicker">{pickedWire ? 'CONNECTION INSPECTOR' : 'COMPONENT INSPECTOR'}</span><h3>{pickedWire ? `${pickedWire.type.toUpperCase()} · ${pickedWire.voltage}` : pickedPart.name}</h3>{pickedWire ? <><p><b>{PARTS.find(p => p.id === pickedWire.from)?.name}</b> / {pickedWire.fromPin}<br />→ <b>{PARTS.find(p => p.id === pickedWire.to)?.name}</b> / {pickedWire.toPin}</p><p>{pickedWire.purpose}</p></> : <><p>{pickedPart.note}</p><small>{pickedPart.verified ? 'Documented device interface; proposed project assignment.' : 'Functional interface. Exact equipment / carrier selection required.'}</small></>}</div><div><label htmlFor="hw-part-select">Inspect any component</label><select id="hw-part-select" value={selected} onChange={e => { setSelected(e.target.value); setSelectedWire(null); }}>{PARTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><div className="hw-connection-list">{connected.map(w => <button key={w.id} className={selectedWire === w.id ? 'selected' : ''} onClick={() => setSelectedWire(w.id)}><i style={{ background: WIRE_COLORS[w.type] }} />{w.from}:{w.fromPin} → {w.to}:{w.toPin}</button>)}</div></div></div>
    <details className="hw-wiring-notes"><summary>Wiring validation & assembly notes · {errors.length ? `${errors.length} errors` : 'all modeled endpoints valid'} · equipment selection pending</summary>{errors.map(e => <p role="alert" key={e}>{e}</p>)}{WIRING_NOTES.map(n => <p key={n}>{n}</p>)}<p>References: <a href="https://sensirion.com/resource/datasheet/sps30" target="_blank" rel="noreferrer">Sensirion SPS30</a> · <a href="https://www.ti.com/lit/ds/symlink/tca9548a.pdf" target="_blank" rel="noreferrer">TI TCA9548A</a> · <a href="https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/peripherals/gpio.html" target="_blank" rel="noreferrer">Espressif GPIO</a> · <a href="https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#power-supply" target="_blank" rel="noreferrer">Pi power</a></p></details>
  </section>;
}
