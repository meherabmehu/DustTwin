import { PARTS, WIRES, partStatus, type Part, type Wire } from './hardware';
import { sectionName, type CircuitView } from './circuitGraph';
import { geometry, wireColor } from './componentGeometry';
import PhysicalComponent from './PhysicalComponent';
import type { HardwareState } from './engine';

const specifications=[
  {name:'PM Sensors',x:16,y:16,width:566,columns:4,view:'PM Sensors'},
  {name:'Environmental Sensors',x:618,y:16,width:566,columns:4,view:'Environmental Sensors'},
  {name:'Main Controllers',x:16,y:172,width:696,columns:5,view:'Raspberry Pi and ESP32'},
  {name:'Drivers & safety',x:748,y:172,width:436,columns:4,view:'Safety & Protection'},
  {name:'Dry Extraction',x:16,y:282,width:500,columns:4,view:'Dry Extraction'},
  {name:'Water Misting',x:552,y:282,width:372,columns:4,view:'Water Misting'},
  {name:'Power Distribution',x:960,y:282,width:224,columns:2,view:'Power Distribution'},
] as const;
export function overviewLayout(){
  const positions=new Map<string,{x:number;y:number;width:number;height:number}>();
  const sections=specifications.map((s,index)=>{
    const order=s.name==='Dry Extraction'?['inlet0','inlet1','inlet2','inlet3','damper0','damper1','damper2','damper3','feedback0','feedback1','feedback2','feedback3','duct','cyclone','hepa','motor','bin']:[];
    const parts=PARTS.filter(p=>sectionName(p)===s.name).sort((a,b)=>order.length?order.indexOf(a.id)-order.indexOf(b.id):0),cellWidth=(s.width-24)/s.columns;
    parts.forEach((p,i)=>{const wet=s.name==='Water Misting',row=wet?(p.id.startsWith('valve')?1:p.id.startsWith('nozzle')?2:0):Math.floor(i/s.columns),col=wet?(p.id.startsWith('valve')||p.id.startsWith('nozzle')?Number(p.id.slice(-1)):['tank','pump','pipes'].indexOf(p.id)):i%s.columns;positions.set(p.id,{x:s.x+12+col*cellWidth,y:s.y+34+row*46,width:cellWidth-8,height:40});});
    return {...s,parts,height:Math.ceil(parts.length/s.columns)*46+40,color:['#b885ec','#38cbaa','#55c6ed','#e8b95e','#d6ac57','#53b9ee','#9fafbe'][index]};
  });
  return {positions,sections,width:1200,height:Math.max(...sections.map(s=>s.y+s.height))+16};
}
export function overviewRelationships(){
  const groups=new Map<string,Wire[]>();
  for(const w of WIRES){const from=sectionName(PARTS.find(p=>p.id===w.from)!),to=sectionName(PARTS.find(p=>p.id===w.to)!);const key=`${from}|${to}|${w.type}`;groups.set(key,[...(groups.get(key)||[]),w]);}
  return [...groups].map(([id,wires])=>({id,from:sectionName(PARTS.find(p=>p.id===wires[0].from)!),to:sectionName(PARTS.find(p=>p.id===wires[0].to)!),type:wires[0].type,wires}));
}
const shortNames:Record<string,string>={pi:'Pi 5 · 8GB',esp1:'ESP32 #1',esp2:'ESP32 #2',sht0:'SHT35',wind:'Wind speed',vane:'Wind vane',flow:'Flow sensor',pressure:'Water pressure',dp:'HEPA ΔP',mux:'TCA9548A',pullups:'I²C pull-ups',resetPullup:'RESET pull-up',conditioner:'ADC / pulse',drivers:'Driver bank',rs485:'RS485',estop:'E-stop',estopSense:'Stop feedback',contactor:'Contactor',duct:'Branch ducts',cyclone:'Cyclone',hepa:'HEPA filter',bin:'Dust bin',tank:'Water tank',pump:'Water pump',pipes:'Water manifold',mains:'AC enclosure',psu:'24V PSU',fanSupply:'12V PSU',buck:'5V regulator',piSupply:'Pi USB-C PSU',fuse:'DC fuses',breaker:'AC breaker',fan:'Test fan',level:'Tank level'};
function shortName(p:Part){if(shortNames[p.id])return shortNames[p.id];const match=p.id.match(/^(pm|damper|inlet|feedback|valve|nozzle)(\d)$/);return match?`${{pm:'SPS30',damper:'Damper',inlet:'Inlet',feedback:'Limit',valve:'Valve',nozzle:'Nozzle'}[match[1]]} ${'ABCD'[+match[2]]}`:p.id;}
export default function SystemOverview({state,zoom,selected,onPart,onSection,onRelationship,onWire}:{state:HardwareState;zoom:number;selected:string;onPart:(id:string)=>void;onSection:(view:CircuitView)=>void;onRelationship:(wires:Wire[])=>void;onWire:(wire:Wire)=>void}){
  const {sections,positions}=overviewLayout(),relations=overviewRelationships();
  return <>
    <defs><marker id="hw-overview-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="#5aafb8"/></marker></defs>
    {sections.map(s=><g key={s.name} data-overview-section={s.name}><rect x={s.x} y={s.y} width={s.width} height={s.height} rx="9" fill="#082331" stroke={s.color}/><g role="button" tabIndex={0} data-interactive="true" aria-label={`Open ${s.view} detailed wiring`} onClick={()=>onSection(s.view)} onKeyDown={e=>{if(e.key==='Enter')onSection(s.view);}}><rect x={s.x+1} y={s.y+1} width={s.width-2} height="33" rx="8" fill={`${s.color}16`}/><text x={s.x+12} y={s.y+23} fontSize={Math.max(17,13/zoom)} fill={s.color} fontWeight="600">{s.name}</text><title>Open readable {s.view} wiring</title></g></g>)}
    {relations.filter(r=>r.from!==r.to).map((r,i)=>{const a=sections.find(s=>s.name===r.from)!,b=sections.find(s=>s.name===r.to)!,down=a.y<b.y,same=a.y===b.y;
      const x1=same?a.x+a.width:a.x+a.width*(.25+(i%4)*.15),y1=same?a.y+34:a.y+(down?a.height:0),x2=same?b.x:b.x+b.width*(.25+(i%4)*.15),y2=same?b.y+34:b.y+(down?0:b.height),lane=same?(y1+y2)/2:(down?y2-14-(i%3)*4:y1-14-(i%3)*4);
      const path=same?`M${x1} ${y1}H${x2}`:`M${x1} ${y1}V${lane}H${x2}V${y2}`;
      return <g key={r.id} className="hw-overview-link" role="button" tabIndex={0} data-interactive="true" aria-label={`${r.from} to ${r.to}: ${r.wires.length} ${r.type} connections`} onClick={()=>onRelationship(r.wires)} onKeyDown={e=>{if(e.key==='Enter')onRelationship(r.wires);}}><title>{r.type} · {r.wires.length} exact connections · inspect to expand</title><path d={path} fill="none" stroke="transparent" strokeWidth="12"/><path d={path} fill="none" stroke={wireColor(r.wires[0])} strokeWidth="1.8" opacity=".7" strokeDasharray={['air','water'].includes(r.type)?'5 3':undefined} markerEnd="url(#hw-overview-arrow)"/></g>;
    })}
    {WIRES.filter(w=>['air','water'].includes(w.type)&&sectionName(PARTS.find(p=>p.id===w.from)!)===sectionName(PARTS.find(p=>p.id===w.to)!)).map(w=>{const a=positions.get(w.from)!,b=positions.get(w.to)!,x1=a.x+a.width/2,y1=a.y+a.height/2,x2=b.x+b.width/2,y2=b.y+b.height/2,active=w.type==='air'&&state.motor&&(!/^inlet|^damper/.test(w.from)||state.airflow[Number(w.from.slice(-1))]>0)||w.type==='water'&&state.pump&&(!w.from.startsWith('valve')||state.valves[Number(w.from.slice(-1))])&&(!w.to.startsWith('valve')||state.valves[Number(w.to.slice(-1))]);return <path key={w.id} data-interactive="true" d={`M${x1} ${y1}V${y2}H${x2}`} fill="none" stroke={wireColor(w)} opacity={active?.8:.25} className={active&&state.running?'hw-flow':''} strokeWidth="2" strokeDasharray="5 4" onClick={()=>onWire(w)}><title>{w.from}:{w.fromPin} → {w.to}:{w.toPin}</title></path>;})}
    {PARTS.map(p=>{const xy=positions.get(p.id)!,g=geometry(p),status=partStatus(p.id,state),scale=Math.min(33/g.width,32/g.height),label=shortName(p);return <g key={p.id} className={`hw-part hw-overview-part ${selected===p.id?'selected':''}`} data-part-id={p.id} data-interactive="true" role="button" tabIndex={0} aria-label={`${p.name}: ${status}`} onClick={()=>onPart(p.id)} onKeyDown={e=>{if(e.key==='Enter')onPart(p.id);}}><title>{p.name} · {status} · open exact pin wiring</title><rect x={xy.x} y={xy.y} width={xy.width} height={xy.height} rx="5" fill="#061b28" stroke={selected===p.id?'#44e6df':'#21495c'}/><g transform={`translate(${xy.x+4} ${xy.y+3}) scale(${scale})`}><PhysicalComponent part={p} active={['ON','OPEN','SPRAY','READY'].includes(status)} position={p.id.startsWith('damper')?state.position[Number(p.id.slice(-1))]:0}/></g><text x={xy.x+42} y={xy.y+16} fill={status==='FAULT'?'#ffab81':'#d0e9f2'} fontSize={xy.width<100?11.5:12.5}><tspan x={xy.x+42}>{label.split(' ')[0]}</tspan><tspan x={xy.x+42} dy="14">{label.split(' ').slice(1).join(' ')}</tspan></text></g>;})}
  </>;
}
