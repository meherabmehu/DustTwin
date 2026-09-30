import { Activity, CloudFog, Droplets, Wind } from 'lucide-react';
import './simulationMap.css';
import { directionLabel } from './simulationEngine';
import type { BoundaryId, PollutantView, SimulationInput, SimulationPrediction, ZoneId } from './simulationTypes';

const sensorPositions: Record<BoundaryId, string> = {
  north: 'north',
  east: 'east',
  south: 'south',
  west: 'west',
};

const sensorLetters: Record<BoundaryId, string> = {
  north: 'N',
  east: 'E',
  south: 'S',
  west: 'W',
};

const zoneForBoundary: Record<BoundaryId, ZoneId> = {
  north: 'A',
  east: 'B',
  south: 'C',
  west: 'D',
};

const zoneLabels: Record<ZoneId, string> = {
  A: 'North',
  B: 'East',
  C: 'South',
  D: 'West',
};

function sensorValue(reading: SimulationPrediction['sensors'][number], view: PollutantView) {
  if (view === 'pm10') return reading.pm10;
  return reading.pm25;
}

function SensorCard({ reading, view, activeZone }: {
  reading: SimulationPrediction['sensors'][number];
  view: PollutantView;
  activeZone: boolean;
}) {
  const currentMain = sensorValue(reading, view);
  const mainPollutant = view === 'pm10' ? 'PM10' : 'PM2.5';
  return (
    <div className={`sim-sensor-card sensor-${sensorPositions[reading.id]} ${view === 'combined' ? 'view-combined' : `view-${view}`} risk-${reading.status.toLowerCase().replace(' ', '-')}`} data-testid={`sensor-${reading.id}`}>
      <div className="sim-sensor-heading">
        <span className="sim-sensor-mark">{sensorLetters[reading.id]}</span>
        <div><strong>{reading.sensorName}</strong><small>{reading.label} Boundary · Zone {reading.zoneId}</small></div>
      </div>
      <div className="sim-sensor-main-reading"><b>{currentMain}</b><span>µg/m³ {mainPollutant}</span></div>
      <div className="sim-sensor-secondary-readings">
        <span className={view === 'pm25' ? 'is-selected' : ''}>PM2.5 <b>{reading.pm25}</b></span>
        <span className={view === 'pm10' ? 'is-selected' : ''}>PM10 <b>{reading.pm10}</b></span>
      </div>
      <div className="sim-sensor-status-row">
        <span className={`sim-risk-badge risk-${reading.status.toLowerCase().replace(' ', '-')}`}>{reading.status}</span>
        <span className={`sim-sensor-zone-state ${activeZone ? 'is-active' : ''}`}>{activeZone ? 'MISTING' : 'STANDBY'}</span>
      </div>
      {reading.forecastStatus !== reading.status && <small className="sim-sensor-forecast">Forecast: {reading.forecastStatus}</small>}
    </div>
  );
}

function ZoneTag({ zone, active }: { zone: ZoneId; active: boolean }) {
  const boundary = zoneLabels[zone];
  return <span className={`map-zone-tag zone-${zone.toLowerCase()} ${active ? 'is-active' : ''}`} data-testid={`zone-${zone}`}><b>{zone}</b><span>{boundary}</span><strong>{active ? 'ACTIVE' : 'STANDBY'}</strong></span>;
}

export default function SimulationMap({
  prediction,
  input,
  view,
  onViewChange,
}: {
  prediction: SimulationPrediction;
  input: SimulationInput;
  view: PollutantView;
  onViewChange: (view: PollutantView) => void;
}) {
  const activeZones = new Set(prediction.activeZoneIds);
  const bearingRadians = (prediction.plume.bearingDeg * Math.PI) / 180;
  const windVectorX = Math.sin(bearingRadians);
  const windVectorY = -Math.cos(bearingRadians);
  const sourceX = 500;
  const sourceY = 306;
  const downwindEndX = sourceX + windVectorX * Math.min(prediction.plume.length, 235);
  const downwindEndY = sourceY + windVectorY * Math.min(prediction.plume.length, 175);
  const plumeRotation = prediction.plume.bearingDeg - 90;
  const sourcePlumeId = 'simulation-plume-gradient';
  const pm10PlumeId = 'simulation-pm10-gradient';

  return (
    <div className="simulation-site-map" data-testid="simulation-site-map">
      <div className="sim-map-toolbar">
        <div className="sim-map-inputs" aria-label="Current simulation inputs">
          <span><CloudFog aria-hidden="true" />Dust <b>{input.dustIntensity}%</b></span>
          <span><Wind aria-hidden="true" />{input.windSpeed.toFixed(1)} m/s · {directionLabel(input.windDirection)}</span>
          <span>{input.temperatureC}°C</span>
          <span>{input.humidity}% RH</span>
        </div>
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

      <svg className={`sim-scene sim-scene-${view}`} viewBox="0 0 1000 600" role="img" aria-label={`Modeled construction site with four boundary sensors, a ${directionLabel(input.windDirection)} plume, and four misting zones`}>
        <defs>
          <pattern id="simulation-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(111,178,202,.08)" strokeWidth="1" />
          </pattern>
          <linearGradient id={sourcePlumeId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#f1543f" stopOpacity=".76" />
            <stop offset=".32" stopColor="#f3a33a" stopOpacity=".52" />
            <stop offset=".72" stopColor="#f3df5e" stopOpacity=".25" />
            <stop offset="1" stopColor="#31cfe1" stopOpacity=".08" />
          </linearGradient>
          <linearGradient id={pm10PlumeId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fb8b39" stopOpacity=".7" />
            <stop offset=".5" stopColor="#c67bf3" stopOpacity=".35" />
            <stop offset="1" stopColor="#55bfe2" stopOpacity=".08" />
          </linearGradient>
          <radialGradient id="simulation-dust-source">
            <stop offset="0" stopColor="#fff2b3" />
            <stop offset=".55" stopColor="#f4a644" />
            <stop offset="1" stopColor="#f45c4d" stopOpacity=".08" />
          </radialGradient>
          <filter id="simulation-soft-blur" x="-40%" y="-60%" width="180%" height="220%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
          <marker id="simulation-wind-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 Z" fill="#c6f7ff" />
          </marker>
        </defs>

        <rect width="1000" height="600" fill="#061e2c" />
        <rect width="1000" height="600" fill="url(#simulation-grid)" />
        <path d="M85 118 H915 M85 482 H915" stroke="#1b3d4c" strokeWidth="30" opacity=".45" />
        <path d="M110 118 H890 M110 482 H890" stroke="#466371" strokeWidth="1.5" strokeDasharray="12 15" opacity=".54" />
        <path d="M200 100 V500 M800 100 V500" stroke="#163544" strokeWidth="16" opacity=".34" />
        <path d="M200 100 V500 M800 100 V500" stroke="#365766" strokeWidth="1.2" strokeDasharray="9 14" opacity=".5" />

        <g transform={`translate(${sourceX} ${sourceY}) rotate(${plumeRotation})`} className={`sim-plume-layer pollutant-${view}`}>
          <ellipse className="sim-plume-blur" cx={Math.min(prediction.plume.length * 0.46, 145)} cy="0" rx={Math.min(prediction.plume.length * 0.6, 180)} ry={prediction.plume.spread * 2.7} fill={view === 'pm10' ? `url(#${pm10PlumeId})` : `url(#${sourcePlumeId})`} opacity={0.17 + prediction.plume.density * 0.24} filter="url(#simulation-soft-blur)" />
          {view !== 'pm10' && <ellipse cx={Math.min(prediction.plume.length * 0.44, 136)} cy="0" rx={Math.min(prediction.plume.length * 0.55, 172)} ry={prediction.plume.spread * 1.65} fill={`url(#${sourcePlumeId})`} opacity={0.22 + prediction.plume.density * 0.27} />}
          {view !== 'pm25' && <ellipse cx={Math.min(prediction.plume.length * 0.42, 132)} cy="0" rx={Math.min(prediction.plume.length * 0.5, 158)} ry={prediction.plume.spread * 1.15} fill={`url(#${pm10PlumeId})`} opacity={view === 'combined' ? 0.2 : 0.58} />}
        </g>

        <rect x="340" y="195" width="320" height="220" rx="4" fill="#0a2737" stroke="#3e6a7b" strokeWidth="3" />
        <rect x="354" y="209" width="292" height="192" rx="2" fill="#0c2d3e" stroke="#284c5e" strokeWidth="1.4" />
        <path d="M358 250 H642 M358 294 H642 M358 338 H642 M420 213 V397 M500 213 V397 M580 213 V397" stroke="#214858" strokeWidth="1" strokeDasharray="5 5" />
        <path d="M385 225 H615 V380 H385 Z" fill="none" stroke="#286073" strokeWidth="1.2" strokeDasharray="7 6" />
        <text x="500" y="235" textAnchor="middle" className="sim-site-title-svg">CONSTRUCTION SITE</text>
        <text x="500" y="254" textAnchor="middle" className="sim-site-subtitle-svg">SIMULATED DUST SOURCE</text>

        <rect x="340" y="175" width="320" height="20" rx="7" className={`sim-zone-segment zone-A ${activeZones.has('A') ? 'is-active' : ''}`} />
        <rect x="660" y="195" width="22" height="220" rx="7" className={`sim-zone-segment zone-B ${activeZones.has('B') ? 'is-active' : ''}`} />
        <rect x="340" y="415" width="320" height="20" rx="7" className={`sim-zone-segment zone-C ${activeZones.has('C') ? 'is-active' : ''}`} />
        <rect x="318" y="195" width="22" height="220" rx="7" className={`sim-zone-segment zone-D ${activeZones.has('D') ? 'is-active' : ''}`} />

        <g className="sim-wind-vector">
          <line x1={sourceX} y1={sourceY} x2={downwindEndX} y2={downwindEndY} markerEnd="url(#simulation-wind-arrow)" />
        </g>
        <g className="sim-source-mark">
          <circle cx={sourceX} cy={sourceY} r="23" fill="url(#simulation-dust-source)" />
          <circle cx={sourceX} cy={sourceY} r="8" fill="#ffd381" stroke="#fff0c3" strokeWidth="2" />
          <path d={`M${sourceX - 4} ${sourceY + 1} l4 -8 4 8 M${sourceX - 7} ${sourceY + 7} h14`} fill="none" stroke="#6a3623" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        <g className="sim-sensor-pin" transform="translate(500 143)"><circle r="13" /><text y="4">N</text></g>
        <g className="sim-sensor-pin" transform="translate(725 305)"><circle r="13" /><text y="4">E</text></g>
        <g className="sim-sensor-pin" transform="translate(500 469)"><circle r="13" /><text y="4">S</text></g>
        <g className="sim-sensor-pin" transform="translate(275 305)"><circle r="13" /><text y="4">W</text></g>
      </svg>

      <div className="sim-zone-tags" aria-label="Boundary misting zones">
        {(['A', 'B', 'C', 'D'] as const).map((zone) => <ZoneTag key={zone} zone={zone} active={activeZones.has(zone)} />)}
      </div>

      {prediction.sensors.map((reading) => (
        <SensorCard key={reading.id} reading={reading} view={view} activeZone={activeZones.has(zoneForBoundary[reading.id])} />
      ))}

      <div className="sim-map-legend" aria-label="Map legend">
        <span><i className="legend-boundary" />Site boundary</span>
        <span><i className="legend-source" />Dust source</span>
        <span><i className={`legend-plume pollutant-${view}`} />Modeled plume</span>
        <span><i className="legend-sensor" />PM sensor</span>
        <span><i className="legend-active" />Misting active</span>
        <span><i className="legend-standby" />Zone standby</span>
        <span><i className="legend-wind"><Wind aria-hidden="true" /></i>Wind direction</span>
      </div>

      <div className="sim-map-source-note"><Activity aria-hidden="true" /><span>Estimates · not field readings</span><Droplets aria-hidden="true" /></div>
    </div>
  );
}
