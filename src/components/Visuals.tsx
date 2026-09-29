import type { CSSProperties } from 'react';
import { Activity, ArrowDownRight, Compass, Droplets, Wind } from 'lucide-react';

export type MapVisualProps = {
  className?: string;
  intensity?: number;
  windSpeed?: number;
  windDirection?: number;
  activeZone?: string;
  readings?: [number, number, number];
  showLegend?: boolean;
  showWind?: boolean;
  problem?: boolean;
  compact?: boolean;
};

export function DustMap({
  className = '', intensity = 68, windSpeed = 4.2, windDirection = 315,
  activeZone = 'Zone C', readings = [28, 18, 82], showLegend = true,
  showWind = true, problem = false,
}: MapVisualProps) {
  const plumeWidth = 0.58 + intensity / 420 + windSpeed / 16;
  const plumeAngle = windDirection - 315;
  return (
    <div className={`dust-map ${problem ? 'problem-map' : ''} ${className}`} aria-label="Illustrative construction site dust map">
      <div className="map-photo" />
      <div className="map-vignette" />
      <svg className="map-overlay" viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="plumeGrad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#05d5ff" stopOpacity=".12" />
            <stop offset=".23" stopColor="#00d8f4" stopOpacity=".86" />
            <stop offset=".47" stopColor="#22edb0" stopOpacity=".89" />
            <stop offset=".67" stopColor="#e4ef27" stopOpacity=".92" />
            <stop offset=".84" stopColor="#ff9e18" stopOpacity=".94" />
            <stop offset="1" stopColor="#fa482f" stopOpacity=".96" />
          </linearGradient>
          <filter id="plumeBlur" x="-40%" y="-100%" width="180%" height="300%"><feGaussianBlur stdDeviation="18" /></filter>
          <filter id="plumeSoft" x="-40%" y="-100%" width="180%" height="300%"><feGaussianBlur stdDeviation="7" /></filter>
          <linearGradient id="boundaryGlow" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#16ecff" /><stop offset="1" stopColor="#09aaca" /></linearGradient>
        </defs>
        <path d="M210 135 L343 49 L635 60 L781 132 L824 298 L721 427 L446 442 L224 352 L152 244 Z" fill="rgba(0,14,26,.12)" stroke="url(#boundaryGlow)" strokeWidth="3" strokeDasharray="1 0" />
        <path d="M210 135 L343 49 L635 60 L781 132 L824 298 L721 427 L446 442 L224 352 L152 244 Z" fill="none" stroke="#0ce9ff" strokeWidth="10" opacity=".18" filter="url(#plumeSoft)" />
        <g transform={`translate(570 244) rotate(${plumeAngle}) scale(${plumeWidth} 1)`}>
          <path d="M-115 -8 C-60 -54 3 -64 56 -39 C105 -14 147 -28 190 -10 C244 12 281 25 317 12 C280 49 233 58 193 43 C146 25 100 59 54 49 C6 38 -58 59 -115 -8Z" fill="url(#plumeGrad)" opacity=".45" filter="url(#plumeBlur)" />
          <path d="M-104 0 C-56 -38 -5 -45 42 -27 C90 -8 132 -24 174 -7 C217 10 259 21 301 8 C267 37 224 44 183 31 C139 17 99 44 49 35 C6 27 -48 46 -104 0Z" fill="url(#plumeGrad)" opacity=".84" filter="url(#plumeSoft)" />
          <path d="M-90 1 C-49 -22 -8 -26 30 -17 C74 -6 112 -17 153 -4 C196 9 232 14 276 7 C240 26 202 29 164 20 C125 11 88 30 47 24 C8 17 -38 29 -90 1Z" fill="url(#plumeGrad)" opacity=".48" />
        </g>
        <g stroke="#15dcff" strokeWidth="1.4" opacity=".7" fill="none">
          <path d="M78 312 C148 277 190 267 240 264" strokeDasharray="5 7" />
          <path d="M88 343 C152 316 187 305 225 298" strokeDasharray="5 7" />
          <path d="M125 373 C168 352 204 338 243 334" strokeDasharray="5 7" />
          <path d="M745 86 C790 102 821 113 863 137" strokeDasharray="4 7" />
        </g>
        <g fill="#061927" stroke="#13e2ff" strokeWidth="2">
          <circle cx="278" cy="174" r="8" /><circle cx="664" cy="87" r="8" /><circle cx="733" cy="385" r="8" /><circle cx="348" cy="397" r="8" />
        </g>
        <g fill="#27f95e" stroke="#deffe7" strokeWidth="1"><circle cx="278" cy="174" r="4" /><circle cx="664" cy="87" r="4" /><circle cx="733" cy="385" r="4" /></g>
        <g transform="translate(574 243)">
          <path d="M0 32 L0 -4 M0 -4 L-9 12 M0 -4 L9 12" stroke="#e8fbff" strokeWidth="3" strokeLinecap="round" />
          <path d="M0 -2 L-15 -30 L15 -30Z" fill="#15dcff" opacity=".74" />
          <path d="M0 -1 L-28 -35 L28 -35Z" fill="#13d8ff" opacity=".17" />
          <rect x="-9" y="26" width="18" height="40" rx="3" fill="#0a3042" stroke="#13dcff" strokeWidth="2" />
          <circle cx="0" cy="36" r="3" fill="#38f4ff" />
        </g>
      </svg>
      <div className="map-stamp north-stamp"><span>N</span><Compass size={21} /></div>
      {showWind && <div className="wind-card"><Wind size={23} /><div><small>Wind Direction</small><b>{windDirection === 315 ? 'NW' : windDirection === 90 ? 'E' : windDirection === 0 ? 'N' : `${windDirection}°`} ({windDirection}°)</b><small>Wind Speed</small><b>{windSpeed.toFixed(1)} m/s</b></div></div>}
      <div className="sensor-label sensor-a"><span className="sensor-dot green" />PM2.5<br /><strong>{readings[0]} μg/m³</strong></div>
      <div className="sensor-label sensor-b"><span className="sensor-dot green" />PM2.5<br /><strong>{readings[1]} μg/m³</strong></div>
      <div className="sensor-label sensor-c hot"><span className="sensor-dot red" />PM2.5<br /><strong>{readings[2]} μg/m³</strong></div>
      <div className="zone-label"><span className="zone-icon"><Droplets size={16} /></span><span>Misting {activeZone}<b>ACTIVE</b></span></div>
      <div className="map-zone standby zone-a">Zone A<br /><b>STANDBY</b></div>
      <div className="map-zone standby zone-b">Zone B<br /><b>STANDBY</b></div>
      {showLegend && <div className="map-legend"><small>Predicted Dust Concentration (μg/m³)</small><div className="legend-gradient" /><div className="legend-ticks"><span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100+</span></div><div className="legend-keys"><span><i className="key-square" /> Site Boundary</span><span><i className="key-mist" /> Misting Zone (Active)</span></div></div>}
      {problem && <div className="escape-alert"><ArrowDownRight size={17} />Dust plume beyond<br />site boundary</div>}
      <div className="map-live"><Activity size={15} /> LIVE DIGITAL TWIN</div>
    </div>
  );
}

export function WindIndicator({ direction = 315, speed = 4.2 }: { direction?: number; speed?: number }) {
  const style = { '--wind-angle': `${direction}deg` } as CSSProperties;
  return <div className="wind-indicator" style={style}><Wind size={25} /><span>{direction === 315 ? 'NW' : direction === 90 ? 'E' : direction === 0 ? 'N' : `${direction}°`} ({direction}°)</span><small>{speed.toFixed(1)} m/s</small></div>;
}

export function GlowingIcon({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`glowing-icon ${className}`}>{children}</span>;
}
