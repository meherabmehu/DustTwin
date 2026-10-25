import { PARTS, WIRES, type Part, type Wire } from './hardware';
import { geometry } from './componentGeometry';
export const VIEWS = ['Complete System', 'Raspberry Pi and ESP32', 'PM Sensors', 'Environmental Sensors', 'Dry Extraction', 'Water Misting', 'Power Distribution', 'Communication', 'Safety & Protection'] as const;
export type CircuitView = typeof VIEWS[number];
export function subsystem(view: CircuitView): { parts: Part[]; wires: Wire[]; external: Wire[] } {
  if (view === 'Complete System') return { parts: PARTS, wires: WIRES, external: [] };
  const ids = new Set<string>(), add = (...v: string[]) => v.forEach(id => ids.add(id));
  if (view === 'PM Sensors') add('pm0','pm1','pm2','pm3','mux','pullups','resetPullup','esp1','buck');
  else if (view === 'Environmental Sensors') { PARTS.filter(p => p.group === 'Sensors' && !/^pm\d$/.test(p.id)).forEach(p => ids.add(p.id)); add('esp1','mux','rs485','conditioner'); }
  else if (view === 'Communication') add('pi','esp1','esp2','rs485','wind','vane','mux','sht0','dp','pullups','resetPullup');
  else if (view === 'Safety & Protection') add('breaker','mains','fuse','psu','fanSupply','estop','estopSense','contactor','drivers','esp2','level','feedback0','feedback1','feedback2','feedback3');
  else { PARTS.filter(p => p.group === view).forEach(p => ids.add(p.id)); if (view === 'Dry Extraction' || view === 'Water Misting') add('esp2','drivers','estopSense'); if (view === 'Dry Extraction') add('dp'); if (view === 'Water Misting') add('flow','pressure','level','conditioner'); }
  return { parts: PARTS.filter(p => ids.has(p.id)), wires: WIRES.filter(w => ids.has(w.from) && ids.has(w.to)), external: WIRES.filter(w => ids.has(w.from) !== ids.has(w.to)) };
}
export function sectionName(p: Part) {
  if (/^pm\d$/.test(p.id) || ['mux','pullups','resetPullup'].includes(p.id)) return 'PM Sensors';
  if (p.group === 'Sensors') return 'Environmental Sensors';
  if (['drivers','estop','estopSense','contactor'].includes(p.id)) return 'Drivers & safety';
  return p.group === 'Raspberry Pi and ESP32' ? 'Main Controllers' : p.group;
}
export function layout(parts: Part[]) {
  const names = ['PM Sensors','Environmental Sensors','Main Controllers','Drivers & safety','Dry Extraction','Water Misting','Power Distribution'];
  const colors = ['#b453ed','#20dca1','#3fc9ed','#efab34','#d59529','#30b4ed','#8398aa'];
  const positions = new Map<string,{x:number;y:number}>();
  const sections: {name:string;x:number;y:number;width:number;height:number;color:string}[]=[];
  for (const name of names) {
    let list=parts.filter(p=>sectionName(p)===name); if(!list.length)continue;
    const order=name==='Dry Extraction'?['inlet0','inlet1','inlet2','inlet3','damper0','damper1','damper2','damper3','feedback0','feedback1','feedback2','feedback3','duct','cyclone','hepa','motor','bin']:name==='Water Misting'?['tank','pump','pipes','valve0','valve1','valve2','valve3','nozzle0','nozzle1','nozzle2','nozzle3']:[];
    if(order.length)list=[...list].sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
    const columns=name==='Main Controllers'?3:name==='Power Distribution'?2:4;
    let y=110,sectionWidth=0;
    for(let start=0;start<list.length;start+=columns){
      const row=list.slice(start,start+columns);
      let x=80;row.forEach(p=>{positions.set(p.id,{x,y});x+=geometry(p).width+160;});
      sectionWidth=Math.max(sectionWidth,x-60);
      y+=Math.max(...row.map(p=>geometry(p).height))+200;
    }
    sections.push({name,x:0,y:0,width:sectionWidth,height:y-55,color:colors[names.indexOf(name)]});
  }
  const shelfWidth=parts.length===PARTS.length?5200:4000;
  let x=40,y=40,rowHeight=0;
  for(const section of sections){
    if(x>40&&x+section.width>shelfWidth){x=40;y+=rowHeight+140;rowHeight=0;}
    section.x=x;section.y=y;
    for(const p of parts.filter(p=>sectionName(p)===section.name)){const pos=positions.get(p.id)!;positions.set(p.id,{x:pos.x+x,y:pos.y+y});}
    x+=section.width+140;rowHeight=Math.max(rowHeight,section.height);
  }
  return {positions,groups:sections.map(s=>s.name),sections,width:Math.max(...sections.map(s=>s.x+s.width),0)+80,height:Math.max(...sections.map(s=>s.y+s.height),0)+80};
}
