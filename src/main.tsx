import React, { Suspense, lazy, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { SiteFooter, SiteHeader } from './components/SiteChrome';
import './index.css';
import './styles-overrides.css';
import './styles-serial.css';
import './styles-simulation-polish.css';

const Overview = lazy(() => import('./pages/Overview'));
const Problem = lazy(() => import('./pages/Problem'));
const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const Simulation = lazy(() => import('./pages/Simulation'));
const CircuitSimulation = lazy(() => import('./pages/CircuitSimulation'));
const Prototype = lazy(() => import('./pages/Prototype'));
const Results = lazy(() => import('./pages/Results'));
const Team = lazy(() => import('./pages/Team'));
const Contact = lazy(() => import('./pages/Contact'));

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const timer = window.setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' }), 60);
      return () => window.clearTimeout(timer);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, hash]);
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <SiteHeader />
      <main>
        <Suspense fallback={<div className="route-loading"><span />Loading DustTwin…</div>}>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/problem" element={<Problem />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/simulation" element={<Simulation />} />
            <Route path="/circuit-simulation" element={<CircuitSimulation />} />
            <Route path="/prototype" element={<Prototype />} />
            <Route path="/results" element={<Results />} />
            <Route path="/team" element={<Team />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="*" element={<Overview />} />
          </Routes>
        </Suspense>
      </main>
      <SiteFooter />
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
