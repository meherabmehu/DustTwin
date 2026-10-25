import { useState } from 'react';
import { Box, CircuitBoard, Download, Layers, Search } from 'lucide-react';
import { PARTS, partStatus } from './hardware';
import { geometry } from './componentGeometry';
import PhysicalComponent from './PhysicalComponent';
import type { HardwareState } from './engine';
import type { CircuitView } from './circuitGraph';
import { downloadCircuit } from './CircuitWorkspace';
export default function LabSidebar({state,onView,onPanel,onPart}:{state:HardwareState;onView:(v:CircuitView)=>void;onPanel:(panel:string)=>void;onPart:(id:string)=>void}){
  const [search,setSearch]=useState(''),[active,setActive]=useState('Complete System');
  const nav:Array<[string,CircuitView?]>=[['Complete System','Complete System'],['3D Physical View'],['Circuit Diagram','Complete System'],['Controllers','Raspberry Pi and ESP32'],['PM Sensors','PM Sensors'],['Environmental Sensors','Environmental Sensors'],['Dry Extraction System','Dry Extraction'],['Water Misting System','Water Misting'],['Power Distribution','Power Distribution'],['Code & Firmware'],['Test Scenarios'],['Live Sensor Data'],['Actuator Control'],['Bill of Materials'],['Wiring Diagram Download']];
  return <aside className="hw-reference-sidebar"><div className="hw-sidebar-title">Hardware Simulator <Layers size={15}/></div><nav aria-label="Hardware lab sections">{nav.map(([name,view],i)=><button className={name===active?'selected':''} key={name} onClick={()=>{setActive(name);if(name==='Wiring Diagram Download')downloadCircuit();else if(view)onView(view);else onPanel(name);}}>{i===1?<Box size={15}/>:i===14?<Download size={15}/>:<CircuitBoard size={15}/>}<span>{name}</span></button>)}</nav><div className="hw-sidebar-title">Component library</div><label className="hw-search"><Search size={13}/><input aria-label="Search components" placeholder="Search parts or pins…" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="hw-reference-library">{PARTS.filter(p=>`${p.name} ${p.pins.join(' ')}`.toLowerCase().includes(search.toLowerCase())).map(p=>{const size=geometry(p);return <button key={p.id} onClick={()=>onPart(p.id)}><svg width="43" height="34" viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true"><PhysicalComponent part={p} active={false}/></svg><span>{p.name}<small>{partStatus(p.id,state)}</small></span></button>;})}</div></aside>;
}
