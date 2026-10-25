import manifest from '../../../hardware/manifest.json';
import { BOUNDARIES, ZONES, type HardwareState } from './engine';
export const GROUPS = ['Sensors', 'Raspberry Pi and ESP32', 'Dry Extraction', 'Water Misting', 'Power Distribution'] as const;
export type Group = typeof GROUPS[number];
export interface Part { id: string; name: string; group: Group; kind: 'board' | 'sensor' | 'motor' | 'valve' | 'passive' | 'power'; pins: string[]; note: string; verified: boolean; reference?: string; readiness?: string; currentRequirement?: string }
export interface Wire { id: string; from: string; fromPin: string; to: string; toPin: string; type: 'data' | 'control' | 'power' | 'ground' | 'air' | 'water'; voltage: string; purpose: string; currentRequirement?: string; interface?: string; isolation?: string }
export const PARTS = manifest.parts as Part[];
export const WIRES = manifest.wires as Wire[];
export const ACTUATOR_GPIO = manifest.controllers.actuator.outputs;
export { manifest };
export const WIRE_COLORS: Record<Wire['type'], string> = { power: '#fb917a', ground: '#8392a5', data: '#40d7ef', control: '#c4a1ff', air: '#5eebba', water: '#4da7ff' };
export function validateWiring(connections: Wire[] = WIRES): string[] {
  const errors: string[] = [];
  for (const w of connections) {
    const a = PARTS.find(p => p.id === w.from), b = PARTS.find(p => p.id === w.to);
    if (!a?.pins.includes(w.fromPin) || !b?.pins.includes(w.toPin)) errors.push(`${w.id}: unknown component or pin`);
    if (w.to.startsWith('esp') && w.toPin.startsWith('GPIO') && w.voltage !== '3.3V' && w.voltage !== '0–3.3V') errors.push(`${w.id}: unsafe GPIO voltage`);
    if (w.type === 'control' && w.from.startsWith('esp') && w.to !== 'drivers') errors.push(`${w.id}: actuator requires external driver`);
    if ([w.fromPin,w.toPin].some(pin => manifest.carrierHeaders.reservedFlash.includes(pin)) && [w.from,w.to].some(id=>id.startsWith('esp'))) errors.push(`${w.id}: reserved flash pin`);
    if (w.from.startsWith('esp') && /^GPIO(34|35|36|39)$/.test(w.fromPin)) errors.push(`${w.id}: input-only GPIO used as output`);
    if ((w.from==='mains'||w.from==='breaker') && [w.to].some(id=>id.startsWith('esp')||id==='pi')) errors.push(`${w.id}: mains-to-logic connection`);
    if (/^pm\d$/.test(w.to) && w.toPin==='1 VDD' && w.voltage!=='5V') errors.push(`${w.id}: SPS30 requires 4.5–5.5V supply`);
    if (['data','control'].includes(w.type) && [w.from,w.to].includes('mux') && w.voltage!=='3.3V') errors.push(`${w.id}: mux bus must match configured 3.3V pull-ups`);
    if (w.from==='drivers' && /^OUT[1-8]$/.test(w.fromPin) && w.voltage!=='24V') errors.push(`${w.id}: damper/valve load requires configured 24V rail`);
    if (w.from==='conditioner' && w.to.startsWith('esp') && w.voltage!=='0–3.3V') errors.push(`${w.id}: field signal must pass through 3.3V conditioning`);
    if (w.from==='rs485' && w.to.startsWith('esp') && w.voltage!=='3.3V') errors.push(`${w.id}: transceiver logic must be 3.3V`);
  }
  if (connections === WIRES) {
    const sensorPins = Object.values(manifest.controllers.sensor);
    const actuatorPins = [...manifest.controllers.actuator.outputs, ...manifest.controllers.actuator.openFeedback, manifest.controllers.actuator.estop];
    if (new Set(sensorPins).size !== sensorPins.length || new Set(actuatorPins).size !== actuatorPins.length) errors.push('Controller GPIO conflict');
    if (manifest.controllers.actuator.outputs.some(pin => pin >= 34 || [0, 2, 5, 12, 15].includes(pin))) errors.push('Invalid output GPIO assignment');
    for (const wire of connections) if (wire.from === 'drivers' && wire.to === 'pump' && wire.voltage !== '12V') errors.push('Pump power domain mismatch');
    for (let i=0;i<4;i++) for(const [prefix,pin] of [['SD','2 SDA'],['SC','3 SCL']]) if(!connections.some(w=>w.from==='mux'&&w.fromPin===`${prefix}${i}`&&w.to===`pm${i}`&&w.toPin===pin)) errors.push(`SPS30 ${i}: mux channel mismatch`);
    for (const [i,gpio] of manifest.controllers.actuator.outputs.entries()) if(!connections.some(w=>w.from==='esp2'&&w.fromPin===`GPIO${gpio}`&&w.to==='drivers'&&w.toPin===`IN${i+1}`)) errors.push(`Driver ${i+1}: firmware GPIO mismatch`);
  }
  return errors;
}
export const WIRING_NOTES = [
  'Reference topology: ESP32-WROOM-32 DevKit. Exact field sensors, actuator ratings, carrier connectors, fuses and drivers remain to be selected.',
  'Four SPS30 devices share fixed address 0x69: TCA9548A channels 0–3; one SHT35 on channel 4. Only one channel may be active. Keep I²C local; long boundary cables require a separately designed differential/RS485 interface.',
  'USB/UART links include USB power and ground. No raw 5V UART signal connects to GPIO. All I²C pull-ups are 3.3V; field inputs pass through conditioning.',
  'Mains is represented only by protected enclosure interfaces. Driver isolation, contactor safety chain, earthing, overloads and electrical installation require a qualified hardware design.',
];
export function partStatus(id: string, s: HardwareState): string {
  if (s.fault === 'power') return 'OFF';
  if (id==='motor' && s.fault==='motor' || id==='pi' && s.fault==='pi' || ['wind','vane'].includes(id) && s.fault==='wind') return 'FAULT';
  if (id.startsWith('esp') && s.fault==='comm') return 'LINK LOST';
  if (id.startsWith('feedback')) return s.position[Number(id.slice(-1))]>=.99?'OPEN CONFIRMED':'NOT CONFIRMED';
  if (id==='level') return s.fault==='lowWater'||s.tankL<=.5?'LOW / OPEN CONTACT':'HEALTHY NC';
  if (id==='estopSense') return s.fault==='estop'?'TRIPPED / OPEN':'HEALTHY NC';
  if (id==='drivers') return s.armed?'ARMED (model)':'SAFE OFF';
  if (id==='duct') return `${s.airflow.reduce((n,q)=>n+q,0).toFixed(0)} m³/h estimate`;
  if (id==='pipes') return `${s.flowLpm.toFixed(2)} L/min · ${s.pressureBar.toFixed(1)} bar`;
  if (id === 'motor' || id === 'contactor') return s.motor ? 'ON' : 'OFF';
  if (id === 'pump') return s.fault === 'pump' ? 'FAULT' : s.pump ? 'ON' : 'OFF';
  if (id === 'hepa') return s.hepaPa >= s.config.hepaTripPa ? 'FAULT' : `${s.hepaPa.toFixed(0)} Pa`;
  if (id === 'bin' || id === 'cyclone') return `${s.binG.toFixed(4)} g collected`;
  if (id === 'tank') return `${s.tankL.toFixed(2)} L`;
  if (id === 'estop') return s.fault === 'estop' ? 'FAULT' : 'ARMED';
  if (id === 'fan') return s.fan ? 'ON' : 'OFF';
  if (id.startsWith('damper')) return s.dampers[Number(id.slice(-1))];
  if (id.startsWith('valve')) return s.valves[Number(id.slice(-1))] ? 'OPEN' : 'CLOSED';
  if (id.startsWith('nozzle')) return s.pump && s.valves[Number(id.slice(-1))] ? 'SPRAY' : 'OFF';
  if (id.startsWith('pm')) { const channel = s.channels[Number(id.slice(-1))]; return channel.valid ? `${channel.pm10.toFixed(1)} µg/m³ PM10` : channel.status; }
  if (id.startsWith('sht')) return `${s.inputs.temperatureC}°C · ${s.inputs.humidity}%`;
  if (id === 'wind') return `${s.inputs.windSpeed} m/s`;
  if (id === 'vane') return `${s.inputs.windDirection}° toward`;
  if (id === 'flow') return `${s.flowLpm.toFixed(2)} L/min`;
  if (id === 'pressure') return `${s.pressureBar} bar`;
  if (id === 'dp') return `${s.hepaPa} Pa`;
  return ['pi', 'esp1', 'esp2', 'mux', 'drivers'].includes(id) ? 'READY' : 'MODEL';
}
