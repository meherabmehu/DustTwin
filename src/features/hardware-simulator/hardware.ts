import { BOUNDARIES, ZONES, type HardwareState } from './engine';

export const GROUPS = ['Sensors', 'Raspberry Pi and ESP32', 'Dry Extraction', 'Water Misting', 'Power Distribution'] as const;
export type Group = typeof GROUPS[number];
export interface Part { id: string; name: string; group: Group; kind: 'board' | 'sensor' | 'motor' | 'valve' | 'passive' | 'power'; pins: string[]; note: string; verified: boolean }
export interface Wire { id: string; from: string; fromPin: string; to: string; toPin: string; type: 'data' | 'control' | 'power' | 'ground' | 'air' | 'water'; voltage: string; purpose: string }
const parts: Part[] = [];
function part(id: string, name: string, group: Group, kind: Part['kind'], pins: string[], note: string, verified = false) { parts.push({ id, name, group, kind, pins, note, verified }); }
const sensorNote = 'SPS30 connector: 1 VDD (5V), 2 SDA, 3 SCL, 4 SEL grounded before power-on, 5 GND. I²C 0x69. One multiplexer channel enabled at a time; 3.3V bus pull-ups. Short local bus only; remote boundaries need an engineered differential link.';
['North', 'East', 'South', 'West', 'Dust source', 'Background'].forEach((name, i) => part(`pm${i}`, `SPS30 · ${name}`, 'Sensors', 'sensor', ['1 VDD', '2 SDA', '3 SCL', '4 SEL', '5 GND'], sensorNote, true));
part('sht0', 'SHT35 · ambient', 'Sensors', 'sensor', ['VDD', 'SDA', 'SCL', 'ADDR', 'GND'], 'SHT35-DIS I²C at 3.3V; dedicated mux channel 6. Carrier connector order depends on selected board.');
part('sht1', 'SHT35 · outlet', 'Sensors', 'sensor', ['VDD', 'SDA', 'SCL', 'ADDR', 'GND'], 'SHT35-DIS I²C at 3.3V; dedicated mux channel 7. Carrier connector order depends on selected board.');
part('wind', 'Anemometer', 'Sensors', 'sensor', ['conditioned OUT', 'SUPPLY', 'RETURN'], 'Model TBD: pulse/analog/RS485 variant must be selected. Proposed conditioned pulse input; no raw sensor voltage may reach GPIO.');
part('vane', 'Wind vane', 'Sensors', 'sensor', ['conditioned OUT', 'SUPPLY', 'RETURN'], 'Model TBD: proposed conditioned 0–3.3V analog interface. Wind convention is direction of travel, not meteorological wind-from.');
part('flow', 'Water flow sensor', 'Sensors', 'sensor', ['conditioned OUT', 'SUPPLY', 'RETURN'], 'Model TBD: pulse output requires compatible buffer, pull-up and calibration.');
part('pressure', 'Water pressure sensor', 'Sensors', 'sensor', ['conditioned OUT', 'SUPPLY', 'RETURN'], 'Model TBD: use a calibrated analog conditioner; never directly connect 0–5V or 4–20mA to the ESP32 ADC.');
part('dp', 'HEPA differential pressure', 'Sensors', 'sensor', ['conditioned OUT', 'SUPPLY', 'RETURN'], 'Model TBD: calibrated differential-pressure transducer via analog conditioner.');
part('pi', 'Raspberry Pi 5 · 8GB', 'Raspberry Pi and ESP32', 'board', ['USB-A sensor', 'USB-A actuator', 'USB-C power'], 'Host control and existing PM10 backend. Dedicated USB-C 5.1V / 5A supply; do not backfeed GPIO power. Two USB/UART bridges connect the ESP32 boards.', true);
part('esp1', 'ESP32 #1 · Sensors', 'Raspberry Pi and ESP32', 'board', ['USB', '3V3', 'GND', 'GPIO21', 'GPIO22', 'GPIO27', 'GPIO34', 'GPIO32', 'GPIO35', 'GPIO36'], 'Proposed ESP32-WROOM-32 DevKit, not S3/C3 or WROVER. GPIO34–39 are input only. USB bridge handles UART0; GPIO21/22 at 100kHz service mux. Confirm exact carrier before assembly.', true);
part('esp2', 'ESP32 #2 · Actuators', 'Raspberry Pi and ESP32', 'board', ['USB', '3V3', 'GND', 'GPIO13', 'GPIO14', 'GPIO18', 'GPIO19', 'GPIO21', 'GPIO22', 'GPIO23', 'GPIO25', 'GPIO26', 'GPIO27', 'GPIO32'], 'Proposed ESP32-WROOM-32 DevKit. Outputs only feed compatible driver inputs, never loads. No boot strapping or flash GPIO assigned.', true);
part('mux', 'TCA9548A · I²C switch', 'Raspberry Pi and ESP32', 'board', ['VCC', 'GND', 'RESET', 'A0', 'A1', 'A2', 'SDA', 'SCL', ...Array.from({ length: 8 }, (_, i) => [`SD${i}`, `SC${i}`]).flat()], '0x70 with A0–A2 grounded. RESET pulled high. VCC and all bus pull-ups 3.3V. Select exactly one channel to resolve six identical 0x69 SPS30 addresses.', true);
part('conditioner', 'Sensor signal conditioning', 'Raspberry Pi and ESP32', 'board', ['3V3', 'GND', ...['wind', 'vane', 'flow', 'pressure', 'dp'].flatMap(v => [`${v} IN`, `${v} OUT`]), 'FIELD SUPPLY', 'FIELD RETURN'], 'Abstract protected interface: field power, ADC scaling, Schmitt pulse buffers, surge protection. Exact field devices and conditioner circuit TBD. No RS485 transceiver is assumed.');
part('drivers', 'Relay / driver bank', 'Raspberry Pi and ESP32', 'board', ['3V3', 'GND', 'LOAD+', 'LOAD−', ...Array.from({ length: 11 }, (_, i) => [`IN${i + 1}`, `OUT${i + 1}`]).flat()], 'Logical 3.3V compatible, fail-off driver bank; flyback protection required on DC inductive loads. Galvanically isolated mains contactor interface. Damper outputs assume spring-return powered-open actuators; reversible motors require a different driver.');
ZONES.forEach((z, i) => {
  part(`damper${i}`, `Damper ${z} · ${BOUNDARIES[i]}`, 'Dry Extraction', 'valve', ['DRIVE+', 'RETURN', 'AIR IN', 'AIR OUT'], 'Proposed low-voltage spring-return damper; 3-second modeled travel. No physical feedback sensor specified; position is estimated. Fault scenario models jam closed.');
  part(`inlet${i}`, `Suction inlet ${z}`, 'Dry Extraction', 'passive', ['AIR OUT'], 'Functional air path; pressure losses and duct dimensions are uncalibrated.');
});
part('duct', 'Four-branch duct network', 'Dry Extraction', 'passive', ['A', 'B', 'C', 'D', 'OUT'], 'Airflow shared by open branch fraction. No CFD or measured fan curve.');
part('cyclone', 'Cyclone separator', 'Dry Extraction', 'passive', ['AIR IN', 'AIR OUT', 'DUST OUT'], 'Functional separation path; no separation efficiency claim.');
part('bin', 'Dust collection container', 'Dry Extraction', 'passive', ['DUST IN'], 'Collection endpoint; capacity is not modeled.');
part('hepa', 'HEPA filter', 'Dry Extraction', 'passive', ['AIR IN', 'AIR OUT'], 'Differential pressure interlock stops suction on clog. Filter loading is scenario driven.');
part('motor', 'Central suction motor', 'Dry Extraction', 'motor', ['PROTECTED POWER', 'AIR IN', 'EXHAUST'], 'Motor power only through protected contactor enclosure; motor rating and manufacturer terminals TBD. Suction waits for an open damper.');
part('contactor', 'Protected motor contactor', 'Dry Extraction', 'power', ['ISOLATED ENABLE', 'PROTECTED INPUT', 'MOTOR OUTPUT'], 'Sealed 220–240V rated subsystem: fuse, overload, protective earth and qualified installation. No mains conductor routing or direct GPIO connection shown.');
part('tank', 'Water tank', 'Water Misting', 'passive', ['OUT'], 'Reservoir assumed filled. Low-level switch not specified; dry-run validation required on real hardware.');
part('pump', 'Water pump', 'Water Misting', 'motor', ['DRIVE+', 'RETURN', 'IN', 'OUT'], 'Proposed protected low-voltage DC pump. Model assumes 3 bar operating pressure; select real pump/valve ratings before assembly.');
part('pipes', 'Pipes & fittings', 'Water Misting', 'passive', ['IN', 'A', 'B', 'C', 'D'], 'Functional manifold; no hydraulic transient simulation.');
ZONES.forEach((z, i) => {
  part(`valve${i}`, `Solenoid valve ${z}`, 'Water Misting', 'valve', ['DRIVE+', 'RETURN', 'IN', 'OUT'], 'Normally closed DC solenoid; voltage and connector TBD. Dedicated fused driver with flyback suppression required.');
  part(`nozzle${i}`, `Misting nozzles · ${z}`, 'Water Misting', 'passive', ['IN'], 'One zone nozzle assembly; spray shown only with running pump and open valve. Flow uses existing project risk-based water model.');
});
part('mains', 'Protected mains interface', 'Power Distribution', 'power', ['ENCLOSED OUTPUT', 'PI SUPPLY'], '220–240V subsystem boundary only. All mains internals, PE, RCD and installation require an appropriate enclosure and qualified design.');
part('psu', 'Regulated DC supplies', 'Power Distribution', 'power', ['PROTECTED INPUT', 'DC+', 'DC−'], 'Load supply voltage TBD from selected pump, damper, valve and contactor ratings. Never infer load voltage from this functional diagram.');
part('fuse', 'Fuses & DC distribution', 'Power Distribution', 'power', ['IN+', 'IN−', 'FUSED+', 'RETURN'], 'Individually fuse load branches; ratings and wire gauges require real load currents and inrush. Common low-voltage return only; no mains-to-logic ground tie.');
part('buck', '5V buck converter', 'Power Distribution', 'power', ['IN+', 'IN−', '5V', 'GND'], 'Dedicated regulated 5V SPS30 rail; size for all six sensors including startup. ESP32 boards use USB power.');
part('piSupply', 'Pi USB-C supply', 'Power Distribution', 'power', ['PROTECTED INPUT', 'USB-C'], 'Dedicated compatible Pi 5 supply, 5.1V / 5A USB-C; separate from SPS30 rail.', true);
part('estop', 'Emergency stop · NC', 'Power Distribution', 'power', ['IN+', 'SWITCHED+'], 'Latching, normally closed hardware safety chain removes actuator drive power. Browser stop is only a functional model; real safety circuit independent of software.');
part('fan', '12V wind simulation fan', 'Power Distribution', 'motor', ['12V+', 'GND', 'ENABLE'], 'Separate fused 12V supply and driver. Visual test fan does not falsify wind readings; set virtual wind speed independently.');
part('fanSupply', '12V fan supply', 'Power Distribution', 'power', ['PROTECTED INPUT', '12V+', 'GND'], 'Regulated, fused 12V DC fan supply.');
export const PARTS = parts;
const wires: Wire[] = [];
function wire(from: string, fromPin: string, to: string, toPin: string, type: Wire['type'], voltage: string, purpose: string) { wires.push({ id: `w${wires.length}`, from, fromPin, to, toPin, type, voltage, purpose }); }
wire('piSupply', 'USB-C', 'pi', 'USB-C power', 'power', '5.1V / 5A', 'Dedicated Pi supply');
['esp1', 'esp2'].forEach((id, i) => wire('pi', i ? 'USB-A actuator' : 'USB-A sensor', id, 'USB', 'data', 'USB 5V + differential data', 'USB/UART bridge: bidirectional serial protocol; integrated USB ground. No 5V GPIO UART.'));
wire('esp1', 'GPIO21', 'mux', 'SDA', 'data', '3.3V', 'I²C SDA, 100kHz');
wire('esp1', 'GPIO22', 'mux', 'SCL', 'data', '3.3V', 'I²C SCL, 100kHz');
['VCC', 'RESET'].forEach(pin => wire('esp1', '3V3', 'mux', pin, 'power', '3.3V', pin === 'RESET' ? 'Pull up RESET via resistor' : 'Mux supply'));
['GND', 'A0', 'A1', 'A2'].forEach(pin => wire('esp1', 'GND', 'mux', pin, 'ground', '0V', 'Address 0x70 and logic return'));
Array.from({ length: 8 }, (_, i) => i).forEach(i => {
  const id = i < 6 ? `pm${i}` : `sht${i - 6}`;
  wire('mux', `SD${i}`, id, i < 6 ? '2 SDA' : 'SDA', 'data', '3.3V', `Exclusive channel ${i}; upstream 3.3V pull-ups`);
  wire('mux', `SC${i}`, id, i < 6 ? '3 SCL' : 'SCL', 'data', '3.3V', `Exclusive channel ${i} clock`);
  wire(i < 6 ? 'buck' : 'esp1', i < 6 ? '5V' : '3V3', id, i < 6 ? '1 VDD' : 'VDD', 'power', i < 6 ? '5V' : '3.3V', 'Sensor supply');
  wire('esp1', 'GND', id, i < 6 ? '5 GND' : 'GND', 'ground', '0V', 'Low-voltage common return');
  wire('esp1', 'GND', id, i < 6 ? '4 SEL' : 'ADDR', 'ground', '0V', i < 6 ? 'Select I²C before startup' : 'Address select 0x44; separate mux channel');
});
['wind', 'vane', 'flow', 'pressure', 'dp'].forEach((id, i) => {
  wire(id, 'conditioned OUT', 'conditioner', `${id} IN`, 'data', 'Field interface TBD', 'Verify exact sensor and conditioner before assembly');
  wire('conditioner', `${id} OUT`, 'esp1', ['GPIO27', 'GPIO34', 'GPIO32', 'GPIO35', 'GPIO36'][i], 'data', '0–3.3V', 'Protected pulse/ADC input');
  wire('conditioner', 'FIELD SUPPLY', id, 'SUPPLY', 'power', 'Model TBD', 'Device-specific regulated field supply, not GPIO');
  wire('conditioner', 'FIELD RETURN', id, 'RETURN', 'ground', 'Field return', 'Isolated or common return per chosen conditioner');
});
['conditioner', 'drivers'].forEach(id => { wire('esp1', '3V3', id, '3V3', 'power', '3.3V', 'Logic interface reference'); wire('esp1', 'GND', id, 'GND', 'ground', '0V', 'Logic return; isolation barrier inside driver'); });
wire('esp2', 'GND', 'drivers', 'GND', 'ground', '0V', 'Actuator controller logic return');
export const ACTUATOR_GPIO = [13, 14, 18, 19, 21, 22, 23, 25, 26, 27, 32];
const loads = [...ZONES.map((_, i) => `damper${i}`), ...ZONES.map((_, i) => `valve${i}`), 'pump', 'contactor', 'fan'];
loads.forEach((id, i) => {
  wire('esp2', `GPIO${ACTUATOR_GPIO[i]}`, 'drivers', `IN${i + 1}`, 'control', '3.3V', `Channel ${i + 1}: ${id}; external fail-off pull-down`);
  wire('drivers', `OUT${i + 1}`, id, id === 'contactor' ? 'ISOLATED ENABLE' : id === 'fan' ? 'ENABLE' : 'DRIVE+', 'control', id === 'contactor' ? 'Isolated rated interface' : id === 'fan' ? '12V driver' : 'Load rating TBD', 'Buffered protected output; never drive a load from GPIO');
  if (!['contactor', 'fan'].includes(id)) wire('fuse', 'RETURN', id, 'RETURN', 'ground', 'Load return', 'Low-voltage load circuit return');
});
wire('mains', 'ENCLOSED OUTPUT', 'psu', 'PROTECTED INPUT', 'power', 'Protected subsystem', 'Enclosed power conversion; mains internals intentionally omitted');
wire('mains', 'PI SUPPLY', 'piSupply', 'PROTECTED INPUT', 'power', 'Protected subsystem', 'Dedicated certified Pi adapter');
wire('mains', 'ENCLOSED OUTPUT', 'contactor', 'PROTECTED INPUT', 'power', 'Protected 220–240V interface', 'No exposed mains wiring; overload and safety chain inside enclosure');
wire('contactor', 'MOTOR OUTPUT', 'motor', 'PROTECTED POWER', 'power', 'Motor rating TBD', 'Protected motor power interface');
wire('mains', 'ENCLOSED OUTPUT', 'fanSupply', 'PROTECTED INPUT', 'power', 'Protected subsystem', 'Certified fan supply');
wire('fanSupply', '12V+', 'fan', '12V+', 'power', '12V', 'Fused fan branch'); wire('fanSupply', 'GND', 'fan', 'GND', 'ground', '0V', 'Fan supply return');
wire('psu', 'DC+', 'fuse', 'IN+', 'power', 'Load rating TBD', 'Protected distribution'); wire('psu', 'DC−', 'fuse', 'IN−', 'ground', '0V', 'Load return');
wire('fuse', 'FUSED+', 'buck', 'IN+', 'power', 'Converter input TBD', 'Fused buck input'); wire('fuse', 'RETURN', 'buck', 'IN−', 'ground', '0V', 'Buck return');
wire('buck', 'GND', 'esp1', 'GND', 'ground', '0V', 'Common low-voltage reference');
wire('fuse', 'FUSED+', 'estop', 'IN+', 'power', 'Load rating TBD', 'NC emergency power chain'); wire('estop', 'SWITCHED+', 'drivers', 'LOAD+', 'power', 'Load rating TBD', 'Remove actuator energy on emergency stop'); wire('fuse', 'RETURN', 'drivers', 'LOAD−', 'ground', 'Load return', 'Protected load bank return');
ZONES.forEach((z, i) => {
  wire(`inlet${i}`, 'AIR OUT', `damper${i}`, 'AIR IN', 'air', 'N/A', `Zone ${z} suction inlet`);
  wire(`damper${i}`, 'AIR OUT', 'duct', z, 'air', 'N/A', `Zone ${z} air branch`);
  wire('pipes', z, `valve${i}`, 'IN', 'water', 'Nominal 3 bar model', `Zone ${z} water branch`);
  wire(`valve${i}`, 'OUT', `nozzle${i}`, 'IN', 'water', 'Nominal 3 bar model', 'Spray only with pump and valve active');
});
wire('duct', 'OUT', 'cyclone', 'AIR IN', 'air', 'N/A', 'Dust extraction manifold'); wire('cyclone', 'DUST OUT', 'bin', 'DUST IN', 'air', 'N/A', 'Separated collection path'); wire('cyclone', 'AIR OUT', 'hepa', 'AIR IN', 'air', 'N/A', 'Filtered extraction'); wire('hepa', 'AIR OUT', 'motor', 'AIR IN', 'air', 'N/A', 'Suction outlet');
wire('tank', 'OUT', 'pump', 'IN', 'water', 'N/A', 'Water supply'); wire('pump', 'OUT', 'pipes', 'IN', 'water', 'Nominal 3 bar model', 'Pressurized water manifold');
export const WIRES = wires;
export const WIRE_COLORS: Record<Wire['type'], string> = { power: '#fb917a', ground: '#8392a5', data: '#40d7ef', control: '#c4a1ff', air: '#5eebba', water: '#4da7ff' };
export function validateWiring(connections: Wire[] = WIRES): string[] {
  const errors: string[] = [];
  for (const w of connections) {
    const a = PARTS.find(p => p.id === w.from), b = PARTS.find(p => p.id === w.to);
    if (!a?.pins.includes(w.fromPin) || !b?.pins.includes(w.toPin)) errors.push(`${w.id}: unknown component or pin`);
    if (w.to.startsWith('esp') && w.toPin.startsWith('GPIO') && w.voltage !== '3.3V' && w.voltage !== '0–3.3V') errors.push(`${w.id}: unsafe GPIO voltage`);
    if (w.type === 'control' && w.from.startsWith('esp') && w.to !== 'drivers') errors.push(`${w.id}: actuator requires external driver`);
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
  if (id === 'hepa') return s.fault === 'hepa' ? 'FAULT' : `${s.hepaPa} Pa`;
  if (id === 'estop') return s.fault === 'estop' ? 'FAULT' : 'ARMED';
  if (id === 'fan') return s.windFan && s.fault !== 'estop' ? 'ON' : 'OFF';
  if (id.startsWith('damper')) return s.dampers[Number(id.slice(-1))];
  if (id.startsWith('valve')) return s.valves[Number(id.slice(-1))] ? 'OPEN' : 'CLOSED';
  if (id.startsWith('nozzle')) return s.pump && s.valves[Number(id.slice(-1))] ? 'SPRAY' : 'OFF';
  if (id.startsWith('pm')) return s.fault === 'sensor' && id === 'pm0' ? 'DISCONNECTED' : `${s.inputs.pm10} µg/m³`;
  if (id.startsWith('sht')) return `${s.inputs.temperatureC}°C · ${s.inputs.humidity}%`;
  if (id === 'wind') return `${s.inputs.windSpeed} m/s`;
  if (id === 'vane') return `${s.inputs.windDirection}° toward`;
  if (id === 'flow') return `${s.flowLpm.toFixed(2)} L/min`;
  if (id === 'pressure') return `${s.pressureBar} bar`;
  if (id === 'dp') return `${s.hepaPa} Pa`;
  return ['pi', 'esp1', 'esp2', 'mux', 'drivers'].includes(id) ? 'READY' : 'MODEL';
}
