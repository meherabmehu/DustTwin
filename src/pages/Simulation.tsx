import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, CircleHelp, Clock3, CloudFog, Droplets, Gauge, LocateFixed, RefreshCw, ShieldCheck, SlidersHorizontal, Wind, Zap } from 'lucide-react';
import { BoundaryLineChart, ComparisonBars, Sparkline } from '../components/Charts';
import { CTAButton, Eyebrow } from '../components/SiteChrome';
import { DustMap } from '../components/Visuals';
import { defaultInput, directionLabel, type Prediction, type SimulationInput } from '../lib/simulation';
import { predictionService } from '../services/predictionService';

const initialPrediction: Prediction = {
  pm25: 36, pm10: 58, boundaryRisk: 24, risk: 'LOW', escapeDirection: 'East', activeZone: 'Zone C', leadTime: 12, waterUsage: 1240,
  plumeLength: 62, plumeAngle: 0, zoneReadings: [28, 32, 35, 24],
  chart: Array.from({ length: 20 }, (_, i) => ({ time: `${10 + Math.floor(i / 4)}:${String((i % 4) * 15).padStart(2, '0')}`, twin: 30 + Math.sin(i * .75) * 11, baseline: 49 + Math.sin(i * .62) * 23 + i * .35 })),
};

function MetricTile({ icon, title, value, detail, tone = '', spark = false, children }: { icon: React.ReactNode; title: string; value: string; detail?: string; tone?: string; spark?: boolean; children?: React.ReactNode }) {
  return <div className="analytics-tile"><div className="analytics-tile-head">{icon}<span>{title}</span></div><strong className={tone}>{value}</strong>{detail && <small>{detail}</small>}{spark && <Sparkline base={30} />}{children}</div>;
}

export default function Simulation() {
  const [controls, setControls] = useState<SimulationInput>(defaultInput);
  const [shiftDirection, setShiftDirection] = useState(90);
  const [shiftSpeed, setShiftSpeed] = useState(8);
  const [prediction, setPrediction] = useState<Prediction>(initialPrediction);
  const [running, setRunning] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const activeInput = useMemo(() => controls.suddenShift ? { ...controls, windDirection: shiftDirection, windSpeed: shiftSpeed } : controls, [controls, shiftDirection, shiftSpeed]);
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => {
      void predictionService.predict(activeInput).then((result) => { setPrediction(result); setLastUpdated(new Date()); });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [activeInput, running]);
  useEffect(() => {
    if (!running) return;
    const tick = window.setInterval(() => setLastUpdated(new Date()), 5000);
    return () => window.clearInterval(tick);
  }, [running]);

  const setControl = <K extends keyof SimulationInput>(key: K, value: SimulationInput[K]) => setControls((prev) => ({ ...prev, [key]: value }));
  const reset = () => { setControls(defaultInput); setShiftDirection(90); setShiftSpeed(8); setRunning(true); setPrediction(initialPrediction); };
  const apply = () => { const next = controls.suddenShift ? { ...controls, windDirection: shiftDirection, windSpeed: shiftSpeed } : controls; void predictionService.predict(next).then((result) => { setPrediction(result); setLastUpdated(new Date()); }); };
  const localTime = lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const readings: [number, number, number] = [Math.max(8, Math.round(prediction.pm25 * .78)), Math.max(8, Math.round(prediction.pm25 * .5)), Math.round(prediction.pm25 * 2.28)];
  const strategyData = [{ label: 'Boundary', baseline: 82, continuous: 46, reactive: 29, predictive: Math.max(8, Math.round(prediction.pm25 * .5)) }];

  return (
    <div className="simulation-page">
      <section className="simulation-intro">
        <div className="sim-title">
          <Eyebrow>AI + SIMULATION + IoT <span>FOR CLEANER, SAFER COMMUNITIES</span></Eyebrow>
          <h1>Live Digital Twin <span>Simulation</span></h1>
          <p>Adjust environmental conditions and control misting zones to see how DustTwin predicts, contains, and prevents construction dust escape in real time.</p>
        </div>
        <div className="sim-intro-card"><span><Wind /></span><div><small>Wind Speed & Direction</small><strong>{activeInput.windSpeed.toFixed(1)} m/s</strong><p>{directionLabel(activeInput.windDirection)} ({activeInput.windDirection}°)</p></div></div>
        <div className="sim-intro-card"><span><Clock3 /></span><div><small>Simulation Time</small><strong>{lastUpdated.toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' })}</strong><p>{localTime} · <b>2×</b></p></div></div>
        <div className="sim-intro-card"><span><Activity /></span><div><small>Real-time Mode</small><strong>Live Digital Twin</strong><p className="active-text">● {running ? 'ACTIVE' : 'PAUSED'}</p></div></div>
      </section>

      <div className="simulation-dashboard">
        <aside className="sim-panel control-panel">
          <div className="panel-title-row"><h2><SlidersHorizontal />Simulation Controls</h2><button className="quiet-button" onClick={reset}><RefreshCw size={13} />Reset All</button></div>
          <div className="control-group">
            <div className="control-heading"><div className="control-label"><CloudFog />Dust Source Intensity</div><span className="help-icon" title="Relative dust generated by simulated site activity"><CircleHelp size={10} /></span></div>
            <div className="control-value">{controls.dustIntensity}%</div>
            <div className="range-row"><input aria-label="Dust source intensity" type="range" min="0" max="100" value={controls.dustIntensity} onChange={(e) => setControl('dustIntensity', Number(e.target.value))} /><span className="range-value">{controls.dustIntensity}</span></div><div className="range-scale"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
          </div>
          <div className="control-group">
            <div className="control-heading"><div className="control-label"><Wind />Wind Speed</div><span className="help-icon" title="Wind speed moves the dust plume faster"><CircleHelp size={10} /></span></div>
            <div className="control-value">{activeInput.windSpeed.toFixed(1)} m/s</div>
            <div className="range-row"><input aria-label="Wind speed" type="range" min="0" max="10" step="0.1" value={activeInput.windSpeed} onChange={(e) => controls.suddenShift ? setShiftSpeed(Number(e.target.value)) : setControl('windSpeed', Number(e.target.value))} /><span className="range-value">{activeInput.windSpeed.toFixed(1)}</span></div><div className="range-scale"><span>0</span><span>2</span><span>4</span><span>6</span><span>8</span><span>10</span></div>
          </div>
          <div className="control-group">
            <div className="control-heading"><div className="control-label"><CompassIcon />Wind Direction</div><span className="help-icon" title="Direction changes which boundary is at risk"><CircleHelp size={10} /></span></div>
            <div className="direction-row"><div><div className="control-value" style={{ marginLeft: 0 }}>{directionLabel(activeInput.windDirection)} ({activeInput.windDirection}°)</div></div><div className="compass-dial" style={{ '--compass': `${activeInput.windDirection}deg` } as React.CSSProperties}><span>➤</span></div><select aria-label="Wind direction" value={activeInput.windDirection} onChange={(e) => controls.suddenShift ? setShiftDirection(Number(e.target.value)) : setControl('windDirection', Number(e.target.value))}><option value={0}>N (0°)</option><option value={45}>NE (45°)</option><option value={90}>E (90°)</option><option value={135}>SE (135°)</option><option value={180}>S (180°)</option><option value={225}>SW (225°)</option><option value={270}>W (270°)</option><option value={315}>NW (315°)</option></select></div>
          </div>
          <div className="control-group">
            <div className="control-heading"><div className="control-label"><Droplets />Humidity</div><span className="help-icon" title="Humidity slightly reduces simulated particle dispersion"><CircleHelp size={10} /></span></div>
            <div className="control-value">{controls.humidity}%</div>
            <div className="range-row"><input aria-label="Humidity" type="range" min="0" max="100" value={controls.humidity} onChange={(e) => setControl('humidity', Number(e.target.value))} /><span className="range-value">{controls.humidity}</span></div><div className="range-scale"><span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100</span></div>
          </div>
          <div className="control-group">
            <div className="toggle-line"><div><span className="control-label"><Wind />Sudden Wind Shift</span><small>Simulate a sudden change in wind direction and speed</small></div><button className={`switch ${controls.suddenShift ? 'on' : ''}`} aria-label="Toggle sudden wind shift" aria-pressed={controls.suddenShift} onClick={() => setControl('suddenShift', !controls.suddenShift)} /></div>
            {controls.suddenShift && <div className="shift-fields"><label>New Wind Direction<select value={shiftDirection} onChange={(e) => setShiftDirection(Number(e.target.value))}><option value={0}>N (0°)</option><option value={90}>E (90°)</option><option value={180}>S (180°)</option><option value={270}>W (270°)</option><option value={315}>NW (315°)</option></select></label><label>New Wind Speed<select value={shiftSpeed} onChange={(e) => setShiftSpeed(Number(e.target.value))}><option value={4}>4.0 m/s</option><option value={6}>6.0 m/s</option><option value={8}>8.0 m/s</option><option value={10}>10.0 m/s</option></select></label></div>}
          </div>
          <div className="sim-actions"><button className="cta-button" onClick={apply}><span className="cta-icon"><span className="play-disc">▶</span></span>Apply Changes to Simulation</button><button className="reset-sim" onClick={() => setRunning((v) => !v)}>{running ? 'Pause' : 'Resume'}</button></div>
        </aside>

        <section className="sim-center">
          <div className="sim-map-panel"><DustMap intensity={Math.min(100, Math.max(5, controls.dustIntensity + activeInput.windSpeed * 1.4 - controls.humidity * 0.12))} windSpeed={activeInput.windSpeed} windDirection={activeInput.windDirection} activeZone={prediction.activeZone} readings={readings} problem={prediction.risk === 'HIGH'} /></div>
          <div className="sim-bottom-charts">
            <article className="sim-chart-card"><div className="sim-chart-title"><span><Activity size={16} /> PM Concentration at Site Boundary</span><div className="chart-legend"><span><i />With DustTwin (Active)</span><span><i className="baseline" />Without Control (Baseline)</span></div></div><BoundaryLineChart data={prediction.chart} /></article>
            <article className="sim-chart-card"><div className="sim-chart-title"><span><BarChart3 size={16} /> Strategy Comparison</span><small>Peak PM2.5</small></div><ComparisonBars data={strategyData} compact /></article>
          </div>
        </section>

        <aside className="sim-panel analytics-panel">
          <h2><BarChart3 />Live Analytics</h2>
          <div className="analytics-grid">
            <MetricTile icon={<Gauge />} title="PM2.5 Average" value={`${prediction.pm25} μg/m³`} detail="↓ 42% vs. no control" tone="cyan" spark />
            <MetricTile icon={<Activity />} title="PM10 Average" value={`${prediction.pm10} μg/m³`} detail="↓ 35% vs. no control" tone="" spark />
            <MetricTile icon={<ShieldCheck />} title="Boundary Risk" value={prediction.risk} detail={`${prediction.boundaryRisk}% simulated risk index`} tone={prediction.risk === 'LOW' ? 'green' : 'orange'}><div className="risk-meter"><span style={{ width: `${prediction.boundaryRisk}%` }} /></div></MetricTile>
            <MetricTile icon={<Zap />} title="Predicted Escape Zone" value={prediction.escapeDirection === 'East' ? 'East Boundary' : `${prediction.escapeDirection} Boundary`} detail="In 8–12 min · illustrative" tone="orange" />
            <MetricTile icon={<Droplets />} title="Active Misting Zone" value={prediction.activeZone} detail="Flow rate: 120 L/min" tone="cyan"><span className="status-pill"><i /> ACTIVE</span></MetricTile>
            <MetricTile icon={<Clock3 />} title="Lead Time (Prediction)" value={`${prediction.leadTime} min`} detail="Time before potential off-site exposure" tone="" />
            <MetricTile icon={<Droplets />} title="Water Usage (Today)" value={`${prediction.waterUsage.toLocaleString()} L`} detail="↓ 28% vs. baseline" tone="cyan" />
            <MetricTile icon={<Activity />} title="System Status" value="All Systems Online" detail="Prediction service · local demo" tone="green"><div className="system-status-list"><span><i />4/4 Misting Zones</span><span><i />4/4 PM Sensors</span><span><i />Mock Prediction Engine</span><span><i />Live UI Connection</span></div></MetricTile>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CompassIcon() { return <LocateFixed />; }
