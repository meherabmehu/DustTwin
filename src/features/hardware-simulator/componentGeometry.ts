import { manifest, type Part, type Wire } from './hardware';
export interface PinAnchor { x: number; y: number; side: 'left' | 'right' | 'bottom' | 'top'; label: string; reserved?: boolean }
// Espressif DevKitC V4 carrier header order, not a generic C3/S3 pinout.
const LEFT = manifest.carrierHeaders.left;
const RIGHT = manifest.carrierHeaders.right;
export function geometry(part: Part) {
  const pins = new Map<string, PinAnchor>();
  let width = 260, height = Math.max(220, Math.ceil(part.pins.length / 2) * 24 + 80);
  if(part.group==='Sensors'&&!/^pm\d$/.test(part.id))width=235;
  if (part.id === 'pi') {
    width = 430; height = 250;
    pins.set('USB-A sensor', { x: width, y: 70, side: 'right', label: 'USB → ESP32 #1' });
    pins.set('USB-A actuator', { x: width, y: 130, side: 'right', label: 'USB → ESP32 #2' });
    pins.set('USB-C power', { x: 70, y: height, side: 'bottom', label: 'USB-C 5.1V' });
  } else if (part.id.startsWith('esp')) {
    width = 300; height = 530;
    LEFT.forEach((name, i) => pins.set(name, { x: 0, y: 55 + i * 23, side: 'left', label: name.startsWith('GND')?'GND':name, reserved: ['D2','D3','CMD'].includes(name) }));
    RIGHT.forEach((name, i) => pins.set(name, { x: width, y: 55 + i * 23, side: 'right', label: name.startsWith('GND')?'GND':name, reserved: ['D1','D0','CLK'].includes(name) }));
    pins.set('USB', { x: width / 2, y: height, side: 'bottom', label: 'Micro USB' });
  } else if (/^pm\d$/.test(part.id)) {
    width = 240; height = 250;
    part.pins.forEach((name, i) => pins.set(name, { x: 32 + i * 44, y: height, side: 'bottom', label: name }));
  } else if (part.id === 'mux' || part.id === 'drivers') {
    width = part.id === 'drivers' ? 620 : 540;
    height = part.id === 'drivers' ? 310 : 210;
    part.pins.forEach((name, i) => { const top = i % 2 === 0, index = Math.floor(i / 2), count = Math.ceil(part.pins.length / 2); pins.set(name, { x: 25 + index * (width - 50) / Math.max(1, count - 1), y: top ? 0 : height, side: top ? 'top' : 'bottom', label: name }); });
  } else {
    part.pins.forEach((name, i) => { const left = i < Math.ceil(part.pins.length / 2), row = left ? i : i - Math.ceil(part.pins.length / 2); pins.set(name, { x: left ? 0 : width, y: 52 + row * 26, side: left ? 'left' : 'right', label: name }); });
  }
  return { width, height, pins };
}
export function wireColor(w: Wire) {
  if (w.type === 'ground') return '#a3b2c3';
  if(w.from==='drivers'&&w.type==='control')return '#ff972d';
  if (w.type === 'power') return w.from === 'drivers' || /damper|pump|valve|motor/.test(w.to) ? '#ff972d' : '#ff434d';
  if (w.type === 'control') return '#be54fa';
  if (w.type === 'air') return '#38dfbf';
  if (w.type === 'water') return '#24aafa';
  return w.interface === 'I2C' || /SDA|SCL|SD\d|SC\d/.test(w.fromPin + w.toPin) ? '#43f063' : '#398dff';
}
