import { useEffect, useState } from 'react';
import { Activity, Box, Cpu, Droplet, Fan, Gauge, Laptop, MapPin, Monitor, Radio, Settings, ShieldCheck, Thermometer, Wind, Zap } from 'lucide-react';
import { CTAButton, Eyebrow } from '../components/SiteChrome';
import { FeatureItem } from '../components/Cards';
import { DustMap } from '../components/Visuals';

const parts = [
  { icon: <Droplet />, title: 'Misting Nozzle (x4)', body: 'Creates fine water mist to suppress dust around the site perimeter.' },
  { icon: <Wind />, title: 'Weather Sensor', body: 'Represents wind speed, direction, temperature and humidity inputs.' },
  { icon: <Gauge />, title: 'PM Sensor (x2)', body: 'Represents two boundary monitoring points; this browser preview uses sample values.' },
  { icon: <Droplet />, title: 'Water Tank', body: 'Stores clean water for the misting system (5–10 liters).' },
  { icon: <Activity />, title: 'Water Pump', body: 'DC water pump supplies pressurized water to misting nozzles.' },
  { icon: <Cpu />, title: 'Control Box', body: 'ESP32 and relay module represent the proposed local control hardware.' },
  { icon: <Box />, title: 'Table-Top Construction Site', body: 'Sand, toy excavator and dump truck simulate site activity and dust generation.' },
];
const steps = [
  { icon: <Wind />, title: 'Sense', body: 'Sample PM and weather inputs represent site conditions; no physical sensor stream is connected.' },
  { icon: <Activity />, title: 'Predict', body: 'Deterministic browser logic maps sample inputs to an illustrative dust-risk scenario.' },
  { icon: <Settings />, title: 'Decide', body: 'Fixed thresholds select zones in this demo; the model is rule-based, not ML.' },
  { icon: <Droplet />, title: 'Act', body: 'The interface displays a simulated pump and misting response; it controls no physical hardware.' },
  { icon: <Monitor />, title: 'Visualize', body: 'The dashboard shows local sample values and states, not live hardware telemetry.' },
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
        <div className="prototype-callout callout-laptop"><Laptop size={17} />Laptop Dashboard<br /><small>(Sample preview)</small></div>
        <div className="hero-copy">
          <Eyebrow><span>▱</span> PROTOTYPE CONCEPT <span>›</span> BROWSER DEMO <span>›</span> JUDGE EXPERIENCE</Eyebrow>
          <h1 className="hero-title">The prototype judges<br /><span>will experience.</span></h1>
          <p className="hero-description">Explore a tabletop system concept for sensing dust, estimating risk and selecting a misting zone. Readings and the sample cycle here are illustrative browser content—not a live hardware feed.</p>
          <div className="hero-actions"><CTAButton to="#model-overview" icon={<span className="play-disc">▶</span>}>Explore Model Overview</CTAButton><CTAButton to="/circuit-simulation" variant="outline" icon={<Box size={20} />}>View Circuit Details</CTAButton></div>
          <div className="prototype-features"><FeatureItem icon={<ShieldCheck />} title="Hardware layout" detail="Illustrative component concept" /><FeatureItem icon={<Settings />} title="Interactive demo" detail="Local sample cycle" /><FeatureItem icon={<Activity />} title="Deterministic logic" detail="Rule-based · not ML" /><FeatureItem icon={<Zap />} title="Hands-on experience" detail="Explore the system concept" /></div>
        </div>
      </section>

      <section className="prototype-workbench" id="model-overview">
        <article className="prototype-panel top-model-panel">
          <h2 className="prototype-panel-title"><span>1</span>Illustrative Table-Top Concept</h2>
          <div className="top-model-image">
            <div className="top-model-callout model-mist">Misting Nozzle<b>(4 around perimeter)</b></div><div className="top-model-callout model-weather">Weather Sensor<b>(on mast)</b></div><div className="top-model-callout model-pm">PM Sensor<b>(at boundary)</b></div><div className="top-model-callout model-tank">Water Tank</div><div className="top-model-callout model-pump">Water Pump</div><div className="top-model-callout model-box">Control Box</div><div className="top-model-callout model-site">Construction Site<br /><b>with miniature equipment</b></div>
          </div>
        </article>
        <article className="prototype-panel components-panel">
          <h2 className="prototype-panel-title"><span>2</span>Prototype Concept Components</h2>
          <div className="component-cards">{parts.map((part) => <div className="prototype-component" key={part.title}><span className="component-mini-icon">{part.icon}</span><div><h3>{part.title}</h3><p>{part.body}</p></div></div>)}</div>
        </article>
        <article className="prototype-panel flow-panel">
          <h2 className="prototype-panel-title"><span>3</span>How the Prototype Works</h2><p>Five-step concept flow shown as a local browser demonstration.</p>
          <div className="prototype-flow">{steps.map((step, i) => <div className="prototype-flow-item" key={step.title}><span className="prototype-flow-number">{i + 1}</span><span className="prototype-flow-icon">{step.icon}</span><div><h3>{step.title}</h3><p>{step.body}</p></div></div>)}</div>
          <button type="button" className="prototype-live-toggle" aria-pressed={demoRunning} aria-label={`Toggle display-only preview; currently ${demoRunning ? 'running' : 'paused'}`} onClick={() => setDemoRunning((v) => !v)}><span className={`prototype-live-dot ${demoRunning ? 'live' : ''}`} aria-hidden="true" />Display-only preview {demoRunning ? 'running' : 'paused'} · sample cycle {pulse % 5 + 1}</button>
          <small className="prototype-demo-note">Local UI animation only · no physical sensor or actuator is connected.</small>
        </article>
      </section>
    </>
  );
}
