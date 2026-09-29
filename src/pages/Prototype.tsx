import { useState } from 'react';
import { Activity, Box, Cpu, Droplet, Fan, Gauge, Laptop, MapPin, Monitor, Radio, Settings, ShieldCheck, Thermometer, Wind, Zap } from 'lucide-react';
import { CTAButton, Eyebrow } from '../components/SiteChrome';
import { FeatureItem } from '../components/Cards';
import { DustMap } from '../components/Visuals';

const parts = [
  { icon: <Droplet />, title: 'Misting Nozzle (x4)', body: 'Creates fine water mist around the site perimeter.' },
  { icon: <Wind />, title: 'Weather Sensor', body: 'Measures wind speed, wind direction, temperature and humidity.' },
  { icon: <Gauge />, title: 'PM Sensor (x2)', body: 'Measures PM2.5 and PM10 at key boundary points.' },
  { icon: <Droplet />, title: 'Water Tank', body: 'Supplies clean water to the misting system.' },
  { icon: <Activity />, title: 'Water Pump', body: 'Pressurizes water for the misting nozzles.' },
  { icon: <Cpu />, title: 'Control Box', body: 'Houses the ESP32 DevKit V1, relay module and prototype control logic.' },
  { icon: <Box />, title: 'Table-Top Construction Site', body: 'Represents construction activity and controlled dust-generation scenarios.' },
];
const steps = [
  { icon: <Wind />, title: 'Sense', body: 'PM and weather sensors monitor environmental conditions around the model.' },
  { icon: <Activity />, title: 'Predict', body: 'DustTwin estimates short-term dust movement and boundary risk from current inputs.' },
  { icon: <Settings />, title: 'Decide', body: 'The controller identifies which misting zone should activate.' },
  { icon: <Droplet />, title: 'Act', body: 'The water pump and selected misting nozzles respond automatically.' },
  { icon: <Monitor />, title: 'Visualize', body: 'The DustTwin dashboard displays sensor values, system decisions and misting status in real time.' },
];

export default function Prototype() {
  const [demoRunning, setDemoRunning] = useState(true);
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
        <div className="prototype-callout callout-laptop"><Laptop size={17} />Laptop Dashboard<br /><small>(System display)</small></div>
        <div className="hero-copy">
          <Eyebrow><span>▱</span> PROTOTYPE DEMO <span>•</span> TABLE-TOP MODEL <span>•</span> JUDGE EXPERIENCE</Eyebrow>
          <h1 className="hero-title">The prototype judges<br /><span>will experience.</span></h1>
          <p className="hero-description">A compact table-top prototype designed to demonstrate how DustTwin senses dust conditions, evaluates boundary risk and activates the required misting zone in real time.</p>
          <div className="hero-actions"><CTAButton to="#model-overview" icon={<span className="play-disc">▶</span>}>Explore Model Overview</CTAButton><CTAButton to="/circuit-simulation" variant="outline" icon={<Box size={20} />}>View Circuit Details</CTAButton></div>
          <div className="prototype-features"><FeatureItem icon={<ShieldCheck />} title="Real hardware" detail="Sensors and actuators for the prototype" /><FeatureItem icon={<Settings />} title="Interactive demonstration" detail="Live control flow for judges" /><FeatureItem icon={<Activity />} title="Deterministic control logic" detail="Rule-based prototype controls" /><FeatureItem icon={<Zap />} title="Hands-on experience" detail="Designed for judge exploration" /></div>
        </div>
      </section>

      <section className="prototype-workbench" id="model-overview">
        <article className="prototype-panel top-model-panel">
          <h2 className="prototype-panel-title"><span>1</span>Table-Top Prototype Layout</h2>
          <div className="top-model-image">
            <div className="top-model-callout model-mist">Misting Nozzle<b>(4 around perimeter)</b></div><div className="top-model-callout model-weather">Weather Sensor<b>(on mast)</b></div><div className="top-model-callout model-pm">PM Sensor<b>(at boundary)</b></div><div className="top-model-callout model-tank">Water Tank</div><div className="top-model-callout model-pump">Water Pump</div><div className="top-model-callout model-box">Control Box</div><div className="top-model-callout model-site">Construction Site<br /><b>with miniature equipment</b></div>
          </div>
        </article>
        <article className="prototype-panel components-panel">
          <h2 className="prototype-panel-title"><span>2</span>Key Components Inside the Prototype</h2>
          <div className="component-cards">{parts.map((part) => <div className="prototype-component" key={part.title}><span className="component-mini-icon">{part.icon}</span><div><h3>{part.title}</h3><p>{part.body}</p></div></div>)}</div>
        </article>
        <article className="prototype-panel flow-panel">
          <h2 className="prototype-panel-title"><span>3</span>How the Prototype Works</h2><p>Current prototype control uses deterministic logic; the architecture is prepared for later ML model integration.</p>
          <div className="prototype-flow">{steps.map((step, i) => <div className="prototype-flow-item" key={step.title}><span className="prototype-flow-number">{i + 1}</span><span className="prototype-flow-icon">{step.icon}</span><div><h3>{step.title}</h3><p>{step.body}</p></div></div>)}</div>
          <button type="button" className="prototype-live-toggle" aria-pressed={demoRunning} aria-label={`Toggle prototype demo status; currently ${demoRunning ? 'ready' : 'paused'}`} onClick={() => setDemoRunning((v) => !v)}><span className={`prototype-live-dot ${demoRunning ? 'live' : ''}`} aria-hidden="true" />{demoRunning ? 'Prototype Demo Ready' : 'Prototype Demo Paused'}</button>
        </article>
      </section>
    </>
  );
}
