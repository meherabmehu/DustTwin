import { ArrowRight, BarChart3, BookOpen, BrainCircuit, Cpu, Leaf, Monitor, Presentation, ShieldCheck, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CTAButton, Eyebrow, SectionHeading } from '../components/SiteChrome';
import { FeatureItem, TopicTag } from '../components/Cards';
import { DustMap } from '../components/Visuals';
import { teamMembers } from '../data/site';

const memberIcons = [<BrainCircuit />, <Cpu />, <Monitor />, <BookOpen />, <Presentation />];

export default function Team() {
  return (
    <>
      <section className="hero team-hero">
        <div className="hero-map-layer"><DustMap intensity={66} activeZone="Zone 2" readings={[12, 28, 82]} /></div>
        <div className="hero-copy">
          <Eyebrow>OUR TEAM <span>•</span> AI + SIMULATION + IoT <span>•</span> CLEANER, SAFER COMMUNITIES</Eyebrow>
          <h1 className="hero-title">Built by a team focused<br /><span>on cleaner construction.</span></h1>
          <p className="hero-description">We combine AI, simulation, and smart control to predict construction dust, activate mitigation only when needed, and help build healthier communities.</p>
          <div className="hero-actions"><CTAButton to="/contact" icon={<span className="play-disc">▶</span>}>Request a Live Demo</CTAButton><CTAButton to="/results" variant="outline" icon={<span className="cube-outline"><span /></span>}>See Our Work</CTAButton></div>
          <div className="team-values">
            <FeatureItem icon={<Leaf />} title="Cleaner communities" detail="Reduce dust exposure" />
            <FeatureItem icon={<ShieldCheck />} title="Smarter construction" detail="Data-driven control" />
            <FeatureItem icon={<BarChart3 />} title="Real-world impact" detail="Healthier air for all" />
            <FeatureItem icon={<Users />} title="Mission driven" detail="Technology for people" />
          </div>
        </div>
      </section>

      <section className="team-section section-wrap">
        <SectionHeading title="Meet the" highlight="Team" note="A multidisciplinary team bringing together AI, hardware, simulation, and real-world impact." />
        <div className="team-grid">
          {teamMembers.map((member, index) => <article className="team-card" key={member.role}>
            <span className="team-card-icon">{memberIcons[index]}</span>
            <div className="team-portrait"><img src={member.image} alt="Illustrated team portrait placeholder" /></div>
            <h3>{member.role}</h3><p>{member.description}</p>
            <div className="team-tags">{member.skills.map((skill) => <TopicTag key={skill}>{skill}</TopicTag>)}</div>
          </article>)}
        </div>
      </section>

      <section className="team-cta">
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}><span className="team-play"><span>▶</span></span><div><h3>Request a Live Demo</h3><p>See DustTwin in action and learn how our team can help your project achieve cleaner, safer construction sites.</p></div></div>
        <CTAButton to="/contact" variant="outline">Talk with our team</CTAButton>
      </section>
      <section className="team-expertise">
        <div className="expertise-copy"><h3>Our Team’s <span>Expertise</span></h3><p>We bring together expertise in artificial intelligence, environmental simulation, IoT hardware, data visualization, and real-world construction impact to create practical solutions for cleaner and healthier communities.</p></div>
        <div className="expertise-item"><BrainCircuit /><span>AI &<br />Simulation</span></div><div className="expertise-item"><Cpu /><span>IoT &<br />Hardware</span></div><div className="expertise-item"><BarChart3 /><span>Data &<br />Visualization</span></div><div className="expertise-item"><Users /><span>Real-World<br />Impact</span></div>
      </section>
      <div className="team-section-footer"><span>Names and biographies are placeholders and can be replaced in <code>src/data/site.ts</code>.</span><Link to="/contact">Get in touch <ArrowRight size={12} /></Link></div>
    </>
  );
}
