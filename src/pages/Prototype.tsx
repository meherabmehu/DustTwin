import { useEffect, useState } from 'react';
import { Activity, Box, Cpu, Droplet, Fan, Gauge, Laptop, MapPin, Monitor, Radio, Settings, ShieldCheck, Thermometer, Wind, Zap } from 'lucide-react';
import { CTAButton, Eyebrow } from '../components/SiteChrome';
import { FeatureItem } from '../components/Cards';
import { DustMap } from '../components/Visuals';

const parts = [
  { icon: <Droplet />, title: 'Misting Nozzle (x4)', body: 'Creates fine water mist to suppress dust around the site perimeter.' },
  { icon: <Wind />, title: 'Weather Sensor', body: 'Measures wind speed, wind direction, temperature and humidity.' },
  { icon: <Gauge />, title: 'PM Sensor (x2)', body: 'Measures PM2.5/PM10 at the site boundary for air quality monitoring.' },
  { icon: <Droplet />, title: 'Water Tank', body: 'Stores clean water for the misting system (5–10 liters).' },
  { icon: <Activity />, title: 'Water Pump', body: 'DC water pump supplies pressurized water to misting nozzles.' },
  { icon: <Cpu />, title: 'Control Box', body: 'ESP32 or Raspberry Pi with relay module runs DustTwin logic.' },
  { icon: <Box />, title: 'Table-Top Construction Site', body: 'Sand, toy excavator and dump truck simulate site activity and dust generation.' },
];
const steps = [
  { icon: <Wind />, title: 'Sense', body: 'PM sensors and weather sensor continuously measure air quality and site conditions.' },
  { icon: <Activity />, title: 'Predict', body: 'The local demo engine predicts near-term dust movement and risk from sensor readings.' },
  { icon: <Settings />, title: 'Decide', body: 'If dust risk exceeds the threshold, the system decides to activate misting in the necessary zones.' },
  { icon: <Droplet />, title: 'Act', body: 'Water pump turns on and misting nozzles spray fine mist to suppress dust.' },
  { icon: <Monitor />, title: 'Visualize', body: 'The laptop dashboard shows real-time sensor data, predictions, system status and live response.' },
];

export default function Prototype() {
  const [demoRunning, setDemoRunning] = useState(true);
  const [pulse, setPulse] = useState(0);
  useEffect(() => { if (!demoRunning) return; const t = window.setInterval(() => setPulse((v) => v + 1), 1800); return () => window.clearInterval(t); }, [demoRunning]);
  return (
    <>
      <section className="hero prototype-hero">
        <div className="hero-map-layer"><DustMap intensity={58} readings={[24, 18, 40]} activeZone="Zone 2" showLegend={false} showWind={false} /></div>
        <div className="prototype-callout callout-nozzle"><Droplet size={17} />Misting Nozzle<br /><small>(4 around perimeter)</small></div>
        <div className="prototype-callout callout-weather"><Wind size={18} />Weather Sensor</div>
        <div className="prototype-callout callout-pm"><Gauge size={17} />PM Sensor<br /><small>(at site boundary)</small></div>
        <div className="prototype-callout callout-tank"><Droplet size={17} />Water Tank</div>
        <div className="prototype-callout callout-pump"><Activity size={17} />Water Pump</div>
        <div className="prototype-callout callout-box"><Cpu size={17} />Control Box<br /><small>(ESP32 / Relay)</small></div>
        <div className="prototype-callout callout-laptop"><Laptop size={17} />Laptop Dashboard<br /><small>(Real-time monitoring)</small></div>
        <div className="hero-copy">
          <Eyebrow><span>▱</span> PROTOTYPE DEMO <span>›</span> TABLE-TOP MODEL <span>›</span> JUDGE EXPERIENCE</Eyebrow>
          <h1 className="hero-title">The prototype judges<br /><span>will experience.</span></h1>
          <p className="hero-description">A working table-top model that demonstrates how DustTwin senses dust, predicts risk, and automatically activates misting in real time. Experience the complete closed-loop system in a compact, hands-on demonstration.</p>
          <div className="hero-actions"><CTAButton to="#model-overview" icon={<span className="play-disc">▶</span>}>Watch Prototype Video</CTAButton><CTAButton to="/circuit-simulation" variant="outline" icon={<Box size={20} />}>View Circuit Details</CTAButton></div>
          <div className="prototype-features"><FeatureItem icon={<ShieldCheck />} title="Real hardware" detail="Working sensors and actuators" /><FeatureItem icon={<Settings />} title="Live demonstration" detail="See real-time dust control" /><FeatureItem icon={<Activity />} title="Same algorithm" detail="As full-scale DustTwin" /><FeatureItem icon={<Zap />} title="Hands-on experience" detail="Built for judges to explore" /></div>
        </div>
      </section>

      <section className="prototype-workbench" id="model-overview">
        <article className="prototype-panel top-model-panel">
          <h2 className="prototype-panel-title"><span>1</span>Top View of Table-Top Model</h2>
          <div className="top-model-image">
            <div className="top-model-callout model-mist">Misting Nozzle<b>(4 around perimeter)</b></div><div className="top-model-callout model-weather">Weather Sensor<b>(on mast)</b></div><div className="top-model-callout model-pm">PM Sensor<b>(at boundary)</b></div><div className="top-model-callout model-tank">Water Tank</div><div className="top-model-callout model-pump">Water Pump</div><div className="top-model-callout model-box">Control Box</div><div className="top-model-callout model-site">Construction Site<br /><b>with miniature equipment</b></div>
          </div>
        </article>
        <article className="prototype-panel components-panel">
          <h2 className="prototype-panel-title"><span>2</span>Key Components Inside the Prototype</h2>
          <div className="component-cards">{parts.map((part) => <div className="prototype-component" key={part.title}><span className="component-mini-icon">{part.icon}</span><div><h3>{part.title}</h3><p>{part.body}</p></div></div>)}</div>
        </article>
        <article className="prototype-panel flow-panel">
          <h2 className="prototype-panel-title"><span>3</span>How the Prototype Works</h2><p>A simple 5-step closed-loop flow, demonstrated in real time.</p>
          <div className="prototype-flow">{steps.map((step, i) => <div className="prototype-flow-item" key={step.title}><span className="prototype-flow-number">{i + 1}</span><span className="prototype-flow-icon">{step.icon}</span><div><h3>{step.title}</h3><p>{step.body}</p></div></div>)}</div>
          <button className="prototype-live-toggle" onClick={() => setDemoRunning((v) => !v)}><span className={`prototype-live-dot ${demoRunning ? 'live' : ''}`} />Prototype demo {demoRunning ? 'running' : 'paused'} · sample cycle {pulse % 5 + 1}</button>
        </article>
      </section>
    </>
  );
}
