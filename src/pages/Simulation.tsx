import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, BarChart3, CircleHelp, Clock3, CloudFog, Droplets, Gauge, LocateFixed, LoaderCircle, RefreshCw, ShieldCheck, SlidersHorizontal, Wind, Zap } from 'lucide-react';
import { BoundaryLineChart, ComparisonBars, Sparkline } from '../components/Charts';
import { CTAButton, Eyebrow } from '../components/SiteChrome';
import { DustMap } from '../components/Visuals';
import { calculateDustScenario, defaultInput, directionLabel, type Prediction, type SimulationInput } from '../lib/simulation';
import { predictionService } from '../services/predictionService';

function MetricTile({ icon, title, value, detail, tone = '', sparkBase, children }: { icon: React.ReactNode; title: string; value: string; detail?: string; tone?: string; sparkBase?: number; children?: React.ReactNode }) {
  return <div className="analytics-tile"><div className="analytics-tile-head">{icon}<span>{title}</span></div><strong className={tone}>{value}</strong>{detail && <small>{detail}</small>}{sparkBase !== undefined && <Sparkline base={Math.max(1, sparkBase)} />}{children}</div>;
}

const directionOptions = [
  [0, 'N (0°)'], [45, 'NE (45°)'], [90, 'E (90°)'], [135, 'SE (135°)'],
  [180, 'S (180°)'], [225, 'SW (225°)'], [270, 'W (270°)'], [315, 'NW (315°)'],
] as const;

export default function Simulation() {
  const [controls, setControls] = useState<SimulationInput>({ ...defaultInput });
  const [shiftDirection, setShiftDirection] = useState(90);
  const [shiftSpeed, setShiftSpeed] = useState(8);
  const [prediction, setPrediction] = useState<Prediction>(() => calculateDustScenario(defaultInput));
  const [running, setRunning] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [applyFeedback, setApplyFeedback] = useState('');
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const applySequence = useRef(0);

  const activeInput = useMemo(() => controls.suddenShift
    ? { ...controls, windDirection: shiftDirection, windSpeed: shiftSpeed }
    : controls, [controls, shiftDirection, shiftSpeed]);

  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void predictionService.predict(activeInput).then((result) => {
        if (cancelled) return;
        setPrediction(result);
        setLastUpdated(new Date());
      });
    }, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeInput, running]);

  const setControl = <K extends keyof SimulationInput>(key: K, value: SimulationInput[K]) => {
    setApplyFeedback('');
    setControls((previous) => ({ ...previous, [key]: value }));
  };

  const reset = () => {
    applySequence.current += 1;
    setControls({ ...defaultInput });
    setShiftDirection(90);
    setShiftSpeed(8);
    setRunning(true);
    setIsApplying(false);
    setApplyFeedback('');
    setPrediction(calculateDustScenario(defaultInput));
    setLastUpdated(new Date());
  };

  const apply = async () => {
    if (isApplying) return;
    const sequence = ++applySequence.current;
    const inputSnapshot = { ...activeInput };
    setIsApplying(true);
    setApplyFeedback('Applying updated conditions…');
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    if (sequence !== applySequence.current) return;
    try {
      const result = await predictionService.predict(inputSnapshot);
      if (sequence !== applySequence.current) return;
      setPrediction(result);
      setLastUpdated(new Date());
      setApplyFeedback(`Applied · ${result.risk} risk · ${result.mistingActive ? `${result.activeZone} misting` : 'misting on standby'}`);
    } catch {
      if (sequence === applySequence.current) setApplyFeedback('Could not apply this scenario. Please try again.');
    } finally {
      if (sequence === applySequence.current) setIsApplying(false);
    }
  };

  const toggleRunning = () => {
    setRunning((value) => !value);
    setApplyFeedback('');
  };

  const localTime = lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const readings: [number, number, number] = [prediction.zoneReadings[0], prediction.zoneReadings[1], prediction.zoneReadings[3]];
  const hotReadingIndex = readings.indexOf(Math.max(...readings));
  const pm25Reduction = prediction.baselinePm25 > 0
    ? Math.max(0, Math.round((1 - prediction.pm25 / prediction.baselinePm25) * 100))
    : 0;
  const pm10Reduction = prediction.baselinePm10 > 0
    ? Math.max(0, Math.round((1 - prediction.pm10 / prediction.baselinePm10) * 100))
    : 0;
  const strategyData = [{ label: 'Scenario', baseline: prediction.baselinePm25, continuous: Math.round(prediction.baselinePm25 * 0.72), reactive: Math.round(prediction.baselinePm25 * 0.58), predictive: prediction.pm25 }];
  const modeledEscape = prediction.risk === 'LOW' ? 'None predicted' : `${prediction.escapeDirection} Boundary`;

  return (
    <div className="simulation-page">
      <section className="simulation-intro" aria-label="Simulation overview">
        <div className="sim-title">
          <Eyebrow>DETERMINISTIC MODEL <span>FOR CLEANER, SAFER COMMUNITIES</span></Eyebrow>
          <h1>Live Digital Twin <span>Simulation</span></h1>
          <p>Adjust environmental conditions and see how DustTwin estimates boundary risk, predicts dust movement, and selects a targeted misting response.</p>
        </div>
        <div className="sim-intro-card"><span><Wind aria-hidden="true" /></span><div><small>Wind Speed &amp; Direction</small><strong>{activeInput.windSpeed.toFixed(1)} m/s</strong><p>{directionLabel(activeInput.windDirection)} ({activeInput.windDirection}°)</p></div></div>
        <div className="sim-intro-card"><span><Clock3 aria-hidden="true" /></span><div><small>Last Updated</small><strong>{localTime}</strong><p>{running ? 'Scenario recalculates on change' : 'Paused · Apply to refresh'}</p></div></div>
        <div className="sim-intro-card"><span><Activity aria-hidden="true" /></span><div><small>Model State</small><strong>Live Digital Twin</strong><p className={`sim-state-text ${running ? 'running' : 'paused'}`}><i />{running ? 'RUNNING' : 'PAUSED'}</p></div></div>
      </section>

      <div className="simulation-dashboard">
        <aside className="sim-panel control-panel" aria-label="Simulation controls">
          <div className="panel-title-row"><h2><SlidersHorizontal aria-hidden="true" />Simulation Controls</h2><button type="button" className="quiet-button" onClick={reset}><RefreshCw size={13} aria-hidden="true" />Reset All</button></div>
          <div className="control-group">
            <div className="control-heading"><div className="control-label"><CloudFog aria-hidden="true" />Dust Source Intensity</div><span className="help-icon" role="img" aria-label="Relative dust generated by simulated site activity"><CircleHelp size={10} /></span></div>
            <div className="control-value">{controls.dustIntensity}%</div>
            <div className="range-row"><input aria-label="Dust source intensity" type="range" min="0" max="100" value={controls.dustIntensity} onChange={(event) => setControl('dustIntensity', Number(event.currentTarget.value))} /><output className="range-value">{controls.dustIntensity}</output></div><div className="range-scale"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
          </div>
          <div className="control-group">
            <div className="control-heading"><div className="control-label"><Wind aria-hidden="true" />Wind Speed</div><span className="help-icon" role="img" aria-label="Wind speed affects plume travel"><CircleHelp size={10} /></span></div>
            <div className="control-value">{activeInput.windSpeed.toFixed(1)} m/s</div>
            <div className="range-row"><input aria-label="Wind speed" type="range" min="0" max="10" step="0.1" value={activeInput.windSpeed} onChange={(event) => controls.suddenShift ? setShiftSpeed(Number(event.currentTarget.value)) : setControl('windSpeed', Number(event.currentTarget.value))} /><output className="range-value">{activeInput.windSpeed.toFixed(1)}</output></div><div className="range-scale"><span>0</span><span>2</span><span>4</span><span>6</span><span>8</span><span>10</span></div>
          </div>
          <div className="control-group">
            <div className="control-heading"><div className="control-label"><CompassIcon />Wind Direction</div><span className="help-icon" role="img" aria-label="Direction influences the predicted boundary zone"><CircleHelp size={10} /></span></div>
            <div className="direction-row"><div><div className="control-value" style={{ marginLeft: 0 }}>{directionLabel(activeInput.windDirection)} ({activeInput.windDirection}°)</div></div><div className="compass-dial" style={{ '--compass': `${activeInput.windDirection}deg` } as React.CSSProperties} aria-hidden="true"><span>➤</span></div><select aria-label="Wind direction" value={activeInput.windDirection} onChange={(event) => controls.suddenShift ? setShiftDirection(Number(event.currentTarget.value)) : setControl('windDirection', Number(event.currentTarget.value))}>{directionOptions.map(([degrees, label]) => <option value={degrees} key={degrees}>{label}</option>)}</select></div>
          </div>
          <div className="control-group">
            <div className="control-heading"><div className="control-label"><Droplets aria-hidden="true" />Humidity</div><span className="help-icon" role="img" aria-label="Humidity slightly reduces modeled particle dispersion"><CircleHelp size={10} /></span></div>
            <div className="control-value">{controls.humidity}%</div>
            <div className="range-row"><input aria-label="Humidity" type="range" min="0" max="100" value={controls.humidity} onChange={(event) => setControl('humidity', Number(event.currentTarget.value))} /><output className="range-value">{controls.humidity}</output></div><div className="range-scale"><span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100</span></div>
          </div>
          <div className="control-group">
            <div className="toggle-line"><div><span className="control-label"><Wind aria-hidden="true" />Sudden Wind Shift</span><small>Test a sudden change in wind direction and speed</small></div><button type="button" className={`switch ${controls.suddenShift ? 'on' : ''}`} aria-label="Toggle sudden wind shift" aria-pressed={Boolean(controls.suddenShift)} onClick={() => setControl('suddenShift', !controls.suddenShift)} /></div>
            {controls.suddenShift && <div className="shift-fields"><label>New Wind Direction<select aria-label="New wind direction" value={shiftDirection} onChange={(event) => setShiftDirection(Number(event.currentTarget.value))}>{directionOptions.map(([degrees, label]) => <option value={degrees} key={degrees}>{label}</option>)}</select></label><label>New Wind Speed<select aria-label="New wind speed" value={shiftSpeed} onChange={(event) => setShiftSpeed(Number(event.currentTarget.value))}><option value={4}>4.0 m/s</option><option value={6}>6.0 m/s</option><option value={8}>8.0 m/s</option><option value={10}>10.0 m/s</option></select></label></div>}
          </div>
          <div className="sim-actions">
            <button type="button" className="cta-button" onClick={() => void apply()} disabled={isApplying} aria-busy={isApplying}><span className="cta-icon">{isApplying ? <LoaderCircle size={16} className="applying-icon" /> : <span className="play-disc">▶</span>}</span>{isApplying ? 'Applying…' : 'Apply Changes'}</button>
            <button type="button" className="reset-sim" onClick={toggleRunning} aria-label={running ? 'Pause simulation' : 'Resume simulation'}>{running ? 'Pause' : 'Resume'}</button>
          </div>
          <p className={`apply-feedback ${isApplying ? 'is-applying' : ''}`} role="status" aria-live="polite">{applyFeedback || (running ? 'Values update as you adjust controls.' : 'Paused · changes apply when confirmed.')}</p>
        </aside>

        <section className="sim-center" aria-label="Modeled site visualization and charts">
          <div className="sim-map-panel"><DustMap
            intensity={Math.min(100, Math.max(0, controls.dustIntensity + activeInput.windSpeed * 1.4 - controls.humidity * 0.12))}
            windSpeed={activeInput.windSpeed}
            windDirection={activeInput.windDirection}
            activeZone={prediction.activeZone}
            mistingActive={prediction.mistingActive}
            readings={readings}
            hotReadingIndex={hotReadingIndex}
            escapeDirection={prediction.risk === 'LOW' ? undefined : prediction.escapeDirection}
            problem={prediction.risk === 'HIGH'}
            problemLabel="HIGH MODELED ESCAPE RISK"
            plumeLength={prediction.plumeLength}
          /></div>
          <div className="sim-bottom-charts">
            <article className="sim-chart-card"><div className="sim-chart-title"><span><Activity size={16} aria-hidden="true" /> PM2.5 Boundary Scenario</span><div className="chart-legend"><span><i />With DustTwin</span><span><i className="baseline" />Untreated scenario</span></div></div><BoundaryLineChart data={prediction.chart} /></article>
            <article className="sim-chart-card"><div className="sim-chart-title"><span><BarChart3 size={16} aria-hidden="true" /> Strategy Comparison</span><small>Modeled PM2.5 · µg/m³</small></div><ComparisonBars data={strategyData} keys={['baseline', 'continuous', 'reactive', 'predictive']} compact /></article>
          </div>
        </section>

        <aside className="sim-panel analytics-panel" aria-label="Live scenario analytics">
          <h2><BarChart3 aria-hidden="true" />Live Analytics</h2>
          <p className="analytics-disclaimer">Deterministic demo estimates · not field measurements</p>
          <div className="analytics-grid">
            <MetricTile icon={<Gauge />} title="Projected PM2.5" value={`${prediction.pm25} μg/m³`} detail={`${pm25Reduction}% below untreated scenario`} tone="cyan" sparkBase={prediction.pm25} />
            <MetricTile icon={<Activity />} title="Projected PM10" value={`${prediction.pm10} μg/m³`} detail={`${pm10Reduction}% below untreated scenario`} sparkBase={prediction.pm10} />
            <MetricTile icon={<ShieldCheck />} title="Boundary Risk" value={prediction.risk} detail={`${prediction.boundaryRisk}% modeled risk index`} tone={prediction.risk === 'LOW' ? 'green' : prediction.risk === 'HIGH' ? 'orange' : 'yellow'}><div className={`risk-meter risk-meter-${prediction.risk.toLowerCase()}`}><span style={{ width: `${prediction.boundaryRisk}%` }} /></div></MetricTile>
            <MetricTile icon={<LocateFixed />} title="Predicted Escape Zone" value={modeledEscape} detail={prediction.risk === 'LOW' ? 'Below the misting threshold' : `Downwind · ${prediction.escapeDirection}`} tone={prediction.risk === 'HIGH' ? 'orange' : ''} />
            <MetricTile icon={<Droplets />} title="Misting Response" value={prediction.mistingActive ? prediction.activeZone : 'Standby'} detail={prediction.mistingActive ? 'Targeted zone selected by wind direction' : 'No zone needed at current risk'} tone={prediction.mistingActive ? 'cyan' : ''}><span className={`status-pill ${prediction.mistingActive ? '' : 'status-standby'}`}><i />{prediction.mistingActive ? 'ACTIVE' : 'STANDBY'}</span></MetricTile>
            <MetricTile icon={<Clock3 />} title="Lead Time Estimate" value={prediction.leadTime ? `${prediction.leadTime} min` : '—'} detail={prediction.leadTime ? 'Modeled warning before boundary exposure' : 'No threshold event predicted'} />
            <MetricTile icon={<Droplets />} title="Water Use Estimate" value={`${prediction.waterUsage.toLocaleString()} L/day`} detail={prediction.mistingActive ? 'Scenario projection · active misting' : 'No modeled misting demand'} tone={prediction.mistingActive ? 'cyan' : ''} />
            <MetricTile icon={<Activity />} title="Control Decision" value={prediction.mistingActive ? 'MISTING ON' : 'MONITOR'} detail="Fixed PM2.5 thresholds · no ML" tone={prediction.mistingActive ? 'green' : ''}><div className="system-status-list"><span><i />Thresholds {prediction.risk === 'HIGH' ? '≥ 75' : prediction.risk === 'MODERATE' ? '≥ 40' : '< 40'} μg/m³</span><span><i />Wind sector · {directionLabel(activeInput.windDirection)}</span></div></MetricTile>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CompassIcon() { return <LocateFixed aria-hidden="true" />; }
