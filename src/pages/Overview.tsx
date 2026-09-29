import { Activity, BarChart3, BrainCircuit, Box, CircleDot, Droplets, Layers3, Leaf, Monitor, ShieldCheck, Users, Wind, Zap, Radio } from 'lucide-react';
import { CTAButton, Eyebrow, SectionHeading } from '../components/SiteChrome';
import { FeatureItem, ModuleCard, ProcessStep } from '../components/Cards';
import { DustMap } from '../components/Visuals';

export default function Overview() {
  return (
    <>
      <section className="hero overview-hero">
        <div className="hero-map-layer"><DustMap intensity={72} activeZone="Zone 2" readings={[28, 18, 82]} /></div>
        <div className="hero-copy">
          <Eyebrow>AI + SIMULATION <span>•</span> IoT <span>•</span> FOR CLEANER, SAFER COMMUNITIES</Eyebrow>
          <h1 className="hero-title">Predict dust escape<br /><span>before it happens.</span></h1>
          <p className="hero-description">DustTwin predicts construction dust plume movement and activates only the necessary misting zone before off-site exposure, keeping communities healthier and construction smarter.</p>
          <div className="hero-actions">
            <CTAButton to="/simulation" icon={<span className="play-disc">▶</span>}>Explore Simulation</CTAButton>
            <CTAButton to="/prototype" variant="outline" icon={<Box size={20} />}>View Prototype</CTAButton>
          </div>
        </div>
        <div className="hero-features">
          <FeatureItem icon={<ShieldCheck />} title="Protect communities" detail="Cleaner, healthier air" />
          <FeatureItem icon={<Leaf />} title="Reduce water use" detail="Use only what's needed" />
          <FeatureItem icon={<CircleDot />} title="Targeted control" detail="Smart misting zones" />
          <FeatureItem icon={<Zap />} title="Real-time prediction" detail="Act before off-site exposure" />
        </div>
      </section>

      <section className="modules-section section-wrap">
        <SectionHeading title="Key" highlight="Modules" note="Explore each module to see how DustTwin brings together simulation, hardware and real-time intelligence." />
        <div className="module-grid">
          <ModuleCard icon={<Monitor />} title="Live Simulation" description="Visualize real-time dust plume movement across the site with dynamic wind and particle modelling." to="/simulation" image="/images/site-aerial.jpg" badge="LIVE DIGITAL TWIN" />
          <ModuleCard icon={<BarChart3 />} title="Analytics Dashboard" description="Monitor sensor data, air quality trends, and system performance in real time." to="/results" />
          <ModuleCard icon={<BrainCircuit />} title="Wokwi-style Circuit Simulation" description="Interact with an online circuit simulating sensors, microcontroller and misting control." to="/circuit-simulation" />
          <ModuleCard icon={<Box />} title="Prototype Model" description="See our physical prototype with working sensors and automated misting zones." to="/prototype" image="/images/tabletop-prototype.jpg" />
          <ModuleCard icon={<BarChart3 />} title="Results & Impact" description="View illustrative performance results and the impact on air quality and resource use." to="/results" />
        </div>
      </section>

      <section className="process-section section-wrap">
        <SectionHeading title="How" highlight="DustTwin Works" note="From real-world data to real-world impact — a closed loop system for smarter dust control." />
        <div className="process-flow">
          <ProcessStep number={1} icon={<Wind />} title="Inputs">Wind data, site layout, construction activities and real-time PM sensor data.</ProcessStep>
          <ProcessStep number={2} icon={<Layers3 />} title="Digital Twin">A physics-based simulation model replicates the construction site and environmental conditions.</ProcessStep>
          <ProcessStep number={3} icon={<Activity />} title="Prediction">Predicts dust plume movement and potential off-site exposure in real time.</ProcessStep>
          <ProcessStep number={4} icon={<Zap />} title="Control">Automatically activates only the necessary misting zone(s) before dust leaves the site.</ProcessStep>
          <ProcessStep number={5} icon={<Radio />} title="Feedback">Sensor and system performance continuously improve the model for smarter, more accurate control.</ProcessStep>
        </div>
      </section>
    </>
  );
}
