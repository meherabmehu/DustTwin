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
  }
  if (connections === WIRES) {
    const sensorPins = Object.values(manifest.controllers.sensor);
    const actuatorPins = [...manifest.controllers.actuator.outputs, ...manifest.controllers.actuator.openFeedback, manifest.controllers.actuator.estop];
    if (new Set(sensorPins).size !== sensorPins.length || new Set(actuatorPins).size !== actuatorPins.length) errors.push('Controller GPIO conflict');
    if (manifest.controllers.actuator.outputs.some(pin => pin >= 34 || [0, 2, 5, 12, 15].includes(pin))) errors.push('Invalid output GPIO assignment');
    for (const wire of connections) if (wire.from === 'drivers' && wire.to === 'pump' && wire.voltage !== '12V') errors.push('Pump power domain mismatch');
  }
  return errors;
}
export const WIRING_NOTES = [
  'Reference topology: ESP32-WROOM-32 DevKit. Exact field sensors, actuator ratings, carrier connectors, fuses and drivers remain to be selected.',
  'Six SPS30 devices share fixed address 0x69: TCA9548A channels 0–5; SHT35 channels 6–7. Only one channel may be active. Keep I²C local; long boundary cables require a separately designed differential/RS485 interface.',
  'USB/UART links include USB power and ground. No raw 5V UART signal connects to GPIO. All I²C pull-ups are 3.3V; field inputs pass through conditioning.',
  'Mains is represented only by protected enclosure interfaces. Driver isolation, contactor safety chain, earthing, overloads and electrical installation require a qualified hardware design.',
];
export function partStatus(id: string, s: HardwareState): string {
  if (s.fault === 'power') return 'OFF';
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
