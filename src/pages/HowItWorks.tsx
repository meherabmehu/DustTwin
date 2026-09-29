import { Activity, BrainCircuit, Database, Layers3, Radio, Settings2, Wind, Zap } from 'lucide-react';
import { CTAButton, Eyebrow, SectionHeading } from '../components/SiteChrome';
import { ProcessStep } from '../components/Cards';
import { DustMap } from '../components/Visuals';

const architecture = [
  { icon: <Radio />, title: 'Sensor Input Layer', body: 'Ingests real-time data from PM2.5 sensors, weather stations, and site activity sources.' },
  { icon: <Database />, title: 'Simulation Engine', body: 'Physics-based model simulates airflow and dust dispersion across the construction site.' },
  { icon: <BrainCircuit />, title: 'AI Prediction Module', body: 'Model-ready prediction interface; this prototype uses deterministic mock outputs until the real model is connected.' },
  { icon: <Settings2 />, title: 'Decision & Control Logic', body: 'Determines optimal misting zone activation based on predicted risk and site conditions.' },
  { icon: <Activity />, title: 'Live Verification & Feedback', body: 'Monitors sensor data to measure impact and continuously improves model accuracy.' },
];

export default function HowItWorks() {
  return (
    <>
      <section className="hero how-hero">
        <div className="hero-map-layer"><DustMap intensity={72} activeZone="Zone 2" readings={[18, 26, 78]} /></div>
        <div className="hero-copy">
          <Eyebrow><span>›</span> HOW IT WORKS <span>•</span> AI + SIMULATION + IoT <span>•</span> CLEANER, SAFER COMMUNITIES</Eyebrow>
          <h1 className="hero-title">From data to dust<br /><span>control in 5 steps.</span></h1>
          <p className="hero-description">DustTwin combines real-world sensor data, physics-based simulation, AI prediction, and smart misting control to predict construction dust movement and stop it before it spreads.</p>
        </div>
      </section>

      <section className="how-process section-wrap">
        <SectionHeading title="The" highlight="5-Step Process" note="From real-world data to real-world impact — DustTwin turns insight into action in five steps." />
        <div className="process-flow">
          <ProcessStep number={1} icon={<Wind />} title="Inputs">Collect real-time data from site sensors, weather forecasts, and construction activities.</ProcessStep>
          <ProcessStep number={2} icon={<Layers3 />} title="Digital Twin">Create a physics-based virtual site that mirrors real conditions in real time.</ProcessStep>
          <ProcessStep number={3} icon={<Activity />} title="Prediction">Use AI to predict dust plume movement and identify high-risk zones before exposure occurs.</ProcessStep>
          <ProcessStep number={4} icon={<Settings2 />} title="Control">Automatically activate misting zones to suppress dust at the right time and location.</ProcessStep>
          <ProcessStep number={5} icon={<Radio />} title="Feedback">Verify impact with live sensor data and continuously improve the model for smarter control.</ProcessStep>
        </div>
      </section>

      <section className="action-section">
        <div className="action-copy">
          <h2>In <span>Action</span></h2>
          <p>Watch how DustTwin brings together real-time data, AI prediction, and smart misting control on a live construction site. The map shows current dust levels, wind direction, sensor locations, and the active misting zone working to stop the plume before it spreads.</p>
          <CTAButton to="/simulation" icon={<span className="play-disc">▶</span>}>Explore Live Simulation</CTAButton>
        </div>
        <div className="action-map"><DustMap intensity={81} activeZone="Zone 2" readings={[12, 28, 82]} /></div>
      </section>

      <section className="architecture-section section-wrap">
        <SectionHeading title="System" highlight="Architecture" note="A fully integrated system that connects the physical site with a virtual model, AI intelligence, and automated control." />
        <div className="architecture-grid">
          {architecture.map((item) => <article className="arch-card" key={item.title}><span className="arch-icon">{item.icon}</span><div><h3>{item.title}</h3><p>{item.body}</p></div></article>)}
        </div>
      </section>
    </>
  );
}
