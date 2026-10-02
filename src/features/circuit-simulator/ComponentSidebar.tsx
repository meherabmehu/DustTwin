import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { BatteryCharging, Compass, Cpu, Droplet, Fan, Gauge, Power, Search, Settings, Thermometer, Wind, Zap } from 'lucide-react';
import { SIMULATION_PIN_MAP } from '../../config/simulationThresholds';

type ComponentGroup = 'Controllers' | 'Sensors' | 'Actuators' | 'Power Modules';
type InventoryComponent = { group: ComponentGroup; name: string; info: string; icon: ReactNode };

const p = SIMULATION_PIN_MAP;
const COMPONENTS: InventoryComponent[] = [
  { group: 'Sensors', name: 'PM2.5 / PM10 Sensors ×2', info: `PMS5003 · UART RX${p.pmSensor1.rx}/TX${p.pmSensor1.tx} + RX${p.pmSensor2.rx}/TX${p.pmSensor2.tx}`, icon: <Gauge /> },
  { group: 'Sensors', name: 'DHT22', info: `Temperature & Humidity · GPIO ${p.dht22}`, icon: <Thermometer /> },
  { group: 'Sensors', name: 'Anemometer', info: `Wind Speed Sensor · GPIO ${p.anemometer}`, icon: <Wind /> },
  { group: 'Sensors', name: 'Wind Vane', info: `Wind Direction Sensor · GPIO ${p.windVane}`, icon: <Compass /> },
  { group: 'Actuators', name: '4 Channel Relay Module', info: `12V · GPIO ${Object.values(p.relayZones).join(', ')}`, icon: <Settings /> },
  { group: 'Actuators', name: '12V DC Water Pump', info: `Driver · GPIO ${p.pump}`, icon: <Droplet /> },
  { group: 'Actuators', name: '12V Solenoid Valves × 4', info: 'Normally Closed · Zone outputs', icon: <Power /> },
  { group: 'Actuators', name: '12V DC Fan', info: `Site wind simulation · GPIO ${p.fan}`, icon: <Fan /> },
  { group: 'Power Modules', name: '12V to 5V Buck Converter', info: 'DC-DC step down · regulated 5V rail', icon: <BatteryCharging /> },
  { group: 'Power Modules', name: '12V Power Supply', info: 'DC adapter · 5A distribution', icon: <Zap /> },
  { group: 'Controllers', name: 'ESP32 DevKit V1', info: 'WiFi + Bluetooth · 38 GPIO', icon: <Cpu /> },
];

const GROUP_ORDER: ComponentGroup[] = ['Sensors', 'Actuators', 'Power Modules', 'Controllers'];

function InventoryGroup({ title, items }: { title: ComponentGroup; items: InventoryComponent[] }) {
  return (
    <section className="component-group" aria-label={title}>
      <h3>{title}<span aria-hidden="true">⌃</span></h3>
      <div className="component-list" role="list">
        {items.map((item) => (
          <div className="component-item" key={item.name} role="listitem">
            <span className="component-thumb" aria-hidden="true">{item.icon}</span>
            <span><strong>{item.name}</strong><small>{item.info}</small></span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ComponentSidebar() {
  const [search, setSearch] = useState('');
  const grouped = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return GROUP_ORDER.map((group) => ({
      group,
      items: COMPONENTS.filter((item) => item.group === group && `${item.name} ${item.info}`.toLowerCase().includes(needle)),
    })).filter((entry) => entry.items.length > 0);
  }, [search]);
  const resultCount = grouped.reduce((total, group) => total + group.items.length, 0);

  return (
    <aside className="component-sidebar" aria-label="Circuit component inventory">
      <div className="sidebar-title">
        <span><Settings size={15} aria-hidden="true" /> Components</span>
        <span className="component-count">{resultCount} parts</span>
      </div>
      <label className="component-search">
        <Search size={14} aria-hidden="true" />
        <input type="search" value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Search components..." aria-label="Search components" />
      </label>
      {grouped.length
        ? grouped.map((entry) => <InventoryGroup key={entry.group} title={entry.group} items={entry.items} />)
        : <p className="component-empty">No components match “{search}”.</p>}
    </aside>
  );
}
