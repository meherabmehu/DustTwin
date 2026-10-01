import { useState } from 'react';
import { Activity, BarChart3, Box, Cpu, Droplet, Gauge, Laptop, Monitor, Settings, ShieldCheck, Wind, Zap } from 'lucide-react';
import { CTAButton, Eyebrow } from '../components/SiteChrome';
import { FeatureItem } from '../components/Cards';
import { DustMap } from '../components/Visuals';

const parts = [
  { icon: <Droplet />, title: 'Misting Nozzle (x4)', body: 'Four targeted boundary misting zones (Zones A–D) to suppress dust.' },
  { icon: <Wind />, title: 'Weather Sensor', body: 'Measures wind speed, wind direction, temperature and humidity.' },
  { icon: <Gauge />, title: 'PM Sensor (x2)', body: 'Measures PM2.5 and PM10 at key site boundary points.' },
  { icon: <Droplet />, title: 'Water Tank', body: 'Stores clean water for the misting system.' },
  { icon: <Activity />, title: 'Water Pump', body: 'Supplies pressurized water to active misting zones.' },
  { icon: <Cpu />, title: 'Control Box', body: 'ESP32 DevKit V1 + 4-Channel Relay module. Runs DustTwin control logic for the pump and zones.' },
  { icon: <Box />, title: 'Table-Top Construction Site', body: 'Sand, toy excavator and dump truck simulate construction activity and dust generation.' },
];
const steps = [
  { icon: <Wind />, title: 'Sense', body: 'PM and weather sensors capture site conditions.' },
  { icon: <Activity />, title: 'Predict', body: 'AI forecasts PM10 approximately 30 seconds ahead, providing an early dust-risk signal.' },
  { icon: <Settings />, title: 'Decide', body: 'Deterministic site logic combines the AI PM10 forecast with wind direction and site geometry to select the required misting zone(s).' },
  { icon: <Droplet />, title: 'Act', body: 'The ESP32 activates the corresponding relay, valve, and pump response.' },
  { icon: <Monitor />, title: 'Visualize', body: 'The dashboard shows sensor values, AI forecast, control decisions, and system status.' },
];

export default function Prototype() {
  const [demoRunning, setDemoRunning] = useState(true);
  return (
    <>
      <section className="hero prototype-hero">
        <div className="hero-map-layer"><DustMap intensity={58} readings={[24, 18, 40]} hotReadingIndex={-1} activeZone="Zone B" showLegend={false} showWind={false} /></div>
        <svg className="prototype-hero-connectors" viewBox="0 0 1000 452" preserveAspectRatio="none" aria-hidden="true">
          <g fill="none" stroke="rgba(35,221,244,.78)" strokeWidth="1.5" vectorEffect="non-scaling-stroke">
            <path d="M540 92 L550 112 L564 153" /><path d="M692 42 L710 42 L718 52" />
            <path d="M817 126 L817 145 L825 160" /><path d="M870 197 L904 197 L925 211" />
            <path d="M872 315 L902 315 L917 300" /><path d="M808 394 L830 369 L847 344" />
            <path d="M590 351 L564 339 L545 327" />
          </g>
          <g fill="#1bdcf3" stroke="#d9fbff" strokeWidth="1" vectorEffect="non-scaling-stroke">
            <circle cx="564" cy="153" r="3" /><circle cx="718" cy="52" r="3" /><circle cx="825" cy="160" r="3" />
            <circle cx="925" cy="211" r="3" /><circle cx="917" cy="300" r="3" /><circle cx="847" cy="344" r="3" /><circle cx="545" cy="327" r="3" />
          </g>
        </svg>
        <div className="prototype-callout callout-nozzle"><Droplet size={17} />Misting Nozzles<br /><small>(Zones A–D perimeter)</small></div>
        <div className="prototype-callout callout-weather"><Wind size={18} />Weather Sensor</div>
        <div className="prototype-callout callout-pm"><Gauge size={17} />PM Sensor<br /><small>(at site boundary)</small></div>
        <div className="prototype-callout callout-tank"><Droplet size={17} />Water Tank</div>
        <div className="prototype-callout callout-pump"><Activity size={17} />Water Pump</div>
        <div className="prototype-callout callout-box"><Cpu size={17} />Control Box<br /><small>(ESP32 + 4-Channel Relay)</small></div>
        <div className="prototype-callout callout-laptop"><Laptop size={17} />Laptop Dashboard<br /><small>(Real-time monitoring)</small></div>
        <div className="hero-copy">
          <Eyebrow><span>▱</span> PROTOTYPE DEMO <span>›</span> TABLE-TOP MODEL <span>›</span> JUDGE EXPERIENCE</Eyebrow>
          <h1 className="hero-title">The prototype judges<br /><span>will experience.</span></h1>
          <p className="hero-description">A working table-top model that demonstrates how DustTwin senses dust, forecasts PM10 risk, and automatically activates targeted misting in real time. Experience the complete closed-loop system in a compact, hands-on demonstration.</p>
          <div className="hero-actions"><CTAButton to="#model-overview" icon={<span className="play-disc">▶</span>}>Watch Prototype Video</CTAButton><CTAButton to="/circuit-simulation" variant="outline" icon={<Box size={20} />}>View Circuit Details</CTAButton></div>
          <div className="prototype-features"><FeatureItem icon={<ShieldCheck />} title="Real hardware" detail="Working sensors and actuators" /><FeatureItem icon={<Settings />} title="Live demonstration" detail="See real-time dust control in action" /><FeatureItem icon={<BarChart3 />} title="Same control architecture" detail="Designed to scale to the full DustTwin system" /><FeatureItem icon={<Zap />} title="Hands-on experience" detail="Built for judges to explore" /></div>
        </div>
      </section>

      <section className="prototype-workbench" id="model-overview">
        <article className="prototype-panel top-model-panel">
          <h2 className="prototype-panel-title"><span>1</span>Top View of Table-Top Model</h2>
          <div className="top-model-image">
            <svg className="top-model-connectors" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
              <g fill="none" stroke="rgba(25,218,241,.83)" strokeWidth="2" vectorEffect="non-scaling-stroke">
                <path d="M236 86 L236 133 L285 174" /><path d="M760 79 L692 79 L611 117" />
                <path d="M148 267 L205 267 L246 312" /><path d="M796 303 L742 303 L697 276" />
                <path d="M788 424 L728 424 L673 390" /><path d="M750 523 L695 523 L650 474" />
                <path d="M264 520 L321 520 L386 405" />
              </g>
              <g fill="#20dff3" stroke="#dcfbff" strokeWidth="1" vectorEffect="non-scaling-stroke">
                <circle cx="285" cy="174" r="4" /><circle cx="611" cy="117" r="4" /><circle cx="246" cy="312" r="4" />
                <circle cx="697" cy="276" r="4" /><circle cx="673" cy="390" r="4" /><circle cx="650" cy="474" r="4" /><circle cx="386" cy="405" r="4" />
              </g>
            </svg>
            <div className="top-model-callout model-mist">Misting Nozzles<b>(Zones A–D perimeter)</b></div><div className="top-model-callout model-weather">Weather Sensor<b>(on mast)</b></div><div className="top-model-callout model-pm">PM Sensor<b>(at boundary)</b></div><div className="top-model-callout model-tank">Water Tank</div><div className="top-model-callout model-pump">Water Pump</div><div className="top-model-callout model-box">Control Box<b>(ESP32 + 4-Channel Relay)</b></div><div className="top-model-callout model-site">Construction Site<br /><b>(sand, excavator, truck)</b></div>
          </div>
        </article>
        <article className="prototype-panel components-panel">
          <h2 className="prototype-panel-title"><span>2</span>Key Components Inside the Prototype</h2>
          <div className="component-cards">{parts.map((part) => <div className="prototype-component" key={part.title}><span className="component-mini-icon">{part.icon}</span><div><h3>{part.title}</h3><p>{part.body}</p></div></div>)}</div>
        </article>
        <article className="prototype-panel flow-panel">
          <h2 className="prototype-panel-title"><span>3</span>How the Prototype Works</h2>
          <p>A simple 5-step closed-loop flow, demonstrated in real time.</p>
          <small className="prototype-ml-note">AI-assisted hybrid control: 30s predictive PM10 forecast paired with deterministic site logic.</small>
          <div className="prototype-flow">{steps.map((step, i) => <div className="prototype-flow-item" key={step.title}><span className="prototype-flow-number">{i + 1}</span><span className="prototype-flow-icon">{step.icon}</span><h3>{step.title}</h3><p>{step.body}</p></div>)}</div>
          <button type="button" className="prototype-live-toggle" aria-pressed={demoRunning} aria-label={`Toggle prototype demo status; currently ${demoRunning ? 'ready' : 'paused'}`} onClick={() => setDemoRunning((v) => !v)}><span className={`prototype-live-dot ${demoRunning ? 'live' : ''}`} aria-hidden="true" />{demoRunning ? 'Prototype Demo Ready' : 'Prototype Demo Paused'}</button>
        </article>
      </section>
    </>
  );
}
