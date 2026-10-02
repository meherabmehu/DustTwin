import { BarChart3, Leaf, Play, ShieldCheck, Users } from 'lucide-react';
import { FeatureItem } from '../components/Cards';
import { CTAButton, Eyebrow } from '../components/SiteChrome';
import { DustMap } from '../components/Visuals';
import { teamMembers } from '../data/site';
import styles from './Team.module.css';

export default function Team() {
  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="team-heading">
        <div className={styles.heroMap} aria-hidden="true">
          <DustMap intensity={66} activeZone="Zone 2" readings={[12, 28, 82]} showLegend={false} />
        </div>
        <div className={styles.heroCopy}>
          <Eyebrow>OUR TEAM <span>•</span> CTRL_V <span>•</span> CLEANER, SAFER COMMUNITIES</Eyebrow>
          <h1 id="team-heading" className={styles.heading}>Meet the Team <span>CTRL_V</span></h1>
          <p className={styles.description}>
            Four passionate members working together to build DustTwin — for cleaner construction sites and healthier communities.
          </p>
        </div>
      </section>

      <div className={styles.content}>
        <section aria-label="CTRL_V team members">
          <div className={styles.memberGrid}>
            {teamMembers.map((member, index) => (
              <article className={styles.memberCard} key={member.name} aria-labelledby={`team-member-${index + 1}`}>
                <div className={styles.portrait}>
                  <img src={member.image} alt={member.name} width={member.width} height={member.height} decoding="async" />
                </div>
                <h2 id={`team-member-${index + 1}`} className={styles.memberName}>{member.name}</h2>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.demoCta} aria-labelledby="team-demo-heading">
          <div className={styles.demoCopy}>
            <Play className={styles.demoIcon} fill="currentColor" strokeWidth={0} aria-hidden="true" />
            <div>
              <h2 id="team-demo-heading">Request a Live Demo</h2>
              <p>See DustTwin in action and explore how our system supports cleaner, safer construction sites.</p>
            </div>
          </div>
          <CTAButton to="/simulation">Launch Demo</CTAButton>
        </section>

        <section className={styles.values} aria-label="Our mission">
          <FeatureItem icon={<Leaf aria-hidden="true" />} title="Cleaner" detail="Construction Sites" />
          <FeatureItem icon={<ShieldCheck aria-hidden="true" />} title="Healthier" detail="Communities" />
          <FeatureItem icon={<BarChart3 aria-hidden="true" />} title="Smarter" detail="Technology" />
          <FeatureItem icon={<Users aria-hidden="true" />} title="Real-World" detail="Positive Impact" />
        </section>
      </div>
    </div>
  );
}
