import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { DEFAULT_CONFIG, FAULTS, SCENARIOS, decision, initialState, reducer, validateConfig, type HardwareState } from '../src/features/hardware-simulator/engine';
import { PARTS, WIRES, manifest, validateWiring } from '../src/features/hardware-simulator/hardware';
import { VIEWS, layout, subsystem } from '../src/features/hardware-simulator/circuitGraph';
import { actuatorCommand, sensorFrame, validateFrame } from '../src/features/hardware-simulator/communication';
import { geometry } from '../src/features/hardware-simulator/componentGeometry';
import { zipProject } from '../src/features/hardware-simulator/projectExport';
import { calculateCombinedRisk } from '../src/features/simulation/riskModel';
import { getBoundaryDistanceM, getBoundaryGeometries, getPlumeEstimate } from '../src/features/simulation/plumeModel';

const scenario = (name = 'Northwest wind') => reducer(initialState(), { type: 'scenario', name });
function ticks(s: HardwareState, n = 4) { for (let i = 0; i < n; i++) s = reducer(s, { type: 'tick' }); return s; }
test('complete proposed BOM retains all requested equipment and adds actual RS485 / feedback interfaces', () => {
  assert.equal(PARTS.filter(p => /^pm\d$/.test(p.id)).length, 4);
  assert.equal(PARTS.filter(p => /^sht\d$/.test(p.id)).length, 1);
  for (const id of ['pi','esp1','esp2','rs485','mux','level','estop','estopSense','hepa','cyclone','bin','motor','pump','fan','psu','fanSupply','buck','fuse']) assert.ok(PARTS.some(p => p.id === id), id);
  for (let i = 0; i < 4; i++) for (const prefix of ['damper','valve','inlet','nozzle','feedback']) assert.ok(PARTS.some(p => p.id === `${prefix}${i}`));
  assert.equal(new Set(PARTS.map(p => p.id)).size, PARTS.length);
});
test('authoritative manifest validates endpoints, GPIOs, voltage and reference metadata', () => {
  assert.deepEqual(validateWiring(), []);
  assert.equal(new Set(WIRES.map(w => w.id)).size, WIRES.length);
  for (const w of WIRES) for (const field of ['voltage','currentRequirement','interface','isolation']) assert.ok(w[field as keyof typeof w], `${w.id} ${field}`);
  for (let i = 0; i < 4; i++) assert.ok(WIRES.some(w => w.from === 'mux' && w.fromPin === `SD${i}` && w.to === `pm${i}`));
  assert.equal(manifest.field.windSpeedAddress, 2); assert.equal(manifest.field.windDirectionAddress, 3);
  assert.equal(manifest.power.find(p => p.rail === '12V')?.ratedA, 12.5);
});
test('invalid input voltage and driver bypass are caught', () => {
  const w = WIRES.find(w => w.to === 'esp1' && w.toPin === 'GPIO35')!;
  assert.match(validateWiring([{ ...w, voltage: '5V' }]).join(), /unsafe GPIO/);
  assert.match(validateWiring([{ ...w, toPin: 'invented' }]).join(), /unknown/);
  assert.match(validateWiring([{ ...w, from: 'esp2', fromPin: 'GPIO13', type: 'control' }]).join(), /external driver/);
});
test('generated firmware and assembly table are synchronized with the sole manifest', () => {
  assert.match(execFileSync('python', ['hardware/tools/generate.py', '--check'], { encoding: 'utf8' }), /verified/);
  assert.deepEqual(JSON.parse(readFileSync('public/hardware/manifest.json','utf8')), manifest);
});
test('each subsystem includes only complete endpoint pairs and automatically lays out without overlaps', () => {
  for (const view of VIEWS) {
    const graph = subsystem(view), ids = new Set(graph.parts.map(p => p.id)), positions = layout(graph.parts).positions;
    for (const w of graph.wires) assert.ok(ids.has(w.from) && ids.has(w.to), `${view}/${w.id}`);
    assert.equal(new Set([...positions.values()].map(p => `${p.x},${p.y}`)).size, graph.parts.length);
    const list = graph.parts.map(p=>({...positions.get(p.id)!,...geometry(p)}));
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const a=list[i],b=list[j];assert.ok(a.x+a.width+18<=b.x-18||b.x+b.width+18<=a.x-18||a.y+a.height+67<=b.y-33||b.y+b.height+67<=a.y-33, `${view}: component overlap`); }
  }
  assert.ok(!subsystem('PM Sensors').parts.some(p => p.id === 'motor'));
  assert.ok(subsystem('Environmental Sensors').parts.some(p => p.id === 'rs485'));
});
test('four independent PM channels vary with transport and deterministic sampling/noise', () => {
  const a = ticks(scenario(), 20), b = ticks(scenario(), 20);
  assert.deepEqual(a, b);
  assert.ok(new Set(a.channels.map(c => c.pm10.toFixed(3))).size >= 4);
  assert.ok(a.channels.every(c => c.valid && c.pm10 >= c.pm25));
  assert.ok(a.channels[0].pm10 > a.channels[1].pm10);
});
test('individual channels support overrides, sample interval, independent faults and recovery', () => {
  let s = reducer(scenario(), { type: 'channel', index: 1, values: { pm25: 100, pm10: 200, intervalSeconds: 2, noisePercent: 0 } });
  s = ticks(s, 1); assert.equal(s.channels[1].sampleSecond, 0); s = ticks(s, 1); assert.equal(s.channels[1].sampleSecond, 2);
  assert.equal(s.channels[1].pm10, 200);
  s = reducer(s, { type: 'channel', index: 2, values: { fault: 'disconnected' } });
  assert.equal(s.channels[2].valid, false); assert.equal(s.channels[1].valid, true); assert.equal(s.motor, false);
  s = reducer(s, { type: 'channel', index: 2, values: { fault: 'none', override: false } }); s = ticks(s, 2);
  assert.equal(s.channels[2].valid, true);
});
test('PM10 less than PM2.5 is invalid and cannot energize outputs', () => {
  let s = ticks(scenario()); s = reducer(s, { type: 'channel', index: 0, values: { pm25: 200, pm10: 10 } });
  assert.equal(s.channels[0].status, 'INVALID'); assert.equal(s.motor, false); assert.equal(s.pump, false);
});
test('normal air quality and No Control keep all suppression outputs off', () => {
  for (const name of ['Normal air quality', 'No control baseline']) { const s = ticks(scenario(name), 20); assert.equal(s.motor, false); assert.equal(s.pump, false); assert.ok(s.relayDry.every(v => !v)); }
});
test('NW selects A/D; motor waits for both fully open dampers; branch flows obey resistance', () => {
  let s = scenario(); assert.deepEqual(s.dampers, ['OPENING','CLOSED','CLOSED','OPENING']);
  s = ticks(s, 1); assert.equal(s.motor, false); s = ticks(s, 2);
  assert.equal(s.motor, true); assert.deepEqual(s.dampers, ['OPEN','CLOSED','CLOSED','OPEN']);
  assert.ok(s.airflow[0] > 0 && s.airflow[3] > 0 && s.airflow[1] === 0 && s.airflow[2] === 0);
  assert.ok(s.airflow.reduce((a,b) => a+b,0) <= s.config.nominalAirflowM3h);
});
test('direction changes close inactive branches and open only the new exposed zone', () => {
  let s = ticks(scenario()); s = reducer(s, { type: 'input', key: 'windDirection', value: 90 }); s = ticks(s, 4);
  assert.deepEqual(s.dampers, ['CLOSED','OPEN','CLOSED','CLOSED']); assert.ok(s.airflow[1] > 0);
});
test('strategy rules distinguish hood drilling from open-air soil', () => {
  assert.equal(decision(scenario('Heavy drilling')).strategy, 'Dry Extraction');
  assert.equal(decision(scenario('Open-air soil dust')).strategy, 'Targeted Misting');
  for (const [name, dry, wet] of [['Dry extraction active',true,false],['Misting active',false,true],['Hybrid operation',true,true]] as const) { const s=ticks(scenario(name)); assert.equal(s.motor,dry); assert.equal(s.pump,wet); }
});
test('shared risk formula, wind mapping and deterministic lead are reused without AI claims', () => {
  const s=scenario(); const d=decision(s);
  assert.equal(d.risk.score,calculateCombinedRisk(s.inputs,d.peak25).score); assert.deepEqual(d.exposed,[true,false,false,true]);
  assert.ok(d.leadTime !== null && d.leadTime > 0);
});
test('capture routes mass to cyclone bin and HEPA; control changes future modeled concentrations', () => {
  const controlled=ticks(scenario('Hybrid operation'),60), baseline=ticks(scenario('No control baseline'),60);
  assert.ok(controlled.capturedG > 0 && controlled.binG > 0 && controlled.filterG > 0);
  assert.ok(controlled.capturedG >= controlled.binG + controlled.filterG);
  assert.ok(controlled.channels[0].pm10 < baseline.channels[0].pm10);
  assert.ok(controlled.hepaPa > 45);
});
test('duct resistance reduces flow and produces insufficient-flow warnings', () => {
  let s=scenario('Dry extraction active'); s=reducer(s,{type:'config',value:{...DEFAULT_CONFIG,branchResistance:1}});s=ticks(s);
  assert.ok(s.airflow[0] < 100); assert.ok(s.warnings.some(w=>w.includes('Insufficient')));
});
test('tank drawdown matches flow integration and empty tank inhibits pump', () => {
  const s=ticks(scenario('Misting active'),20); assert.ok(s.waterUsedL>0); assert.ok(Math.abs(s.tankL+s.waterUsedL-s.config.tankCapacityL)<1e-8);
  let empty=reducer(s,{type:'fault',value:'lowWater'});assert.equal(empty.pump,false);assert.equal(empty.flowLpm,0);
  empty=reducer(empty,{type:'refill'});assert.equal(empty.tankL,empty.config.tankCapacityL);
});
test('all explicit faults change real state and scenarios remain repeatable', () => {
  for (const [fault,label] of Object.entries(FAULTS).filter(([key])=>key!=='none')) { const a=ticks(scenario(label)),b=ticks(scenario(label));assert.deepEqual(a,b,label);assert.equal(a.fault,fault); }
  assert.ok(Object.keys(SCENARIOS).length>=25);
});
test('sensor, wind and power faults inhibit suppression; damper fault preserves healthy branch', () => {
  for (const fault of ['sensor','invalid','wind','power','estop'] as const) { const s=reducer(ticks(scenario()),{type:'fault',value:fault}); assert.equal(s.motor,false);assert.equal(s.pump,false); }
  const jam=ticks(scenario(FAULTS.damper));assert.equal(jam.dampers[0],'FAULT');assert.equal(jam.airflow[0],0);assert.ok(jam.airflow[3]>0);
  assert.equal(ticks(scenario(FAULTS.damperOpen)).motor,false);
});
test('motor, HEPA, pump, valve and pressure faults isolate affected subsystems', () => {
  for (const fault of ['motor','hepa'] as const) { const s=ticks(scenario(FAULTS[fault]));assert.equal(s.motor,false);assert.equal(s.pump,true); }
  for (const fault of ['pump','valve','pressure'] as const) { const s=ticks(scenario(FAULTS[fault]));assert.equal(s.motor,true);assert.equal(s.pump,false);assert.equal(s.flowLpm,0); }
});
test('communication and host heartbeat loss trip watchdog and require explicit recovery', () => {
  for (const fault of ['comm','pi'] as const) { let s=reducer(ticks(scenario()),{type:'fault',value:fault});s=ticks(s,4);assert.equal(s.armed,false);assert.equal(s.motor,false);assert.equal(s.pump,false); s=reducer(s,{type:'fault',value:'none'});s=ticks(s);assert.equal(s.armed,false);s=reducer(s,{type:'start'});s=ticks(s,4);assert.equal(s.armed,true);assert.equal(s.motor,true); }
});
test('manual commands remain subject to open feedback, pump-valve and safety interlocks', () => {
  let s=reducer(initialState(),{type:'mode',value:'Manual'});s=reducer(s,{type:'start'});s=reducer(s,{type:'output',target:'manualMotor'});s=reducer(s,{type:'output',target:'manualPump'});
  assert.equal(s.motor,false);assert.equal(s.pump,false);
  s=reducer(s,{type:'manual',target:'manualDry',index:1});s=reducer(s,{type:'manual',target:'manualWet',index:2});s=ticks(s);
  assert.equal(s.motor,true);assert.equal(s.pump,true);assert.deepEqual(s.valves,[false,false,true,false]);
  s=reducer(s,{type:'fault',value:'estop'});assert.equal(s.motor,false);assert.equal(s.pump,false);
});
test('pause freezes time, step advances one second, reset restores all balances', () => {
  let s=reducer(ticks(scenario()),{type:'pause'});assert.deepEqual(reducer(s,{type:'tick'}),s);const old=s.second;s=reducer(s,{type:'step'});assert.equal(s.second,old+1);assert.equal(s.running,false);assert.deepEqual(reducer(s,{type:'reset'}),initialState());
});
test('AI history contains only actual causal source samples and no prefill', () => {
  assert.equal(initialState().history.length,0);let s=ticks(scenario(),130);assert.equal(s.history.length,121);assert.equal(s.history[0].time_seconds,10);assert.equal(s.history.at(-1)?.time_seconds,130);assert.ok(s.history.every(p=>p.observation_time_seconds<=p.time_seconds));
  s=reducer(s,{type:'channel',index:0,values:{fault:'disconnected'}});s=ticks(s,1);assert.equal(s.history.length,0);
});
test('real protocol frames reflect model state and cannot be confused with firmware ACKs', () => {
  const s=ticks(scenario()); const telemetry=JSON.parse(sensorFrame(s)), command=JSON.parse(actuatorCommand(s));
  assert.equal(validateFrame(telemetry),true);assert.equal(telemetry.payload.pm.length,4);assert.equal(telemetry.payload.origin,'browser-model');assert.deepEqual(command.payload.dampers,[true,false,false,true]);assert.equal(command.payload.motor,true);assert.equal(validateFrame({...telemetry,seq:-1}),false);
});
test('invalid configuration cannot execute and actual travel changes are honored', () => {
  assert.throws(()=>validateConfig({...DEFAULT_CONFIG,damperTravelSeconds:0}));assert.throws(()=>validateConfig({...DEFAULT_CONFIG,arbitrary:'code'}));assert.throws(()=>validateConfig(null));
  let s=reducer(scenario(),{type:'config',value:{...DEFAULT_CONFIG,damperTravelSeconds:6}});s=ticks(s,3);assert.equal(s.dampers[0],'OPENING');assert.equal(s.motor,false);s=ticks(s,3);assert.equal(s.motor,true);
});
test('Python host commands drive actual browser actuator requests and fail closed when disconnected', () => {
  let s=reducer(scenario(),{type:'host',enabled:true});assert.equal(s.motor,false);s=reducer(s,{type:'host-command',command:{dampers:[false,true,false,false],valves:[false,false,true,false],motor:true,pump:true,fan:false,safe:true},status:'Python host executed'});s=ticks(s);assert.equal(s.motor,true);assert.ok(s.airflow[1]>0);assert.deepEqual(s.valves,[false,false,true,false]);s=reducer(s,{type:'host-command',command:null,status:'offline'});assert.equal(s.motor,false);assert.equal(s.pump,false);
});
test('firmware project ZIP is a genuine readable archive and blocks path traversal', () => {
  const zip=zipProject({'firmware/main.cpp':'int main() { return 0; }','manifest.json':'{}'});
  const result=execFileSync('python',['-c',"import io,zipfile,sys; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None; print(z.read('firmware/main.cpp').decode())"],{input:zip,encoding:'utf8'});assert.match(result,/int main/);assert.throws(()=>zipProject({'../escape':'x'}));
});
test('Python host and existing TS risk, wind and transport formulas agree across environment fixtures', () => {
  const cases = [];
  for (const bearing of [0, 45, 90, 135, 180, 225, 270, 315, 359]) for (const pm of [15, 55, 170]) {
    let s = reducer(scenario(), { type: 'input', key: 'windDirection', value: bearing });
    s = reducer(s, { type: 'input', key: 'pm25', value: pm });
    const p = JSON.parse(sensorFrame(s)).payload, d = decision(s), active = d.exposed;
    cases.push({ payload: p, score: d.risk.score, level: d.risk.status, zones: active, lead: Math.round(Math.min(...getBoundaryGeometries().filter((_, i) => active[i]).map(b => getBoundaryDistanceM(b))) / getPlumeEstimate(s.inputs).effectiveVelocityMps) });
  }
  const code = "import json,sys;sys.path.insert(0,'hardware/pi');from controller import risk_score,directional_zones,transport_lead;cases=json.load(sys.stdin);[(lambda s: (None if (risk_score(s['payload'])==(s['score'],s['level']) and directional_zones(s['payload']['windDirection'])==s['zones'] and transport_lead(s['payload'])==s['lead']) else (_ for _ in ()).throw(AssertionError(str(s)))))(s) for s in cases];print('27 parity fixtures passed')";
  assert.match(execFileSync('python',['-c',code],{input:JSON.stringify(cases),encoding:'utf8'}),/27 parity fixtures passed/);
});
test('every authoritative connection has actual drawable pin anchors, including full 38-pin carriers',()=>{
  for(const w of WIRES){assert.ok(geometry(PARTS.find(p=>p.id===w.from)!).pins.has(w.fromPin),`${w.id} source anchor`);assert.ok(geometry(PARTS.find(p=>p.id===w.to)!).pins.has(w.toPin),`${w.id} destination anchor`);}
  assert.equal(geometry(PARTS.find(p=>p.id==='esp1')!).pins.size,39); // 38 carrier pins + USB connector
  assert.equal(geometry(PARTS.find(p=>p.id==='esp2')!).pins.size,39);
});
test('Stop clears requests and de-energizes all hazards; PM size bins remain valid on immediate overrides',()=>{
  let s=ticks(scenario());s=reducer(s,{type:'stop'});assert.equal(s.running,false);assert.equal(s.motor,false);assert.equal(s.pump,false);assert.equal(s.fan,false);assert.ok(s.relayDry.every(v=>!v));assert.ok(s.relayWet.every(v=>!v));
  s=reducer(s,{type:'channel',index:0,values:{pm25:5,pm10:10}});assert.ok(s.channels[0].pm1<=5&&s.channels[0].pm4>=5&&s.channels[0].pm4<=10);
});
