import type { CSSProperties } from 'react';
import './simulationMap.css';
import { directionLabel } from './simulationEngine';
import type { BoundaryId, PollutantView, SimulationInput, SimulationPrediction, ZoneId } from './simulationTypes';

const boundaryOrder: BoundaryId[] = ['north', 'east', 'south', 'west'];
const zoneForBoundary: Record<BoundaryId, ZoneId> = { north: 'A', east: 'B', south: 'C', west: 'D' };

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
  const titleId = `map-zone-${reading.zoneId}`;
  const descriptionId = `map-sensor-${reading.id}-description`;
  const description = `${reading.sensorName}, ${reading.label} boundary. Simulated estimates. Current risk: ${reading.status}. Forecast risk: ${reading.forecastStatus}.`;

  return (
    <div
      className={`sim-sensor-card sensor-${reading.id} risk-${reading.status.toLowerCase().replace(' ', '-')} ${activeZone ? 'is-active' : ''}`}
      data-testid={`sensor-${reading.id}`}
      role="group"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      title={description}
    >
      <span className="sim-zone-sensor-marker" aria-hidden="true" />
      <div className="sim-sensor-heading">
        <i className="sim-sensor-status-dot" aria-hidden="true" />
        <div className="sim-sensor-identity">
          <strong className="sim-sensor-name" id={titleId} data-testid={`zone-${reading.zoneId}`}>Zone {reading.zoneId}</strong>
          <span className={`sim-sensor-zone-state ${activeZone ? 'is-active' : ''}`}>{activeZone ? 'ACTIVE' : 'STANDBY'}</span>
        </div>
      </div>
      <div className="sim-sensor-readings">
        <span className={`sim-sensor-metric ${view === 'pm25' ? 'is-selected' : ''}`}>
          <small className="metric-tag">PM2.5</small>
          <span className="metric-number"><b className="metric-val">{reading.pm25}</b><span className="metric-unit">µg/m³</span></span>
        </span>
        <span className={`sim-sensor-metric ${view === 'pm10' ? 'is-selected' : ''}`}>
          <small className="metric-tag">PM10</small>
          <span className="metric-number"><b className="metric-val">{reading.pm10}</b><span className="metric-unit">µg/m³</span></span>
        </span>
      </div>
      <small className="sim-sensor-description" id={descriptionId}>{description}</small>
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
  const plumeOpacity = Math.min(0.92, 0.24 + prediction.plume.density * 0.9) * (activeZones.size ? 0.82 : 1);
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
      </div>

      <svg className={`sim-map-overlay sim-map-overlay-${view}`} viewBox="0 0 1000 600" preserveAspectRatio="none" role="img" aria-label={`Construction site map. Dust source ${input.dustIntensity} percent; modeled wind ${input.windSpeed.toFixed(1)} meters per second toward ${directionLabel(input.windDirection)}. Predicted escape boundary: ${predictedBoundaryText}. Risk: ${prediction.risk}. Lead time: ${formatLeadTime(prediction.leadTimeSeconds)}.`}>
        <defs>
          {/* Industrial digital twin concentration heatmap: Very High (red) -> High (orange) -> Med (yellow) -> Low (cyan/blue) */}
          <linearGradient id="site-plume-heat" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#ff2218" stopOpacity=".98" />
            <stop offset=".14" stopColor="#ff5a1e" stopOpacity=".95" />
            <stop offset=".3" stopColor="#ff8c26" stopOpacity=".9" />
            <stop offset=".48" stopColor="#ffd836" stopOpacity=".84" />
            <stop offset=".68" stopColor="#3de4df" stopOpacity=".65" />
            <stop offset=".86" stopColor="#1eb4e8" stopOpacity=".3" />
            <stop offset="1" stopColor="#1ec4ed" stopOpacity=".02" />
          </linearGradient>
          <linearGradient id="site-plume-spine" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#ff2818" stopOpacity=".96" />
            <stop offset=".18" stopColor="#ff6524" stopOpacity=".96" />
            <stop offset=".42" stopColor="#ffd234" stopOpacity=".9" />
            <stop offset=".68" stopColor="#3fe2e4" stopOpacity=".7" />
            <stop offset=".88" stopColor="#1fb0e2" stopOpacity=".32" />
            <stop offset="1" stopColor="#18ceea" stopOpacity=".03" />
          </linearGradient>
          <radialGradient id="site-plume-core" cx="30%" cy="50%" r="78%" fx="20%" fy="50%">
            <stop offset="0" stopColor="#ff1f18" stopOpacity="1" />
            <stop offset=".22" stopColor="#ff501e" stopOpacity=".98" />
            <stop offset=".46" stopColor="#ff8f24" stopOpacity=".88" />
            <stop offset=".67" stopColor="#ffd43c" stopOpacity=".68" />
            <stop offset=".85" stopColor="#58e0e2" stopOpacity=".32" />
            <stop offset="1" stopColor="#3ee0f0" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="site-dust-source">
            <stop offset="0" stopColor="#fff8c8" />
            <stop offset=".3" stopColor="#ffc048" />
            <stop offset=".62" stopColor="#ff502e" stopOpacity=".9" />
            <stop offset="1" stopColor="#ff452c" stopOpacity="0" />
          </radialGradient>
          <filter id="site-plume-soft" x="-35%" y="-80%" width="180%" height="260%"><feGaussianBlur stdDeviation="11" /></filter>
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
          <ellipse className="plume-color-body" cx={plumeLength * 0.48} cy="0" rx={plumeLength * 0.62} ry={plumeSpread * 0.75} fill="url(#site-plume-heat)" />
          <ellipse className="plume-core" cx={plumeLength * 0.36} cy="0" rx={plumeLength * 0.38} ry={plumeSpread * 0.46} fill="url(#site-plume-core)" />
          <path d={`M0 0 C${plumeLength * .16} ${-plumeSpread * .68}, ${plumeLength * .39} ${-plumeSpread * 1.02}, ${plumeLength * .68} ${-plumeSpread * .78} C${plumeLength * .9} ${-plumeSpread * .6}, ${plumeLength * 1.08} ${-plumeSpread * .19}, ${plumeLength * 1.08} ${plumeSpread * .02} C${plumeLength * 1.02} ${plumeSpread * .31}, ${plumeLength * .83} ${plumeSpread * .71}, ${plumeLength * .58} ${plumeSpread * .86} C${plumeLength * .34} ${plumeSpread * .94}, ${plumeLength * .14} ${plumeSpread * .49}, 0 0 Z`} className="plume-ribbon" />
          <path d={`M0 0 C${plumeLength * .22} ${-plumeSpread * .15}, ${plumeLength * .48} ${plumeSpread * .13}, ${plumeLength * .7} 0 S${plumeLength * .88} ${plumeSpread * .06}, ${plumeLength} 0`} className="plume-heat-spine" fill="none" stroke="url(#site-plume-spine)" strokeWidth={plumeSpread * 0.64} strokeLinecap="round" />
        </g>

        <g className={`zone-mist zone-mist-A ${activeZones.has('A') ? 'is-active' : ''}`}>
          <path className="zone-mist-glow" d="M380 135 Q420 194 455 232 M540 130 Q560 190 566 230" />
          <path className="zone-mist-flow" d="M380 135 Q420 194 455 232 M540 130 Q560 190 566 230" />
          <path className="zone-mist-spray" d="M375 137 Q415 198 448 238 M385 133 Q425 190 462 226 M535 132 Q555 192 560 234 M545 128 Q565 188 572 226" />
          <circle className="zone-mist-emitter" cx="380" cy="135" r="4.5" /><circle className="zone-mist-emitter" cx="540" cy="130" r="4.5" />
          <circle className="zone-mist-particle" cx="405" cy="172" r="2.2" /><circle className="zone-mist-particle" cx="430" cy="204" r="1.8" />
          <circle className="zone-mist-particle" cx="547" cy="169" r="2.2" /><circle className="zone-mist-particle" cx="560" cy="203" r="1.6" />
          <circle className="zone-mist-particle" cx="445" cy="222" r="1.5" /><circle className="zone-mist-particle" cx="565" cy="225" r="1.5" />
        </g>
        <g className={`zone-mist zone-mist-B ${activeZones.has('B') ? 'is-active' : ''}`}>
          <path className="zone-mist-glow" d="M860 236 Q800 254 760 281 M875 365 Q815 355 770 333" />
          <path className="zone-mist-flow" d="M860 236 Q800 254 760 281 M875 365 Q815 355 770 333" />
          <path className="zone-mist-spray" d="M858 230 Q796 250 754 275 M862 242 Q804 258 766 287 M872 360 Q811 350 765 327 M878 370 Q819 360 775 339" />
          <circle className="zone-mist-emitter" cx="860" cy="236" r="4.5" /><circle className="zone-mist-emitter" cx="875" cy="365" r="4.5" />
          <circle className="zone-mist-particle" cx="826" cy="251" r="2.2" /><circle className="zone-mist-particle" cx="790" cy="269" r="1.8" />
          <circle className="zone-mist-particle" cx="835" cy="359" r="2.2" /><circle className="zone-mist-particle" cx="800" cy="344" r="1.6" />
          <circle className="zone-mist-particle" cx="768" cy="285" r="1.5" /><circle className="zone-mist-particle" cx="778" cy="336" r="1.5" />
        </g>
        <g className={`zone-mist zone-mist-C ${activeZones.has('C') ? 'is-active' : ''}`}>
          <path className="zone-mist-glow" d="M395 477 Q430 415 466 393 M570 481 Q560 425 555 395" />
          <path className="zone-mist-flow" d="M395 477 Q430 415 466 393 M570 481 Q560 425 555 395" />
          <path className="zone-mist-spray" d="M390 475 Q426 411 460 388 M400 479 Q434 419 472 398 M565 483 Q555 423 550 392 M575 479 Q565 427 560 398" />
          <circle className="zone-mist-emitter" cx="395" cy="477" r="4.5" /><circle className="zone-mist-emitter" cx="570" cy="481" r="4.5" />
          <circle className="zone-mist-particle" cx="418" cy="438" r="2.2" /><circle className="zone-mist-particle" cx="443" cy="411" r="1.8" />
          <circle className="zone-mist-particle" cx="563" cy="446" r="2.2" /><circle className="zone-mist-particle" cx="558" cy="416" r="1.6" />
          <circle className="zone-mist-particle" cx="460" cy="397" r="1.5" /><circle className="zone-mist-particle" cx="555" cy="402" r="1.5" />
        </g>
        <g className={`zone-mist zone-mist-D ${activeZones.has('D') ? 'is-active' : ''}`}>
          <path className="zone-mist-glow" d="M184 235 Q250 248 278 278 M181 365 Q250 350 276 326" />
          <path className="zone-mist-flow" d="M184 235 Q250 248 278 278 M181 365 Q250 350 276 326" />
          <path className="zone-mist-spray" d="M182 230 Q246 242 272 270 M186 240 Q254 254 284 286 M179 370 Q246 356 270 332 M183 360 Q254 344 282 320" />
          <circle className="zone-mist-emitter" cx="184" cy="235" r="4.5" /><circle className="zone-mist-emitter" cx="181" cy="365" r="4.5" />
          <circle className="zone-mist-particle" cx="225" cy="244" r="2.2" /><circle className="zone-mist-particle" cx="254" cy="260" r="1.8" />
          <circle className="zone-mist-particle" cx="226" cy="354" r="2.2" /><circle className="zone-mist-particle" cx="254" cy="340" r="1.6" />
          <circle className="zone-mist-particle" cx="272" cy="275" r="1.5" /><circle className="zone-mist-particle" cx="270" cy="328" r="1.5" />
        </g>

        <line className="sim-wind-vector" x1={sourceX} y1={sourceY} x2={plumeEndX} y2={plumeEndY} markerEnd="url(#site-wind-arrow)" />
        <g className="sim-source-mark" transform={`translate(${sourceX} ${sourceY})`}>
          <circle className="source-halo" r="31" fill="url(#site-dust-source)" />
          <circle className="source-core" r="10" />
        </g>
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

      <div className="map-source-label">
        <i className="source-label-dot" aria-hidden="true" />
        <span>Dust Source<b>{input.dustIntensity}%</b></span>
      </div>

      {boundaryOrder.map((boundary) => {
        const reading = prediction.sensors.find((sensor) => sensor.id === boundary);
        if (!reading) return null;
        return <SensorCard key={reading.id} reading={reading} view={view} activeZone={activeZones.has(zoneForBoundary[reading.id])} />;
      })}

      <div className="map-compass" aria-label={`Wind bearing ${directionLabel(input.windDirection)}`}>
        <span className="compass-n">N</span><span className="compass-e">E</span><span className="compass-s">S</span><span className="compass-w">W</span><i style={{ '--compass': `${input.windDirection}deg` } as CSSProperties}>➤</i>
      </div>

      <div className="sim-map-legend" aria-label="Map legend for simulated estimates">
        <div className="sim-map-legend-keys">
          <span><i className="legend-boundary" aria-hidden="true" />Site Boundary</span>
          <span><i className="legend-source" aria-hidden="true" />Dust Source</span>
          <span><i className="legend-active" aria-hidden="true" />Active Zone (Misting)</span>
          <span><i className="legend-standby" aria-hidden="true" />Standby Zone</span>
        </div>
      </div>
    </div>
  );
}
