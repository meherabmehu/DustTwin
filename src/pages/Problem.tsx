import { AlertTriangle, Building2, Droplets, HeartPulse, House, Leaf, ShieldCheck, Users, Wind } from 'lucide-react';
import { CTAButton, Eyebrow, SectionHeading } from '../components/SiteChrome';
import { CheckList } from '../components/Cards';
import { DustMap } from '../components/Visuals';

const problemCards = [
  { icon: <HeartPulse />, title: 'Health risk', text: 'Fine particles (PM2.5 and PM10) can penetrate deep into the lungs, worsening respiratory and cardiovascular conditions, especially for vulnerable groups such as children, the elderly, and those with pre-existing conditions.', image: '/images/dusty-site.jpg' },
  { icon: <Users />, title: 'Off-site exposure', text: 'PM2.5 and PM10 can travel hundreds of meters to kilometers beyond site boundaries, affecting nearby communities, schools, hospitals, and other sensitive areas.', image: '/images/site-aerial.jpg' },
  { icon: <Droplets />, title: 'Water waste', text: 'Reactive dust control typically overuses water, leading to higher costs, resource waste, and environmental impacts such as runoff and sedimentation.', image: '/images/tabletop-prototype.jpg' },
  { icon: <AlertTriangle />, title: 'Limits of reactive systems', text: 'Traditional approaches respond after dust is visible or complaints are received, often too late to prevent off-site impacts, with inconsistent effectiveness and higher compliance risk.', image: '/images/dusty-site.jpg' },
];

export default function Problem() {
  return (
    <>
      <section className="hero problem-hero">
        <div className="hero-map-layer"><DustMap intensity={92} problem readings={[26, 28, 82]} activeZone="Zone 2" /></div>
        <div className="hero-copy">
          <Eyebrow>AI + SIMULATION <span>•</span> IoT <span>FOR CLEANER, SAFER COMMUNITIES</span></Eyebrow>
          <h1 className="hero-title">Why construction dust<br /><span>needs predictive control.</span></h1>
          <p className="hero-description">PM2.5 and PM10 from construction sites can travel beyond site boundaries, affecting nearby communities, air quality and regulatory compliance. DustTwin enables proactive, real-time control to keep dust where it belongs.</p>
          <div className="hero-actions">
            <CTAButton to="/problem#real-world-problem" icon={<span className="play-disc">▶</span>}>Explore the Problem</CTAButton>
            <CTAButton to="/how-it-works" variant="outline" icon={<Building2 size={20} />}>View Solution</CTAButton>
          </div>
        </div>
      </section>

      <section id="real-world-problem" className="problem-cards-section section-wrap">
        <SectionHeading title="The Real-World" highlight="Problem" note="Construction dust doesn’t stay on site. It travels, impacting people, the environment, and project outcomes." />
        <div className="problem-cards-grid">
          {problemCards.map((card) => <article key={card.title} className="problem-card" style={{ '--problem-bg': `url(${card.image})` } as React.CSSProperties}>
            <span className="problem-icon">{card.icon}</span><div className="problem-card-copy"><h3>{card.title}</h3><p>{card.text}</p></div>
          </article>)}
        </div>
      </section>

      <section className="comparison-section section-wrap">
        <SectionHeading title="Reactive vs." highlight="Predictive Control" note="From reacting to dust after it’s a problem, to predicting and preventing it before it leaves the site." />
        <div className="comparison-pair">
          <article className="approach-card reactive">
            <h3><AlertTriangle />Current reactive approach</h3>
            <div className="approach-image" style={{ backgroundImage: 'url(/images/dusty-site.jpg)' }} />
            <CheckList items={['Reactive and often too late', 'Dust can already travel off-site', 'Higher water use and operating costs', 'Inconsistent effectiveness', 'Greater compliance and community risk']} />
          </article>
          <article className="approach-card predictive">
            <h3><Wind />DustTwin predictive targeted control</h3>
            <div className="approach-image" style={{ backgroundImage: 'linear-gradient(100deg,rgba(0,32,47,.04),rgba(0,25,39,.1)),url(/images/site-aerial.jpg)' }} />
            <CheckList items={['Predicts dust plume movement in real time', 'Activates targeted control only where needed', 'Keeps dust within site boundaries', 'Reduces water use and environmental impact', 'Improves compliance and community trust']} />
          </article>
        </div>
        <div className="goal-strip">
          <div className="goal-lead"><h2>Our <span>Goal</span></h2><p>A cleaner, safer, and more sustainable future for construction and the communities around it.</p></div>
          <div className="goal-item"><ShieldCheck size={27} /><div><h3>Keep dust within site boundaries</h3><p>Prevent off-site impacts through predictive, targeted control.</p></div></div>
          <div className="goal-item"><Users size={27} /><div><h3>Protect nearby communities</h3><p>Safeguard public health and sensitive areas.</p></div></div>
          <div className="goal-item"><Leaf size={27} /><div><h3>Reduce water use and environmental impact</h3><p>Use only what’s needed, minimizing waste and runoff.</p></div></div>
          <div className="goal-item"><Wind size={27} /><div><h3>Enable smarter, more efficient construction</h3><p>Deliver cleaner sites, lower costs, and stronger compliance.</p></div></div>
        </div>
      </section>
    </>
  );
}
