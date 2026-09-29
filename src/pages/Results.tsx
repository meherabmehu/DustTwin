import { BarChart3, Clock3, Droplets, Leaf, ShieldCheck, Users, Wind, Timer, Activity, Gauge, TrendingDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CTAButton, Eyebrow, SectionHeading } from '../components/SiteChrome';
import { CheckList } from '../components/Cards';
import { BoundaryLineChart, ComparisonBars, Sparkline, useSparkData } from '../components/Charts';
import { DustMap } from '../components/Visuals';

const comparisonSeries = Array.from({ length: 18 }, (_, i) => ({
  time: `${String(Math.floor(i / 3) * 4).padStart(2, '0')}:00`,
  baseline: Math.round(70 + Math.sin(i * .52) * 28 + Math.cos(i * .25) * 13),
  twin: Math.round(30 + Math.sin(i * .48) * 12 + Math.cos(i * .3) * 6),
}));
const comparisonBars = [{ label: 'Illustrative', baseline: 48, continuous: 18, reactive: 12, predictive: 4 }];
const waterBars = [{ label: 'L / day', baseline: 0, continuous: 320, reactive: 210, predictive: 120 }];
const receptorLines = comparisonSeries.map((row, i) => ({ ...row, twin: Math.max(5, row.twin * .58), baseline: row.baseline * .72 }));

const resultMetrics = [
  { icon: <Activity />, title: 'PM Reduction', subtitle: 'Lower average PM10 at site boundary', value: '−78%', foot: 'vs. no control', base: 68 },
  { icon: <ShieldCheck />, title: 'Boundary Exceedance Time', subtitle: 'Time above regulatory threshold', value: '−92%', foot: 'vs. no control', base: 48 },
  { icon: <Droplets />, title: 'Water Use Reduction', subtitle: 'Smarter, targeted application uses less water', value: '−62%', foot: 'vs. continuous spraying', base: 58 },
  { icon: <Clock3 />, title: 'Prediction Lead Time', subtitle: 'Advance notice of dust events', value: '+45 min', foot: 'earlier than threshold exceedance', base: 39 },
  { icon: <Users />, title: 'Protected Public Area', subtitle: 'Lower PM10 at nearest community receptor', value: '3.2×', foot: 'reduction vs. no control', base: 43 },
];

export default function Results() {
  return (
    <>
      <section className="hero results-hero">
        <div className="hero-map-layer"><DustMap intensity={80} activeZone="Zone 2" readings={[12, 28, 82]} /></div>
        <div className="hero-copy">
          <Eyebrow><Activity size={11} /> RESULTS <span>•</span> REAL-WORLD IMPACT</Eyebrow>
          <h1 className="hero-title">Measurable impact<br />for <span>cleaner air,</span><br /><span>safer communities.</span></h1>
          <p className="hero-description">DustTwin delivers promising simulation results, reducing projected dust exposure while using less water and fewer resources.</p>
          <div className="hero-actions"><CTAButton to="#case-study" icon={<span className="play-disc">▶</span>}>Explore Case Study</CTAButton><CTAButton to="/simulation" variant="outline" icon={<span className="cube-outline"><span /></span>}>View Simulation Results</CTAButton></div>
        </div>
      </section>

      <section className="results-section section-wrap">
        <SectionHeading title="Key" highlight="Results" note="Illustrative performance from deterministic simulation scenarios." />
        <p className="disclaimer">Demo Simulation Results · illustrative only · not field-validated or scientifically verified.</p>
        <div className="result-metrics">
          {resultMetrics.map((metric) => <article className="result-metric" key={metric.title}><div className="result-metric-head"><span>{metric.icon}</span><div><h3>{metric.title}</h3><p>{metric.subtitle}</p></div></div><div className="result-value">{metric.value}</div><div className="result-footnote">{metric.foot}</div><div className="result-spark"><Sparkline base={metric.base} /></div></article>)}
        </div>
      </section>

      <section className="strategy-section section-wrap">
        <div className="section-heading-row"><h2>Strategy <span>Comparison</span></h2><p>Illustrative scenarios compare predictive control with common site strategies.</p><div className="strategy-legend"><span><i style={{ background: '#8a929f' }} />No Control</span><span><i style={{ background: '#ff723c' }} />Continuous Spraying</span><span><i style={{ background: '#ffca2f' }} />Reactive Spraying</span><span><i style={{ background: '#16d9ed' }} />DustTwin Predictive</span></div></div>
        <div className="strategy-charts">
          <article className="strategy-chart-card"><h3>Average PM10 at <span>Site Boundary</span><small> (μg/m³)</small></h3><BoundaryLineChart data={comparisonSeries} /></article>
          <article className="strategy-chart-card"><h3>Boundary Exceedance Time <small>(% of time &gt; 50 μg/m³)</small></h3><ComparisonBars data={comparisonBars} compact /></article>
          <article className="strategy-chart-card"><h3><Droplets size={15} /> Water Use <small>(m³ per day)</small></h3><ComparisonBars data={waterBars} compact /></article>
          <article className="strategy-chart-card"><h3>PM10 at Nearest Community <span>Receptor</span></h3><BoundaryLineChart data={receptorLines} /></article>
        </div>
      </section>

      <section className="benefits-section section-wrap">
        <div><SectionHeading title="Tangible" highlight="Benefits" note="Cleaner air. Safer communities. More efficient operations. A more sustainable future." /><div className="benefit-cards">
          <article className="benefit-card" style={{ backgroundImage: 'linear-gradient(100deg,rgba(3,21,34,.98),rgba(3,21,34,.77)),url(/images/site-aerial.jpg)' }}><h3>For <span>People</span></h3><CheckList items={['Healthier communities', 'Reduced dust complaints', 'Safer, more liveable neighborhoods']} /></article>
          <article className="benefit-card" style={{ backgroundImage: 'linear-gradient(100deg,rgba(3,21,34,.98),rgba(3,21,34,.75)),url(/images/tabletop-prototype.jpg)' }}><h3>For <span>Operations</span></h3><CheckList items={['Proactive, data-driven decisions', 'Lower water and operating costs', 'Compliance support and reporting']} /></article>
          <article className="benefit-card" style={{ backgroundImage: 'linear-gradient(100deg,rgba(3,21,34,.96),rgba(3,21,34,.67)),url(/images/dusty-site.jpg)' }}><h3>For the <span>Environment</span></h3><CheckList items={['Lower water use', 'Reduced air pollution', 'Smaller environmental footprint']} /></article>
        </div></div>
        <article className="case-study" id="case-study"><div className="case-head"><div><h3>Case Study: <span>Real-World Impact</span></h3><small>Illustrative deployment scenario · comparison is simulated, not a measured field deployment</small></div><Link to="/simulation" className="topic-tag">View Simulation <TrendingDown size={12} /></Link></div><div className="case-scenes"><div className="case-scene" style={{ backgroundImage: 'url(/images/dusty-site.jpg)' }}><small>Before · No Control</small><span>Illustrative dust plume</span></div><div className="case-arrow">›</div><div className="case-scene" style={{ backgroundImage: 'url(/images/site-aerial.jpg)' }}><small>After · DustTwin</small><span>Targeted misting preview</span></div></div></article>
      </section>
    </>
  );
}
