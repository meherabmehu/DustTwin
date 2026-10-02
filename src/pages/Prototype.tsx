import { useState } from 'react';
import { Activity, BarChart3, Box, Compass, Cpu, Droplet, Fan, Gauge, Monitor, Settings, ShieldCheck, Thermometer, Wind, Zap } from 'lucide-react';
import { CTAButton, Eyebrow } from '../components/SiteChrome';
import { FeatureItem } from '../components/Cards';

const parts = [
  { icon: <Wind />, title: 'Anemometer', body: 'Wind Speed Sensor · GPIO 32' },
  { icon: <Compass />, title: 'Wind Vane', body: 'Wind Direction Sensor · GPIO 33' },
  { icon: <Gauge />, title: 'PM Sensor ×2', body: 'Measures PM2.5 and PM10 at site boundary points.' },
  { icon: <Thermometer />, title: 'DHT22', body: 'Measures ambient temperature and humidity.' },
  { icon: <Droplet />, title: 'Misting Nozzles ×4', body: 'Four targeted boundary misting zones (A–D).' },
  { icon: <Droplet />, title: 'Water Tank', body: 'Stores clean water for the misting system.' },
  { icon: <Activity />, title: 'Water Pump', body: 'Supplies pressurized water to active misting zones.' },
  { icon: <Fan />, title: '12V DC Fan', body: 'Creates controlled airflow to simulate site wind conditions.' },
  { icon: <Cpu />, title: 'Control Box', body: 'ESP32 + 4-channel relay for the pump and zone outputs.' },
  { icon: <Box />, title: 'Table-Top Construction Site', body: 'Sand, toy excavator and dump truck simulate construction activity.' },
];

const steps = [
  { icon: <Wind />, title: 'Sense', body: 'PM sensors capture PM2.5 / PM10; Anemometer measures wind speed; Wind Vane measures direction; DHT22 measures temperature and humidity.' },
  { icon: <Activity />, title: 'Predict', body: 'AI forecasts PM10 approximately 30 seconds ahead using historical PM10 only.' },
  { icon: <Settings />, title: 'Decide', body: 'Deterministic site logic uses the forecast where applicable, wind speed/direction, site geometry and scenario to choose the exposed boundary, misting zones and control response.' },
  { icon: <Droplet />, title: 'Act', body: 'ESP32 activates the relevant relay, solenoid valve(s), water pump and misting nozzle(s). The fan can simulate site airflow.' },
  { icon: <Monitor />, title: 'Visualize', body: 'Dashboard shows sensor data, wind values, AI forecast, active zones, system state and control response.' },
];

const modelDescription = 'Annotated physical DustTwin tabletop model. The 12V DC fan on the left simulates site airflow. Anemometer and separate Wind Vane sit on the weather mast; DHT22 measures temperature and humidity. Two PM sensors sit at the site boundary. Four perimeter nozzles, water tank, pump, ESP32 relay control box, sand, excavator and dump truck complete the model.';

export default function Prototype() {
  const [demoRunning, setDemoRunning] = useState(true);

  return (
    <>
      <section className="prototype-intro" aria-labelledby="prototype-title">
        <div className="prototype-hero-layout">
          <div className="prototype-copy">
            <Eyebrow><span aria-hidden="true">✦</span> PROTOTYPE DEMO <span aria-hidden="true">›</span> TABLE-TOP MODEL <span aria-hidden="true">›</span> JUDGE EXPERIENCE</Eyebrow>
            <h1 id="prototype-title" className="prototype-title">The prototype judges<br /><span>will experience.</span></h1>
            <p className="prototype-description">A working table-top model that demonstrates how DustTwin senses dust, forecasts PM10 risk, and automatically activates targeted misting in real time. Experience the complete closed-loop system in a compact, hands-on demonstration.</p>
          </div>

          <div className="prototype-benefits" aria-label="Prototype highlights">
            <FeatureItem icon={<ShieldCheck />} title="Real hardware" detail="Working sensors and actuators" />
            <FeatureItem icon={<Settings />} title="Live demonstration" detail="See real-time dust control in action" />
            <FeatureItem icon={<BarChart3 />} title="Same control architecture" detail="Designed to scale to the full DustTwin system" />
            <FeatureItem icon={<Zap />} title="Hands-on experience" detail="Built for judges to explore" />
          </div>

          <div className="prototype-actions">
            <CTAButton to="#model-overview" icon={<span className="play-disc">▶</span>}>Watch Prototype Video</CTAButton>
            <CTAButton to="/circuit-simulation" variant="outline" icon={<Box size={20} />}>View Circuit Details</CTAButton>
          </div>
        </div>
      </section>

      <section className="prototype-workbench" id="model-overview" aria-label="Prototype tabletop model, components and operating sequence">
        <article className="prototype-model-panel" aria-labelledby="prototype-model-title">
          <h2 className="prototype-sr-only" id="prototype-model-title">Annotated top view of the table-top model</h2>
          <div className="prototype-model-image" role="img" aria-label={modelDescription}>
            <svg className="prototype-model-connectors" viewBox="0 0 1000 562" preserveAspectRatio="none" aria-hidden="true">
              <g fill="none" stroke="rgba(25,218,241,.9)" strokeWidth="1.7" vectorEffect="non-scaling-stroke">
                <path d="M176 251 H130 L77 329" />
                <path d="M305 43 H352 L405 55" />
                <path d="M560 77 V52" />
                <path d="M758 137 H672 L592 153" />
                <path d="M340 190 H313 L286 208" />
                <path d="M151 408 H180 L211 354" />
                <path d="M850 331 H820 L783 354" />
                <path d="M350 527 H405 L450 345" />
                <path d="M888 256 H908 L925 241" />
                <path d="M880 392 H913 L943 399" />
                <path d="M802 520 V486 L751 477" />
              </g>
              <g fill="#20dff3" stroke="#e0fbff" strokeWidth="1" vectorEffect="non-scaling-stroke">
                <circle cx="77" cy="329" r="3.2" />
                <circle cx="405" cy="55" r="3.2" />
                <circle cx="560" cy="52" r="3.2" />
                <circle cx="592" cy="153" r="3.2" />
                <circle cx="286" cy="208" r="3.2" />
                <circle cx="211" cy="354" r="3.2" />
                <circle cx="783" cy="354" r="3.2" />
                <circle cx="450" cy="345" r="3.2" />
                <circle cx="925" cy="241" r="3.2" />
                <circle cx="943" cy="399" r="3.2" />
                <circle cx="751" cy="477" r="3.2" />
              </g>
            </svg>

            <div className="prototype-callout model-fan"><strong>12V DC Fan</strong><small>Site Wind Simulation</small></div>
            <div className="prototype-callout model-anemometer"><strong>Anemometer</strong><small>Wind Speed Sensor</small></div>
            <div className="prototype-callout model-vane"><strong>Wind Vane</strong><small>Wind Direction Sensor</small></div>
            <div className="prototype-callout model-dht"><strong>DHT22</strong><small>Temperature + Humidity</small></div>
            <div className="prototype-callout model-nozzles"><strong>Misting Nozzles</strong><small>Zones A–D perimeter</small></div>
            <div className="prototype-callout model-pm1"><strong>PM Sensor 1</strong><small>PM2.5 / PM10</small></div>
            <div className="prototype-callout model-pm2"><strong>PM Sensor 2</strong><small>PM2.5 / PM10</small></div>
            <div className="prototype-callout model-site"><strong>Construction Site</strong><small>sand, excavator, truck</small></div>
            <div className="prototype-callout model-tank"><strong>Water Tank</strong><small>Water Storage</small></div>
            <div className="prototype-callout model-pump"><strong>Water Pump</strong><small>12V DC</small></div>
            <div className="prototype-callout model-control"><strong>Control Box</strong><small>ESP32 + 4-channel relay</small></div>
          </div>
          <div className="prototype-mobile-label-list" aria-label="Tabletop model component labels">
            <span>12V DC Fan<small>Site Wind Simulation</small></span>
            <span>Anemometer<small>Wind Speed Sensor</small></span>
            <span>Wind Vane<small>Wind Direction Sensor</small></span>
            <span>DHT22<small>Temperature + Humidity</small></span>
            <span>PM Sensors ×2<small>PM2.5 / PM10</small></span>
            <span>Misting Nozzles ×4<small>Zones A–D perimeter</small></span>
            <span>Water Tank<small>Water Storage</small></span>
            <span>Water Pump<small>12V DC</small></span>
            <span>Control Box<small>ESP32 + 4-channel relay</small></span>
            <span>Construction Site<small>sand, excavator, truck</small></span>
          </div>
        </article>

        <article className="prototype-panel components-panel">
          <h2 className="prototype-panel-title"><span>2</span>Key Components Inside the Prototype</h2>
          <div className="component-cards">
            {parts.map((part) => (
              <div className="prototype-component" key={part.title}>
                <span className="component-mini-icon" aria-hidden="true">{part.icon}</span>
                <h3>{part.title}</h3>
                <p>{part.body}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="prototype-panel flow-panel">
          <h2 className="prototype-panel-title"><span>3</span>How the Prototype Works</h2>
          <p>A simple five-step closed-loop flow, demonstrated in real time.</p>
          <small className="prototype-ml-note">AI model input: historical PM10 only. Wind readings feed deterministic site logic.</small>
          <div className="prototype-flow">
            {steps.map((step, index) => (
              <div className="prototype-flow-item" key={step.title}>
                <span className="prototype-flow-number">{index + 1}</span>
                <span className="prototype-flow-icon" aria-hidden="true">{step.icon}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="prototype-live-toggle"
            aria-pressed={demoRunning}
            aria-label={`Toggle prototype demo status; currently ${demoRunning ? 'ready' : 'paused'}`}
            onClick={() => setDemoRunning((running) => !running)}
          >
            <span className={`prototype-live-dot ${demoRunning ? 'live' : ''}`} aria-hidden="true" />
            {demoRunning ? 'Prototype Demo Ready' : 'Prototype Demo Paused'}
          </button>
        </article>
      </section>
    </>
  );
}
