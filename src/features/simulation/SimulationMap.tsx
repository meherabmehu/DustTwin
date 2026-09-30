import type { CSSProperties } from 'react';
import { Activity, CloudFog, TriangleAlert, Wind } from 'lucide-react';
import './simulationMap.css';
import { directionLabel } from './simulationEngine';
import type { BoundaryId, PollutantView, SimulationInput, SimulationPrediction, ZoneId } from './simulationTypes';

const boundaryOrder: BoundaryId[] = ['north', 'east', 'south', 'west'];
const sensorLetters: Record<BoundaryId, string> = { north: 'N', east: 'E', south: 'S', west: 'W' };
const zoneForBoundary: Record<BoundaryId, ZoneId> = { north: 'A', east: 'B', south: 'C', west: 'D' };
const zones: Array<{ id: ZoneId; label: string; boundary: string; tagClass: string }> = [
  { id: 'A', label: 'North', boundary: 'north', tagClass: 'zone-a' },
  { id: 'B', label: 'East', boundary: 'east', tagClass: 'zone-b' },
  { id: 'C', label: 'South', boundary: 'south', tagClass: 'zone-c' },
  { id: 'D', label: 'West', boundary: 'west', tagClass: 'zone-d' },
];

function formatLeadTime(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds} s`;
  return `${(seconds / 60).toFixed(1)} min`;
}

function SensorCard({ reading, view, activeZone }: {
  reading: SimulationPrediction['sensors'][number];
  view: PollutantView;
  activeZone: boolean;
}) {
  return (
    <div className={`sim-sensor-card sensor-${reading.id} risk-${reading.status.toLowerCase().replace(' ', '-')}`} data-testid={`sensor-${reading.id}`}>
      <div className="sim-sensor-heading">
        <i className={`sim-sensor-status-dot risk-${reading.status.toLowerCase().replace(' ', '-')}`} />
        <div><strong>{reading.sensorName}</strong><small>{reading.label} Boundary · Zone {reading.zoneId}</small></div>
        <span className={`sim-sensor-zone-state ${activeZone ? 'is-active' : ''}`}>{activeZone ? 'ACTIVE' : 'STANDBY'}</span>
      </div>
      <div className="sim-sensor-readings">
        <span className={view === 'pm25' ? 'is-selected' : ''}>PM2.5 <b>{reading.pm25}</b><small>µg/m³</small></span>
        <span className={view === 'pm10' ? 'is-selected' : ''}>PM10 <b>{reading.pm10}</b><small>µg/m³</small></span>
      </div>
      {reading.forecastStatus !== reading.status && <small className="sim-sensor-forecast">Forecast {reading.forecastStatus}</small>}
    </div>
  );
}

export default function SimulationMap({ prediction, input, view, onViewChange }: {
  prediction: SimulationPrediction;
  input: SimulationInput;
  view: PollutantView;
  onViewChange: (view: PollutantView) => void;
}) {
  const activeZones = new Set(prediction.activeZoneIds);
  const bearingRadians = (prediction.plume.bearingDeg * Math.PI) / 180;
  const sourceX = 510;
  const sourceY = 306;
  const plumeEndX = sourceX + Math.sin(bearingRadians) * Math.min(prediction.plume.length, 330);
  const plumeEndY = sourceY - Math.cos(bearingRadians) * Math.min(prediction.plume.length, 275);
  const plumeRotation = prediction.plume.bearingDeg - 90;
  const plumeOpacity = Math.min(0.92, 0.24 + prediction.plume.density * 0.66) * (activeZones.size ? 0.82 : 1);
  const plumeWidthPercent = 13 + (prediction.plume.length / 300) * 14;
  const plumeHeightPercent = 14 + prediction.plume.spread * 0.65;
  const plumeLength = Math.min(prediction.plume.length * 0.88, 275);
  const plumeSpread = prediction.plume.spread * 4.2;
  const predictedBoundaryText = prediction.predictedEscapeBoundary;

  return (
    <div className={`simulation-site-map view-${view}`} data-testid="simulation-site-map">
      <img className="simulation-site-photo" src="/simulation-site.jpg" alt="" aria-hidden="true" />
      <div className="simulation-site-tint" aria-hidden="true" />

      <div className="sim-map-toolbar">
        <div className="sim-map-view-switch" role="group" aria-label="Map pollutant view">
          {([
            ['combined', 'Combined'],
            ['pm25', 'PM2.5'],
            ['pm10', 'PM10'],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={view === value} className={view === value ? 'is-selected' : ''} onClick={() => onViewChange(value)}>{label}</button>
          ))}
        </div>
        <div className="dust-concentration-scale" aria-label="Dust concentration gradient, low to high">
          <small>Dust Concentration (µg/m³)</small>
          <div className="concentration-gradient" />
          <span><i>Low</i><i>High</i></span>
        </div>
        <div className="prediction-hud" aria-label="Predicted escape boundary and lead time">
          <div className="prediction-hud-heading"><TriangleAlert aria-hidden="true" /><span>Predicted Escape Boundary</span></div>
          <strong>{predictedBoundaryText}</strong>
          <div className="prediction-hud-metrics">
            <span>Risk Level<b className={`risk-text risk-${prediction.risk.toLowerCase().replace(' ', '-')}`}>{prediction.risk}</b></span>
            <span>Lead Time<b>{formatLeadTime(prediction.leadTimeSeconds)}</b></span>
          </div>
        </div>
      </div>

      <svg className={`sim-map-overlay sim-map-overlay-${view}`} viewBox="0 0 1000 600" preserveAspectRatio="none" role="img" aria-label={`Construction site map. Dust source ${input.dustIntensity} percent; modeled wind toward ${directionLabel(input.windDirection)}.`}>
        <defs>
          <linearGradient id="site-plume-heat" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#ff5338" stopOpacity=".94" />
            <stop offset=".22" stopColor="#ff812e" stopOpacity=".84" />
            <stop offset=".48" stopColor="#ffe14c" stopOpacity=".7" />
            <stop offset=".76" stopColor="#48e6dc" stopOpacity=".52" />
            <stop offset="1" stopColor="#21c9ed" stopOpacity=".03" />
          </linearGradient>
          <linearGradient id="site-plume-spine" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fb3c35" stopOpacity=".88" />
            <stop offset=".24" stopColor="#ff6e28" stopOpacity=".92" />
            <stop offset=".53" stopColor="#ffd33d" stopOpacity=".83" />
            <stop offset=".82" stopColor="#54e5dc" stopOpacity=".52" />
            <stop offset="1" stopColor="#1ccbe9" stopOpacity=".06" />
          </linearGradient>
          <radialGradient id="site-plume-core">
            <stop offset="0" stopColor="#f92832" stopOpacity="1" />
            <stop offset=".28" stopColor="#ff5928" stopOpacity=".96" />
            <stop offset=".55" stopColor="#ffad30" stopOpacity=".84" />
            <stop offset=".78" stopColor="#ffe55b" stopOpacity=".48" />
            <stop offset="1" stopColor="#45dbeb" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="site-dust-source">
            <stop offset="0" stopColor="#fff5b8" />
            <stop offset=".32" stopColor="#ffba48" />
            <stop offset=".62" stopColor="#ff583b" stopOpacity=".85" />
            <stop offset="1" stopColor="#ff5139" stopOpacity="0" />
          </radialGradient>
          <filter id="site-plume-soft" x="-35%" y="-80%" width="180%" height="260%"><feGaussianBlur stdDeviation="14" /></filter>
          <filter id="site-glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <marker id="site-wind-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
            <path d="M0,0 L9,4.5 L0,9 Z" fill="#dffbff" />
          </marker>
        </defs>

        <path className="site-boundary-halo" d="M125 122 L844 93 L924 473 L154 525 Z" />
        <path className="site-boundary-line" d="M125 122 L844 93 L924 473 L154 525 Z" />
        <path className="site-inner-boundary" d="M230 174 L755 151 L788 405 L219 435 Z" />

        <polygon points="130,123 837,96 758,164 228,183" className={`zone-shape zone-A ${activeZones.has('A') ? 'is-active' : ''}`} />
        <polygon points="837,96 918,470 784,408 758,164" className={`zone-shape zone-B ${activeZones.has('B') ? 'is-active' : ''}`} />
        <polygon points="918,470 157,520 222,433 784,408" className={`zone-shape zone-C ${activeZones.has('C') ? 'is-active' : ''}`} />
        <polygon points="157,520 130,123 228,183 222,433" className={`zone-shape zone-D ${activeZones.has('D') ? 'is-active' : ''}`} />

        <g className={`sim-plume-layer ${activeZones.size ? 'is-suppressed' : ''}`} transform={`translate(${sourceX} ${sourceY}) rotate(${plumeRotation})`} style={{ opacity: plumeOpacity }}>
          <ellipse className="plume-soft-outer" cx={plumeLength * 0.48} cy="0" rx={plumeLength * 0.72} ry={plumeSpread * 1.3} fill="url(#site-plume-heat)" filter="url(#site-plume-soft)" />
          <ellipse className="plume-color-body" cx={plumeLength * 0.48} cy="0" rx={plumeLength * 0.62} ry={plumeSpread * 0.85} fill="url(#site-plume-heat)" />
          <ellipse className="plume-core" cx={plumeLength * 0.43} cy="0" rx={plumeLength * 0.38} ry={plumeSpread * 0.58} fill="url(#site-plume-core)" />
          <path d={`M0 0 C${plumeLength * .22} ${-plumeSpread * 1.08}, ${plumeLength * .48} ${-plumeSpread * 1.15}, ${plumeLength * .76} ${-plumeSpread * .18} C${plumeLength} ${plumeSpread * .42}, ${plumeLength * .68} ${plumeSpread * 1.15}, ${plumeLength * .42} ${plumeSpread * .82} C${plumeLength * .2} ${plumeSpread * .62}, ${plumeLength * .12} ${plumeSpread * .36}, 0 0 Z`} className="plume-ribbon" />
          <path d={`M0 0 C${plumeLength * .22} ${-plumeSpread * .15}, ${plumeLength * .48} ${plumeSpread * .13}, ${plumeLength * .7} 0 S${plumeLength * .88} ${plumeSpread * .06}, ${plumeLength} 0`} className="plume-heat-spine" fill="none" stroke="url(#site-plume-spine)" strokeWidth={plumeSpread * 0.78} strokeLinecap="round" />
        </g>

        <g className={`zone-mist zone-mist-A ${activeZones.has('A') ? 'is-active' : ''}`}><path d="M380 135 Q420 194 455 232 M540 130 Q560 190 566 230" /><circle cx="380" cy="135" r="4" /><circle cx="540" cy="130" r="4" /></g>
        <g className={`zone-mist zone-mist-B ${activeZones.has('B') ? 'is-active' : ''}`}><path d="M860 236 Q800 254 760 281 M875 365 Q815 355 770 333" /><circle cx="860" cy="236" r="4" /><circle cx="875" cy="365" r="4" /></g>
        <g className={`zone-mist zone-mist-C ${activeZones.has('C') ? 'is-active' : ''}`}><path d="M395 477 Q430 415 466 393 M570 481 Q560 425 555 395" /><circle cx="395" cy="477" r="4" /><circle cx="570" cy="481" r="4" /></g>
        <g className={`zone-mist zone-mist-D ${activeZones.has('D') ? 'is-active' : ''}`}><path d="M184 235 Q250 248 278 278 M181 365 Q250 350 276 326" /><circle cx="184" cy="235" r="4" /><circle cx="181" cy="365" r="4" /></g>

        <line className="sim-wind-vector" x1={sourceX} y1={sourceY} x2={plumeEndX} y2={plumeEndY} markerEnd="url(#site-wind-arrow)" />
        <g className="sim-source-mark" transform={`translate(${sourceX} ${sourceY})`}>
          <circle className="source-halo" r="31" fill="url(#site-dust-source)" />
          <circle className="source-core" r="10" />
          <path d="M-5 3 L0 -7 L5 3 M-8 8 H8" fill="none" stroke="#643a22" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {boundaryOrder.map((boundary) => {
          const reading = prediction.sensors.find((sensor) => sensor.id === boundary);
          if (!reading) return null;
          const point = boundary === 'north' ? [515, 109] : boundary === 'east' ? [879, 294] : boundary === 'south' ? [552, 495] : [175, 321];
          return (
            <g className={`map-sensor-pin risk-${reading.status.toLowerCase().replace(' ', '-')}`} transform={`translate(${point[0]} ${point[1]})`} key={boundary}>
              <circle className="sensor-pin-ring" r="13" />
              <circle className="sensor-pin-core" r="6" />
              <text x="0" y="-19">{sensorLetters[boundary]}</text>
            </g>
          );
        })}
      </svg>

      <div
        className={`dynamic-plume pollutant-${view} ${activeZones.size ? 'has-suppression' : ''}`}
        style={{
          left: `${sourceX / 10}%`,
          top: `${sourceY / 6}%`,
          width: `${plumeWidthPercent}%`,
          height: `${plumeHeightPercent}%`,
          opacity: plumeOpacity,
          transform: `translateY(-50%) rotate(${plumeRotation}deg)`,
        }}
        aria-hidden="true"
      />

      <div className="map-wind-card">
        <Wind aria-hidden="true" />
        <div><small>Wind</small><strong>{directionLabel(input.windDirection)} ({input.windDirection}°)</strong><span>{input.windSpeed.toFixed(1)} m/s</span></div>
      </div>

      <div className="map-source-label"><CloudFog aria-hidden="true" /><span>Dust Source<b>{input.dustIntensity}%</b></span></div>

      <div className="sim-zone-labels" aria-label="Misting zone status">
        {zones.map((zone) => {
          const active = activeZones.has(zone.id);
          return (
            <div className={`map-zone-tag ${zone.tagClass} ${active ? 'is-active' : ''}`} key={zone.id} data-testid={`zone-${zone.id}`}>
              <strong>Zone {zone.id}</strong><span>({zone.label})</span><b>{active ? 'ACTIVE' : 'STANDBY'}</b>
            </div>
          );
        })}
      </div>

      {boundaryOrder.map((boundary) => {
        const reading = prediction.sensors.find((sensor) => sensor.id === boundary);
        if (!reading) return null;
        return <SensorCard key={reading.id} reading={reading} view={view} activeZone={activeZones.has(zoneForBoundary[reading.id])} />;
      })}

      <div className="map-compass" aria-label={`Wind bearing ${directionLabel(input.windDirection)}`}>
        <span className="compass-n">N</span><span className="compass-e">E</span><span className="compass-s">S</span><span className="compass-w">W</span><i style={{ '--compass': `${input.windDirection}deg` } as CSSProperties}>➤</i>
      </div>

      <div className="sim-map-legend" aria-label="Map legend">
        <span><i className="legend-boundary" />Site Boundary</span>
        <span><i className="legend-source" />Dust Source</span>
        <span><i className={`legend-plume pollutant-${view}`} />Dust Plume</span>
        <span><i className="legend-sensor" />PM Sensor</span>
        <span><i className="legend-active" />Misting Zone (Active)</span>
        <span><i className="legend-standby" />Misting Zone (Standby)</span>
        <span><Activity aria-hidden="true" />Estimates only</span>
      </div>

    </div>
  );
}
