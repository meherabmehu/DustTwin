import { useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { navItems } from '../data/site';

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="DustTwin home">
      <svg className="brand-mark" viewBox="0 0 70 40" role="img" aria-hidden="true">
        <path d="M8 28.5a10 10 0 0 1 2.4-19.7A15.7 15.7 0 0 1 39 9.1 12 12 0 0 1 54.4 19c6.8-.2 10.6 3.7 10.6 8.2 0 4.6-4.1 7.8-9.3 7.8H17.2" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M23 22h21M18 28h26M48 30h10" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
      </svg>
      <span className="brand-copy"><strong>Dust<span>Twin</span></strong><small>CLEANER AIR. SMARTER SITES.</small></span>
    </Link>
  );
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const currentPath = location.pathname;
  const closeMenu = () => setMenuOpen(false);
  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <button className="mobile-menu-toggle" onClick={() => setMenuOpen((v) => !v)} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}>
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.path === '/'} onClick={closeMenu} className={({ isActive }) => `nav-link ${(isActive || (item.path !== '/' && currentPath.startsWith(item.path))) ? 'active' : ''}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Link to="/simulation" className="header-cta" onClick={closeMenu}>Launch Demo <ArrowRight size={15} /></Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <Brand />
        <nav className="footer-nav" aria-label="Footer navigation">
          {navItems.map((item) => <Link key={item.path} to={item.path}>{item.label}</Link>)}
        </nav>
        <div className="footer-social" aria-label="Social links">
          <a href="https://www.linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn">in</a>
          <a href="https://www.youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube">▶</a>
          <a href="https://github.com" target="_blank" rel="noreferrer" aria-label="GitHub">⌘</a>
        </div>
        <p className="footer-note">© 2026 DustTwin.<br />Building cleaner, safer communities.</p>
      </div>
    </footer>
  );
}

export function PageShell({ children, footer = true }: { children: React.ReactNode; footer?: boolean }) {
  return <><SiteHeader /><main>{children}</main>{footer && <SiteFooter />}</>;
}

export function Eyebrow({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return <div className="eyebrow">{icon && <span>{icon}</span>}{children}</div>;
}

export function CTAButton({ to, children, variant = 'primary', icon }: { to: string; children: React.ReactNode; variant?: 'primary' | 'outline'; icon?: React.ReactNode }) {
  return <Link to={to} className={`cta-button ${variant === 'outline' ? 'outline' : ''}`}>{icon && <span className="cta-icon">{icon}</span>}<span>{children}</span><ArrowRight size={16} /></Link>;
}

export function SectionHeading({ title, highlight, note }: { title: string; highlight?: string; note?: string }) {
  return <div className="section-heading-row"><h2>{highlight ? <>{title} <span>{highlight}</span></> : title}</h2>{note && <p>{note}</p>}</div>;
}

export function usePagePath() {
  return useLocation().pathname;
}
