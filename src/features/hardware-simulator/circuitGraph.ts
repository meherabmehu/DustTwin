import { PARTS, WIRES, type Part, type Wire } from './hardware';
import { geometry } from './componentGeometry';
export const VIEWS = ['Complete System', 'Raspberry Pi and ESP32', 'PM Sensors', 'Environmental Sensors', 'Dry Extraction', 'Water Misting', 'Power Distribution'] as const;
export type CircuitView = typeof VIEWS[number];
export function subsystem(view: CircuitView): { parts: Part[]; wires: Wire[] } {
  if (view === 'Complete System') return { parts: PARTS, wires: WIRES };
  const ids = new Set<string>(), add = (...v: string[]) => v.forEach(id => ids.add(id));
  if (view === 'PM Sensors') { PARTS.filter(p => /^pm\d$/.test(p.id)).forEach(p => ids.add(p.id)); add('pi', 'esp1', 'mux', 'buck'); }
  else if (view === 'Environmental Sensors') { PARTS.filter(p => p.group === 'Sensors' && !/^pm\d$/.test(p.id)).forEach(p => ids.add(p.id)); add('pi', 'esp1', 'mux', 'rs485', 'conditioner', 'buck'); }
  else { PARTS.filter(p => p.group === view).forEach(p => ids.add(p.id)); if (view === 'Dry Extraction' || view === 'Water Misting') add('pi', 'esp1', 'esp2', 'drivers', 'dp', 'estopSense'); if (view === 'Water Misting') add('flow', 'pressure', 'level', 'conditioner'); }
  for (let pass = 0; pass < 6; pass++) for (const w of WIRES) if (ids.has(w.to) && ['power', 'ground'].includes(w.type)) ids.add(w.from);
  return { parts: PARTS.filter(p => ids.has(p.id)), wires: WIRES.filter(w => ids.has(w.from) && ids.has(w.to)) };
}
export function layout(parts: Part[]) {
  const names = ['PM Sensors', 'Environmental Sensors', 'Main Controllers', 'Drivers & safety', 'Dry Extraction', 'Water Misting', 'Power Distribution'];
  function group(p: Part) { return /^pm\d$/.test(p.id) ? names[0] : p.group === 'Sensors' ? names[1] : ['drivers','estop','estopSense','contactor'].includes(p.id) ? names[3] : p.group === 'Raspberry Pi and ESP32' ? names[2] : p.group; }
  const groups = names.filter(name => parts.some(p => group(p) === name));
  const positions = new Map<string, { x: number; y: number }>();
  const fixed: Record<string, [number, number, number]> = { 'PM Sensors': [20,20,1360], 'Environmental Sensors': [1420,20,2000], 'Main Controllers': [20,580,2080], 'Drivers & safety': [2140,580,1280], 'Dry Extraction': [20,1390,2080], 'Water Misting': [2140,1390,1280], 'Power Distribution': [3460,20,650] };
  const sections: { name: string; x: number; y: number; width: number; height: number; color: string }[] = [];
  const colors = ['#b453ed','#20dca1','#3fc9ed','#efab34','#d59529','#30b4ed','#8398aa'];
  for (const name of groups) {
    const list = parts.filter(p => group(p) === name), [gx,gy,gw] = fixed[name];
    let x = gx + 55, y = gy + 88, rowHeight = 0;
    for (const part of list) {
      const size = geometry(part);
      if (x + size.width + 30 > gx + gw) { x = gx + 55; y += rowHeight + 120; rowHeight = 0; }
      positions.set(part.id, { x, y }); rowHeight = Math.max(rowHeight,size.height); x += size.width + (name==='Environmental Sensors'?40:95);
    }
    sections.push({ name, x:gx,y:gy,width:gw,height:y+rowHeight+100-gy,color:colors[names.indexOf(name)] });
  }
  // Resolve vertical row collisions caused by the full 38-pin ESP32 carriers.
  const topBottom = Math.max(...sections.filter(s => ['PM Sensors','Environmental Sensors'].includes(s.name)).map(s=>s.y+s.height), 530);
  for (const section of sections.filter(s => s.y===580)) {
    const delta=Math.max(0,topBottom+50-section.y); section.y+=delta;
    for (const p of parts.filter(p=>group(p)===section.name)) { const pos=positions.get(p.id)!;positions.set(p.id,{...pos,y:pos.y+delta}); }
  }
  const middleBottom = Math.max(...sections.filter(s => ['Main Controllers','Drivers & safety'].includes(s.name)).map(s=>s.y+s.height), 1350);
  for (const section of sections.filter(s=>s.y===1390)) {
    const delta=Math.max(0,middleBottom+50-section.y); section.y+=delta;
    for (const p of parts.filter(p=>group(p)===section.name)) { const pos=positions.get(p.id)!;positions.set(p.id,{...pos,y:pos.y+delta}); }
  }
  return { positions, groups, sections, width: 4150, height: Math.max(...sections.map(s=>s.y+s.height))+35 };
}
