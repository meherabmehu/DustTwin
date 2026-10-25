import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTS, WIRES } from '../src/features/hardware-simulator/hardware';
import { layout, sectionName } from '../src/features/hardware-simulator/circuitGraph';
import { fitCamera, DETAIL_MIN_ZOOM } from '../src/features/hardware-simulator/circuitViewport';
import { overviewLayout, overviewRelationships } from '../src/features/hardware-simulator/SystemOverview';

test('overview preserves every part once and every connection in traceable relationship groups',()=>{
  const d=overviewLayout();assert.equal(d.positions.size,59);assert.equal(new Set(d.sections.flatMap(s=>s.parts.map(p=>p.id))).size,59);
  assert.deepEqual(overviewRelationships().flatMap(r=>r.wires.map(w=>w.id)).sort(),WIRES.map(w=>w.id).sort());
  for(const p of PARTS){const a=d.positions.get(p.id)!;assert.ok(a.x>=0&&a.y>=0&&a.x+a.width<=d.width&&a.y+a.height<=d.height);}
  assert.ok(d.width/d.height>1.3,'compact architecture bounds');
});
test('both layout modes place sensors above controllers and flows/power below, without section overlap',()=>{
  for(const d of [layout(PARTS),overviewLayout()]){
    const section=(name:string)=>d.sections.find(s=>s.name===name)!;
    assert.equal(section('PM Sensors').y,section('Environmental Sensors').y);
    assert.equal(section('Main Controllers').y,section('Drivers & safety').y);
    assert.equal(section('Dry Extraction').y,section('Power Distribution').y);
    assert.ok(section('PM Sensors').y+section('PM Sensors').height<section('Main Controllers').y);
    assert.ok(section('Main Controllers').y+section('Main Controllers').height<section('Dry Extraction').y);
    for(const a of d.sections)for(const b of d.sections)if(a!==b)assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,`${a.name}/${b.name}`);
  }
  assert.equal(sectionName(PARTS.find(p=>p.id==='rs485')!),'Main Controllers');
});
test('default overview fits width without making labels tiny; whole overview is an explicit separate action',()=>{
  const d=overviewLayout(),bounds={x:0,y:0,width:d.width,height:d.height};
  for(const width of [1150,1220,1700]){
    const viewport={width,height:480};
    const initial=fitCamera(bounds,viewport,'overview');assert.ok(initial.zoom>=.9);assert.equal(initial.top,0);
    const all=fitCamera(bounds,viewport,'overview',true);assert.ok(all.zoom<initial.zoom);assert.ok(bounds.height*all.zoom<=viewport.height);
  }
});
test('detailed fit enforces readable pin size rather than fitting all hardware at 13%',()=>{
  for(const viewport of [{width:1150,height:480},{width:1220,height:600},{width:1700,height:740}]){
    const camera=fitCamera({x:1600,y:800,width:3000,height:2000},viewport,'detail');
    assert.ok(camera.zoom>=DETAIL_MIN_ZOOM);assert.ok(12*camera.zoom>=10);assert.ok(camera.left>=0&&camera.top>=0);
  }
});
