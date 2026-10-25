import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PARTS, WIRES, validateWiring, manifest, partStatus } from '../src/features/hardware-simulator/hardware';
import { initialState, reducer } from '../src/features/hardware-simulator/engine';
import { VIEWS, subsystem, layout } from '../src/features/hardware-simulator/circuitGraph';
import { geometry } from '../src/features/hardware-simulator/componentGeometry';
import { routeWires, sharedBuses } from '../src/features/hardware-simulator/wireRouting';

test('baseline inventory preserves all 59 parts and all 165 exact connection endpoints',()=>{
  assert.equal(PARTS.length,59);assert.equal(WIRES.length,165);
  const signature=JSON.stringify(WIRES.map(w=>[w.id,w.from,w.fromPin,w.to,w.toPin]));
  assert.equal(createHash('sha256').update(signature).digest('hex'),'ffca699338bad07fb9d5cade44c60eff53b03fc97928cdcd2f9744d3a34dd0b2');
  assert.equal(manifest.budget.allocations.reduce((n,a)=>n+a.allowance,0),120000);
});
test('reference rules reject wrong SPS30 voltage, input-only output, flash pins and mains-to-logic',()=>{
  const w=WIRES[0];
  for(const invalid of [
    {...w,to:'pm0',toPin:'1 VDD',voltage:'3.3V'},
    {...w,from:'esp2',fromPin:'GPIO34'},
    {...w,from:'esp2',fromPin:'D2'},
    {...w,from:'mains',fromPin:'ENCLOSED OUTPUT',to:'esp1',toPin:'GND'},
  ]) assert.ok(validateWiring([invalid]).length);
  assert.deepEqual(validateWiring(),[]);
});
test('every subsystem accounts for all internal and external links without dangling internal endpoints',()=>{
  for(const view of VIEWS){const graph=subsystem(view),ids=new Set(graph.parts.map(p=>p.id));
    const expected=WIRES.filter(w=>ids.has(w.from)||ids.has(w.to));
    assert.deepEqual([...graph.wires,...graph.external].map(w=>w.id).sort(),expected.map(w=>w.id).sort());
    for(const w of graph.external)assert.notEqual(ids.has(w.from),ids.has(w.to));
    const bounds=layout(graph.parts);for(const p of graph.parts){const xy=bounds.positions.get(p.id)!,g=geometry(p);assert.ok(xy.x>=0&&xy.y>=0&&xy.x+g.width<bounds.width&&xy.y+g.height<bounds.height);}
  }
});
test('all routed connections have exact physical anchors, orthogonal segments and avoid other component cards',()=>{
  for(const view of VIEWS){const graph=subsystem(view),d=layout(graph.parts),routes=routeWires(graph.parts,graph.wires,d.positions,d.width,d.height);
    assert.equal(routes.length,graph.wires.length);
    for(const {wire:w,points} of routes){
      for(const [id,pin,point] of [[w.from,w.fromPin,points[0]],[w.to,w.toPin,points.at(-1)!]] as const){const anchor=geometry(PARTS.find(p=>p.id===id)!).pins.get(pin)!,xy=d.positions.get(id)!;assert.deepEqual(point,{x:xy.x+anchor.x,y:xy.y+anchor.y});}
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i];assert.ok(a.x===b.x||a.y===b.y,`${view}/${w.id}: diagonal`);
        for(const p of graph.parts.filter(p=>p.id!==w.from&&p.id!==w.to)){
          const xy=d.positions.get(p.id)!,g=geometry(p),left=xy.x-18,right=xy.x+g.width+18,top=xy.y-33,bottom=xy.y+g.height+67;
          const hit=a.x===b.x?a.x>left&&a.x<right&&Math.max(a.y,b.y)>top&&Math.min(a.y,b.y)<bottom:a.y>top&&a.y<bottom&&Math.max(a.x,b.x)>left&&Math.min(a.x,b.x)<right;
          assert.equal(hit,false,`${view}/${w.id} crosses ${p.id}`);
        }
      }
    }
  }
});
test('bus collapsing preserves exact source-pin identity and every branch',()=>{
  const buses=sharedBuses(WIRES);assert.ok(buses.length>0);
  for(const bus of buses){assert.ok(bus.wires.length>2);assert.equal(new Set(bus.wires.map(w=>`${w.from}:${w.fromPin}:${w.type}:${w.voltage}`)).size,1);}
  assert.ok(!buses.some(b=>b.wires.some(w=>w.type==='air'||w.type==='water')));
});
test('component measurements distinguish failed sensors, lost links and safe-off drivers',()=>{
  const s=initialState();assert.equal(partStatus('drivers',s),'SAFE OFF');
  assert.equal(partStatus('wind',reducer(s,{type:'fault',value:'wind'})),'FAULT');
  assert.equal(partStatus('motor',reducer(s,{type:'fault',value:'motor'})),'FAULT');
  assert.equal(partStatus('esp1',reducer(s,{type:'fault',value:'comm'})),'LINK LOST');
  assert.equal(partStatus('feedback0',s),'NOT CONFIRMED');
});
