import type { ReactNode } from 'react';
import { ArrowRight, Check, TrendingDown } from 'lucide-react';
import { Link } from 'react-router-dom';

export function FeatureItem({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <div className="feature-item"><span className="feature-icon">{icon}</span><div><b>{title}</b><small>{detail}</small></div></div>;
}

export function ModuleCard({ icon, title, description, to, image, badge }: { icon: ReactNode; title: string; description: string; to: string; image?: string; badge?: string }) {
  return (
    <Link to={to} className="module-card">
      <div className="module-media" style={image ? { backgroundImage: `linear-gradient(180deg,rgba(2,14,26,.04),rgba(2,14,26,.74)),url(${image})` } : undefined}>
        <span className="module-icon">{icon}</span>
        {badge && <span className="module-badge">{badge}</span>}
        {!image && <div className="module-art-line" />}
      </div>
      <div className="module-copy"><h3>{title} <ArrowRight size={13} /></h3><p>{description}</p></div>
    </Link>
  );
}

export function ProcessStep({ number, icon, title, children, horizontal = false }: { number: number; icon: ReactNode; title: string; children: ReactNode; horizontal?: boolean }) {
  return (
    <div className={`process-step ${horizontal ? 'horizontal' : ''}`}>
      <span className="step-number">{number}</span><span className="step-icon">{icon}</span>
      <div className="step-copy"><h3>{title}</h3><p>{children}</p></div>
    </div>
  );
}

export function MetricCard({ icon, title, subtitle, value, footnote, trend = true, children }: { icon: ReactNode; title: string; subtitle?: string; value: string; footnote?: string; trend?: boolean; children?: ReactNode }) {
  return (
    <div className="metric-card">
      <span className="metric-icon">{icon}</span>
      <div className="metric-heading"><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</div>
      <div className="metric-value">{value}</div>
      {footnote && <div className="metric-footnote">{trend && <TrendingDown size={12} />}{footnote}</div>}
      {children}
    </div>
  );
}

export function CheckList({ items }: { items: string[] }) {
  return <ul className="check-list">{items.map((item) => <li key={item}><Check size={14} />{item}</li>)}</ul>;
}

export function TopicTag({ children }: { children: ReactNode }) { return <span className="topic-tag">{children}</span>; }
