import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import '../features/simulation/simulationPage.css';
import { Activity, BarChart3, CircleHelp, Clock3, CloudFog, Droplets, Gauge, LocateFixed, LoaderCircle, Pause, Play, RefreshCw, ShieldCheck, SlidersHorizontal, Thermometer, Wind, Zap } from 'lucide-react';
import { BoundaryLineChart, ComparisonBars } from '../components/Charts';
import { Eyebrow } from '../components/SiteChrome';
import SimulationMap from '../features/simulation/SimulationMap';
import { predictionService } from '../services/predictionService';
import { calculateStrategyComparison } from '../features/simulation/strategyComparison';
import { NOZZLES_PER_ZONE, NOZZLE_FLOW_RATE_LPM, PUMP_FLOW_RATE_LPM } from '../config/waterSystem';
import {
  advanceSimulation,
  createInitialRunState,
  defaultInput,
  directionLabel,
  predictSimulation,
  resetRunState,
} from '../features/simulation/simulationEngine';
import { formatSimulationDuration } from '../features/simulation/waterModel';
import type { ControlStrategy, PollutantView, SimulationInput, SimulationRunState, SimulationPrediction, StrategyComparisonResult } from '../features/simulation/simulationTypes';

const directionOptions = [
  [0, 'N (0°)'], [45, 'NE (45°)'], [90, 'E (90°)'], [135, 'SE (135°)'],
  [180, 'S (180°)'], [225, 'SW (225°)'], [270, 'W (270°)'], [315, 'NW (315°)'],
] as const;

const strategyOptions: Array<{ value: ControlStrategy; label: string }> = [
  { value: 'noControl', label: 'No Control' },
  { value: 'continuous', label: 'Continuous Spraying' },
  { value: 'reactive', label: 'Reactive Spraying' },
  { value: 'predictive', label: 'DustTwin Predictive' },
];

const strategyColors: Record<ControlStrategy, string> = {
  noControl: '#8a929f',
  continuous: '#ff723c',
  reactive: '#ffca2f',
  predictive: '#16d9ed',
};

function MetricTile({ icon, title, value, detail, tone = '', children }: {
  icon: React.ReactNode;
  title: string;
  value: string;
  detail?: string;
  tone?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="analytics-tile">
      <div className="analytics-tile-head">{icon}<span>{title}</span></div>
      <strong className={tone}>{value}</strong>
      {detail && <small>{detail}</small>}
      {children}
    </div>
  );
}

function formatLeadTime(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds} s`;
  return `${(seconds / 60).toFixed(1)} min`;
}

function riskTone(risk: SimulationPrediction['risk']): string {
  if (risk === 'VERY HIGH' || risk === 'HIGH') return 'orange';
  if (risk === 'MODERATE') return 'yellow';
  return 'green';
}

function shortStrategyLabel(strategy: ControlStrategy): string {
  return strategy === 'predictive' ? 'DustTwin' : strategy === 'continuous' ? 'Continuous' : strategy === 'reactive' ? 'Reactive' : 'No Control';
}

function StrategyComparisonPanel({ results }: { results: StrategyComparisonResult[] }) {
  const byStrategy = new Map(results.map((result) => [result.strategy, result]));
  const chartData = [{
    label: 'Boundary PM2.5',
    noControl: byStrategy.get('noControl')?.boundaryPm25 ?? 0,
    continuous: byStrategy.get('continuous')?.boundaryPm25 ?? 0,
    reactive: byStrategy.get('reactive')?.boundaryPm25 ?? 0,
    predictive: byStrategy.get('predictive')?.boundaryPm25 ?? 0,
  }];

  return (
    <article className="sim-chart-card strategy-comparison-card" aria-label="Four-strategy comparison">
      <div className="sim-chart-title"><span><BarChart3 size={16} aria-hidden="true" />Strategy Comparison</span><small>Same 8-min modeled window</small></div>
      <ComparisonBars data={chartData} keys={['noControl', 'continuous', 'reactive', 'predictive']} compact />
      <div className="strategy-chart-legend" aria-label="Strategy chart legend">
        {(['noControl', 'continuous', 'reactive', 'predictive'] as const).map((strategy) => <span key={strategy}><i style={{ background: strategyColors[strategy] }} />{shortStrategyLabel(strategy)}</span>)}
      </div>
      <div className="comparison-table-wrap">
        <table className="sim-comparison-table">
          <thead><tr><th>Strategy</th><th>Boundary PM₂.₅</th><th>Exceed</th><th>Water</th></tr></thead>
          <tbody>
            {results.map((result) => <tr key={result.strategy} className={result.strategy === 'predictive' ? 'is-predictive' : ''}>
              <th scope="row"><i style={{ background: strategyColors[result.strategy] }} />{shortStrategyLabel(result.strategy)}</th>
              <td>{result.boundaryPm25.toFixed(1)}</td>
              <td>{result.exceedanceMinutes.toFixed(1)} min</td>
              <td>{result.waterUsedL.toFixed(1)} L</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <p className="comparison-water-note">Water = configured L/min × active nozzles × modeled spray time.</p>
    </article>
  );
}

export default function Simulation() {
  const [controls, setControls] = useState<SimulationInput>({ ...defaultInput });
  const [shiftEnabled, setShiftEnabled] = useState(false);
  const [shiftDirection, setShiftDirection] = useState(90);
  const [shiftSpeed, setShiftSpeed] = useState(8);
  const [strategy, setStrategy] = useState<ControlStrategy>('predictive');
  const [mapView, setMapView] = useState<PollutantView>('combined');
  const [runState, setRunState] = useState<SimulationRunState>(() => createInitialRunState(defaultInput));
  const [isApplying, setIsApplying] = useState(false);
  const [applyFeedback, setApplyFeedback] = useState('');
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const applySequence = useRef(0);

  const activeInput = useMemo(() => shiftEnabled
    ? { ...controls, windDirection: shiftDirection, windSpeed: shiftSpeed }
    : controls, [controls, shiftEnabled, shiftDirection, shiftSpeed]);

  useEffect(() => {
    if (!runState.running) return;
    const timer = window.setInterval(() => {
      setRunState((previous) => advanceSimulation(previous, activeInput, strategy).state);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [runState.running, activeInput, strategy]);

  useEffect(() => {
    setLastUpdated(new Date());
  }, [activeInput, strategy, runState.elapsedSeconds, runState.running]);

  const prediction = useMemo(() => predictSimulation(
    activeInput,
    runState.currentPm25,
    strategy,
    runState.running,
    runState,
  ), [activeInput, runState, strategy]);
  const strategyResults = useMemo(() => calculateStrategyComparison(prediction), [prediction]);
  const localTime = lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const activeZonesLabel = prediction.activeZoneIds.length
    ? prediction.activeZoneIds.map((zone) => `Zone ${zone}`).join(' · ')
    : 'None';
  const forecastSensorRows = prediction.predictedBoundaries.map((boundary) => prediction.sensors.find((sensor) => sensor.id === boundary)).filter((sensor) => sensor !== undefined);

  const setControl = <K extends keyof SimulationInput>(key: K, value: SimulationInput[K]) => {
    setApplyFeedback('');
    setControls((previous) => ({ ...previous, [key]: value }));
  };

  const loadConstructionPreset = () => {
    setControls({ ...defaultInput });
    setShiftEnabled(false);
    setShiftDirection(90);
    setShiftSpeed(8);
    setStrategy('predictive');
    setApplyFeedback('Construction Dust Event preset loaded.');
  };

  const reset = () => {
    applySequence.current += 1;
    setControls({ ...defaultInput });
    setShiftEnabled(false);
    setShiftDirection(90);
    setShiftSpeed(8);
    setStrategy('predictive');
    setMapView('combined');
    setRunState(resetRunState(defaultInput));
    setIsApplying(false);
    setApplyFeedback('');
    setLastUpdated(new Date());
  };

  const apply = async () => {
    if (isApplying) return;
    const sequence = ++applySequence.current;
    const stateSnapshot = runState;
    setIsApplying(true);
    setApplyFeedback('Recalculating the modeled sensor and plume outputs…');
    try {
      const result = await predictionService.predict(activeInput, {
        currentPm25: stateSnapshot.currentPm25,
        strategy,
        running: stateSnapshot.running,
        runState: stateSnapshot,
      });
      if (sequence !== applySequence.current) return;
      setLastUpdated(new Date());
      setApplyFeedback(`Applied · ${result.risk} forecast · ${result.activeZoneIds.length ? `${result.activeZoneIds.length} zone${result.activeZoneIds.length === 1 ? '' : 's'} active` : 'misting standby'}`);
    } catch {
      if (sequence === applySequence.current) setApplyFeedback('Could not apply this scenario. Please try again.');
    } finally {
      if (sequence === applySequence.current) setIsApplying(false);
    }
  };

  const toggleRunning = () => {
    setRunState((previous) => ({ ...previous, running: !previous.running }));
    setApplyFeedback('');
  };

  return (
    <div className="simulation-page">
      <section className="simulation-intro" aria-label="Simulation overview">
        <div className="sim-title">
          <Eyebrow>DETERMINISTIC MODEL <span>FOR CLEANER, SAFER COMMUNITIES</span></Eyebrow>
          <h1>Live Digital Twin <span>Simulation</span></h1>
          <p>Follow a modeled dust plume from source and weather inputs through four boundary sensors to a targeted, flow-metered misting response.</p>
        </div>
        <div className="sim-intro-card"><span><Wind aria-hidden="true" /></span><div><small>Wind · plume travels toward</small><strong>{activeInput.windSpeed.toFixed(1)} m/s</strong><p>{directionLabel(activeInput.windDirection)} ({activeInput.windDirection}°)</p></div></div>
        <div className="sim-intro-card"><span><Thermometer aria-hidden="true" /></span><div><small>Temperature · humidity</small><strong>{controls.temperatureC}°C · {controls.humidity}% RH</strong><p>Current modeled weather inputs</p></div></div>
        <div className="sim-intro-card"><span><Activity aria-hidden="true" /></span><div><small>System · updated {localTime}</small><strong>Simulation Estimates</strong><p className={`sim-state-text ${runState.running ? 'running' : 'paused'}`}><i />{runState.running ? 'RUNNING' : 'PAUSED'}</p></div></div>
      </section>

      <div className="simulation-dashboard">
        <aside className="sim-panel control-panel" aria-label="Simulation controls">
          <div className="panel-title-row"><h2><SlidersHorizontal aria-hidden="true" />Simulation Controls</h2><div className="panel-title-actions"><button type="button" className="quiet-button sim-pause-button" onClick={toggleRunning} aria-label={runState.running ? 'Pause simulation' : 'Resume simulation'} title={runState.running ? 'Pause simulation clock and water use' : 'Resume simulation clock and water use'}>{runState.running ? <Pause size={12} aria-hidden="true" /> : <Play size={12} aria-hidden="true" />}{runState.running ? 'Pause' : 'Resume'}</button><button type="button" className="quiet-button" onClick={reset}><RefreshCw size={13} aria-hidden="true" />Reset All</button></div></div>
          <button type="button" className="preset-button" onClick={loadConstructionPreset}><Zap size={14} aria-hidden="true" /><span><b>Construction Dust Event</b><small>70% · 4.2 m/s NW · 28°C · 45% RH</small></span><span className="preset-load">LOAD</span></button>

          <div className="control-group sim-range-control">
            <div className="control-heading"><div className="control-label"><CloudFog aria-hidden="true" />Dust Source Intensity</div><span className="help-icon" role="img" aria-label="Relative dust generated by the modeled source"><CircleHelp size={10} /></span></div>
            <div className="control-value">{controls.dustIntensity}%</div>
            <div className="range-row"><input aria-label="Dust source intensity" type="range" min="0" max="100" step="1" value={controls.dustIntensity} onChange={(event) => setControl('dustIntensity', Number(event.currentTarget.value))} /><output className="range-value">{controls.dustIntensity}</output></div><div className="range-scale"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
          </div>

          <div className="control-group sim-range-control">
            <div className="control-heading"><div className="control-label"><Wind aria-hidden="true" />Wind Speed</div><span className="help-icon" role="img" aria-label="Wind speed affects modeled plume velocity and dispersion"><CircleHelp size={10} /></span></div>
            <div className="control-value">{activeInput.windSpeed.toFixed(1)} m/s</div>
            <div className="range-row"><input aria-label="Wind speed" type="range" min="0" max="10" step="0.1" value={activeInput.windSpeed} onChange={(event) => shiftEnabled ? setShiftSpeed(Number(event.currentTarget.value)) : setControl('windSpeed', Number(event.currentTarget.value))} /><output className="range-value">{activeInput.windSpeed.toFixed(1)}</output></div><div className="range-scale"><span>0</span><span>2</span><span>4</span><span>6</span><span>8</span><span>10</span></div>
          </div>

          <div className="control-group">
            <div className="control-heading"><div className="control-label"><LocateFixed aria-hidden="true" />Wind / Plume Direction</div><span className="help-icon" role="img" aria-label="Compass bearing indicates the direction the plume travels toward; boundary sensors determine the predicted escape zone"><CircleHelp size={10} /></span></div>
            <div className="direction-row"><div><div className="control-value" style={{ marginLeft: 0 }}>{directionLabel(activeInput.windDirection)} ({activeInput.windDirection}°)</div></div><div className="compass-dial" style={{ '--compass': `${activeInput.windDirection}deg` } as CSSProperties} aria-hidden="true"><span>➤</span></div><select aria-label="Wind direction" value={activeInput.windDirection} onChange={(event) => shiftEnabled ? setShiftDirection(Number(event.currentTarget.value)) : setControl('windDirection', Number(event.currentTarget.value))}>{directionOptions.map(([degrees, label]) => <option value={degrees} key={degrees}>{label}</option>)}</select></div>
          </div>

          <div className="control-group sim-range-control">
            <div className="control-heading"><div className="control-label"><Thermometer aria-hidden="true" />Temperature</div><span className="help-icon" role="img" aria-label="Temperature contributes to the modeled plume speed and dispersion"><CircleHelp size={10} /></span></div>
            <div className="control-value">{controls.temperatureC}°C</div>
            <div className="range-row"><input aria-label="Temperature" type="range" min="10" max="50" step="1" value={controls.temperatureC} onChange={(event) => setControl('temperatureC', Number(event.currentTarget.value))} /><output className="range-value">{controls.temperatureC}°C</output></div><div className="range-scale"><span>10°C</span><span>20°C</span><span>30°C</span><span>40°C</span><span>50°C</span></div>
          </div>

          <div className="control-group sim-range-control">
            <div className="control-heading"><div className="control-label"><Droplets aria-hidden="true" />Humidity</div><span className="help-icon" role="img" aria-label="Higher relative humidity slightly reduces modeled airborne concentration"><CircleHelp size={10} /></span></div>
            <div className="control-value">{controls.humidity}% RH</div>
            <div className="range-row"><input aria-label="Humidity" type="range" min="0" max="100" step="1" value={controls.humidity} onChange={(event) => setControl('humidity', Number(event.currentTarget.value))} /><output className="range-value">{controls.humidity}</output></div><div className="range-scale"><span>0%</span><span>20%</span><span>40%</span><span>60%</span><span>80%</span><span>100%</span></div>
          </div>

          <div className="control-group strategy-control-group">
            <div className="control-heading"><div className="control-label"><ShieldCheck aria-hidden="true" />Control Strategy</div><span className="help-icon" role="img" aria-label="Choose how the deterministic misting controller responds"><CircleHelp size={10} /></span></div>
            <select aria-label="Control strategy" value={strategy} onChange={(event) => setStrategy(event.currentTarget.value as ControlStrategy)}>{strategyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          </div>

          <div className="control-group">
            <div className="toggle-line"><div><span className="control-label"><Wind aria-hidden="true" />Sudden Wind Shift</span><small>Recalculate the plume against a changed wind vector</small></div><button type="button" className={`switch ${shiftEnabled ? 'on' : ''}`} aria-label="Toggle sudden wind shift" aria-pressed={shiftEnabled} onClick={() => { setShiftEnabled((value) => !value); setApplyFeedback(''); }} /></div>
            {shiftEnabled && <div className="shift-fields"><label>New Wind Direction<select aria-label="New wind direction" value={shiftDirection} onChange={(event) => setShiftDirection(Number(event.currentTarget.value))}>{directionOptions.map(([degrees, label]) => <option value={degrees} key={degrees}>{label}</option>)}</select></label><label>New Wind Speed<select aria-label="New wind speed" value={shiftSpeed} onChange={(event) => setShiftSpeed(Number(event.currentTarget.value))}><option value={4}>4.0 m/s</option><option value={6}>6.0 m/s</option><option value={8}>8.0 m/s</option><option value={10}>10.0 m/s</option></select></label></div>}
          </div>

          <div className="sim-actions">
            <button type="button" className="cta-button" onClick={() => void apply()} disabled={isApplying} aria-busy={isApplying}><span className="cta-icon">{isApplying ? <LoaderCircle size={16} className="applying-icon" /> : <span className="play-disc">▶</span>}</span>{isApplying ? 'Applying…' : 'Apply Changes'}</button>
          </div>
          <p className={`apply-feedback ${isApplying ? 'is-applying' : ''}`} role="status" aria-live="polite">{applyFeedback || (runState.running ? 'Sensor and control estimates update each second.' : 'Paused · readings and water counter are held.')}</p>
        </aside>

        <section className="sim-center" aria-label="Modeled site visualization and comparisons">
          <div className="sim-map-panel"><SimulationMap prediction={prediction} input={activeInput} view={mapView} onViewChange={setMapView} /></div>
          <div className="sim-bottom-charts">
            <article className="sim-chart-card trend-chart-card">
              <div className="sim-chart-title"><span><Activity size={16} aria-hidden="true" />Boundary PM₂.₅ Trend</span><small>8-min modeled projection</small></div>
              <div className="chart-legend"><span><i />Current strategy</span><span><i className="baseline" />No control</span></div>
              <BoundaryLineChart data={prediction.chart} />
            </article>
            <StrategyComparisonPanel results={strategyResults} />
          </div>
        </section>

        <aside className="sim-panel analytics-panel" aria-label="Live simulation analytics">
          <h2><BarChart3 aria-hidden="true" />Live Analytics</h2>
          <p className="analytics-disclaimer">Simulation estimates · not field results</p>
          <div className="analytics-grid">
            <MetricTile icon={<Gauge />} title="Projected PM2.5" value={`${prediction.projectedPm25} µg/m³`} detail="Highest boundary · 30 s with selected response" tone="cyan" />
            <MetricTile icon={<Activity />} title="Projected PM10" value={`${prediction.projectedPm10} µg/m³`} detail="Derived as PM2.5 × 1.65" />
            <MetricTile icon={<ShieldCheck />} title="Boundary Risk" value={prediction.risk} detail={`Peak untreated forecast ${prediction.baselinePm25} µg/m³`} tone={riskTone(prediction.risk)}><div className={`risk-meter risk-meter-${prediction.risk.toLowerCase().replace(' ', '-')}`}><span style={{ width: `${prediction.riskIndex}%` }} /></div><small className="analytics-scale-note">Concentration scale: 0–150 µg/m³</small></MetricTile>
            <MetricTile icon={<LocateFixed />} title="Predicted Escape Boundary" value={prediction.predictedEscapeBoundary} detail={prediction.primaryBoundary ? `Sensor model · ${prediction.sensors.find((sensor) => sensor.id === prediction.primaryBoundary)?.label} most exposed` : 'All forecasts below threshold'} tone={prediction.risk === 'HIGH' || prediction.risk === 'VERY HIGH' ? 'orange' : ''} />
            <MetricTile icon={<Droplets />} title="Active Misting Zones" value={activeZonesLabel} detail={`${prediction.activeNozzles} active nozzles · forecast targets: ${prediction.predictedZoneIds.map((zone) => `Zone ${zone}`).join(' · ') || 'none'}`} tone={prediction.activeZoneIds.length ? 'cyan' : ''} />
            <MetricTile icon={<Clock3 />} title="Prediction Lead Time" value={formatLeadTime(prediction.leadTimeSeconds)} detail={prediction.leadTimeSeconds ? 'Site-to-boundary distance ÷ plume velocity' : 'No boundary threshold event predicted'} />
          </div>

          <div className="water-live-panel" aria-label="Live water use and flow">
            <div><small>Water used</small><strong>{prediction.waterUsedL.toFixed(2)} L</strong></div>
            <div><small>Current flow</small><strong>{prediction.flowRateLpm.toFixed(2)} L/min</strong></div>
            <div><small>Misting time</small><strong>{formatSimulationDuration(prediction.mistingSeconds)}</strong></div>
            <p>Σ(flow × running seconds ÷ 60) · {NOZZLE_FLOW_RATE_LPM.toFixed(2)} L/min/nozzle × {NOZZLES_PER_ZONE} nozzle/zone · pump cap {PUMP_FLOW_RATE_LPM.toFixed(2)} L/min</p>
          </div>

          <div className="analytics-decision-card"><small><ShieldCheck aria-hidden="true" />Control decision</small><strong>{prediction.decision}</strong></div>

          <div className="analytics-system-status">
            <div className="analytics-status-heading"><span><i className={runState.running ? 'is-running' : 'is-paused'} />System status</span><b className={runState.running ? 'is-running' : 'is-paused'}>{runState.running ? 'RUNNING' : 'PAUSED'}</b></div>
            <div><span>Strategy</span><strong>{strategyOptions.find((option) => option.value === strategy)?.label}</strong></div>
            <div><span>Pump output</span><strong className={prediction.flowRateLpm > 0 ? 'pump-on' : ''}>{prediction.flowRateLpm > 0 ? 'MISTING' : 'OFF'}</strong></div>
            <div><span>Simulation clock</span><strong>{formatSimulationDuration(prediction.elapsedSeconds)}</strong></div>
          </div>

          <details className="why-decision">
            <summary><span><CircleHelp aria-hidden="true" />Why this decision?</span><b>{prediction.risk} forecast</b></summary>
            <div className="why-decision-content">
              {prediction.decisionReasons.map((reason) => <p key={reason}>{reason}</p>)}
              {forecastSensorRows.length > 0 && <p className="why-sensors">{forecastSensorRows.map((sensor) => `${sensor.label}: ${sensor.forecastPm25} µg/m³ PM2.5 / ${sensor.forecastPm10} µg/m³ PM10`).join(' · ')}</p>}
              <p className="why-formula">PM10 = PM2.5 × 1.65. Risk bands use 40 / 75 / 150 µg/m³ PM2.5.</p>
            </div>
          </details>
        </aside>
      </div>
      <span className="simulation-runtime-note" aria-label="Simulation values are modeled estimates, not field measurements">Deterministic scenario model · no field measurements represented</span>
    </div>
  );
}
