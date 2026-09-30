import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import '../features/simulation/simulationPage.css';
import {
  Activity,
  BarChart3,
  CircleHelp,
  Clock3,
  CloudFog,
  Droplets,
  Gauge,
  LocateFixed,
  LoaderCircle,
  Play,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Thermometer,
  Wind,
  Zap,
} from 'lucide-react';
import { Eyebrow } from '../components/SiteChrome';
import SimulationMap from '../features/simulation/SimulationMap';
import BoundaryTrendChart from '../features/simulation/BoundaryTrendChart';
import type { TrendPollutant } from '../features/simulation/BoundaryTrendChart';
import StrategyComparisonChart from '../features/simulation/StrategyComparisonChart';
import type { StrategyMetric } from '../features/simulation/StrategyComparisonChart';
import { calculateStrategyComparison } from '../features/simulation/strategyComparison';
import {
  defaultInput,
  directionLabel,
  generateScenarioTrendPoints,
  predictSimulation,
} from '../features/simulation/simulationEngine';
import type {
  BoundaryId,
  ControlStrategy,
  PollutantView,
  SimulationInput,
  SimulationPrediction,
} from '../features/simulation/simulationTypes';

const directionOptions = [
  [0, 'N (0°)'], [45, 'NE (45°)'], [90, 'E (90°)'], [135, 'SE (135°)'],
  [180, 'S (180°)'], [225, 'SW (225°)'], [270, 'W (270°)'], [315, 'NW (315°)'],
] as const;

const strategyOptions: Array<{ value: ControlStrategy; label: string }> = [
  { value: 'noControl', label: 'No Control' },
  { value: 'continuous', label: 'Continuous' },
  { value: 'reactive', label: 'Reactive' },
  { value: 'predictive', label: 'DustTwin Predictive' },
];

const sensorColors: Record<BoundaryId, string> = {
  north: '#45e4a2',
  east: '#37c7f3',
  south: '#f3c64e',
  west: '#ff5969',
};

const sensorShortName: Record<BoundaryId, string> = {
  north: 'N', east: 'E', south: 'S', west: 'W',
};

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

function MetricTile({
  icon,
  title,
  value,
  detail,
  tone = '',
  children,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  detail?: string;
  tone?: string;
  children?: ReactNode;
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

function RangeControl({
  icon,
  label,
  value,
  displayValue,
  min,
  max,
  step,
  ariaLabel,
  ticks,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  displayValue: string;
  min: number;
  max: number;
  step: number;
  ariaLabel: string;
  ticks: string[];
  onChange: (value: number) => void;
}) {
  return (
    <div className="control-group sim-range-control">
      <div className="control-heading">
        <div className="control-label">{icon}<span>{label}</span></div>
        <output className="control-heading-value">{displayValue}</output>
      </div>
      <div className="range-row">
        <input
          aria-label={ariaLabel}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
        />
      </div>
      <div className="range-scale">
        {ticks.map((tick) => <span key={tick}>{tick}</span>)}
      </div>
    </div>
  );
}

export default function Simulation() {
  // Draft user controls (change as user moves sliders, but do NOT trigger recomputation until applied)
  const [controls, setControls] = useState<SimulationInput>({ ...defaultInput });
  const [presetSelection, setPresetSelection] = useState<'construction' | 'custom'>('construction');
  const [shiftEnabled, setShiftEnabled] = useState(false);
  const [shiftDirection, setShiftDirection] = useState(90);
  const [shiftSpeed, setShiftSpeed] = useState(8);
  const [strategy, setStrategy] = useState<ControlStrategy>('predictive');

  // Applied scenario state (only changes on Apply Changes, Run Scenario, Reset, or manual Shift trigger)
  const [appliedInput, setAppliedInput] = useState<SimulationInput>({ ...defaultInput });
  const [appliedStrategy, setAppliedStrategy] = useState<ControlStrategy>('predictive');
  const [prediction, setPrediction] = useState<SimulationPrediction>(() =>
    predictSimulation(defaultInput, undefined, 'predictive'),
  );
  const [trendHistory, setTrendHistory] = useState(() =>
    generateScenarioTrendPoints(
      predictSimulation(defaultInput, undefined, 'predictive').sensors,
      predictSimulation(defaultInput, undefined, 'predictive').activeZoneIds,
    ),
  );

  const [mapView, setMapView] = useState<PollutantView>('combined');
  const [trendPollutant, setTrendPollutant] = useState<TrendPollutant>('pm25');
  const [comparisonMetric, setComparisonMetric] = useState<StrategyMetric>('pm25');
  const [isApplying, setIsApplying] = useState(false);
  const [applyFeedback, setApplyFeedback] = useState('');
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [hasCalculated, setHasCalculated] = useState(false);

  // Strategy comparison is deterministic and based strictly on the current applied scenario
  const strategyResults = calculateStrategyComparison(prediction);

  const localTime = lastUpdated.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const activeZonesLabel = prediction.activeZoneIds.length
    ? prediction.activeZoneIds.map((zone) => `Zone ${zone}`).join(' · ')
    : 'None';

  const forecastSensorRows = prediction.predictedBoundaries
    .map((boundary) => prediction.sensors.find((sensor) => sensor.id === boundary))
    .filter((sensor) => sensor !== undefined);

  const leadingSensor = (prediction.primaryBoundary
    ? prediction.sensors.find((sensor) => sensor.id === prediction.primaryBoundary)
    : undefined) ?? forecastSensorRows[0] ?? prediction.sensors[0];

  const setControl = <K extends keyof SimulationInput>(key: K, value: SimulationInput[K]) => {
    setApplyFeedback('');
    setPresetSelection('custom');
    setControls((previous) => ({ ...previous, [key]: value }));
  };

  /**
   * Main scenario calculation execution path.
   * Deterministically calculates outputs and holds them stable.
   */
  const executeScenario = (
    nextInput: SimulationInput,
    nextStrategy: ControlStrategy,
    feedbackNote = '',
  ) => {
    setIsApplying(true);
    setApplyFeedback('');

    setTimeout(() => {
      const nextPrediction = predictSimulation(nextInput, undefined, nextStrategy);
      setAppliedInput(nextInput);
      setAppliedStrategy(nextStrategy);
      setPrediction(nextPrediction);
      setTrendHistory(generateScenarioTrendPoints(nextPrediction.sensors, nextPrediction.activeZoneIds));
      setLastUpdated(new Date());
      setHasCalculated(true);
      setIsApplying(false);

      const zoneText = nextPrediction.activeZoneIds.length
        ? `${nextPrediction.activeZoneIds.length} zone${nextPrediction.activeZoneIds.length === 1 ? '' : 's'} active`
        : 'misting standby';
      setApplyFeedback(feedbackNote || `${nextPrediction.risk} forecast · ${zoneText}`);
    }, 80);
  };

  const applyChanges = () => {
    const activeInput = shiftEnabled
      ? { ...controls, windDirection: shiftDirection, windSpeed: shiftSpeed }
      : controls;
    executeScenario(activeInput, strategy);
  };

  const loadConstructionPreset = () => {
    setControls({ ...defaultInput });
    setShiftEnabled(false);
    setShiftDirection(90);
    setShiftSpeed(8);
    setStrategy('predictive');
    setPresetSelection('construction');
    executeScenario(defaultInput, 'predictive', 'Construction Dust Event loaded.');
  };

  const resetAll = () => {
    setControls({ ...defaultInput });
    setPresetSelection('construction');
    setShiftEnabled(false);
    setShiftDirection(90);
    setShiftSpeed(8);
    setStrategy('predictive');
    setMapView('combined');
    setTrendPollutant('pm25');
    setComparisonMetric('pm25');
    executeScenario(defaultInput, 'predictive', 'Reset to initial default scenario.');
  };

  const toggleShift = () => {
    const nextShiftState = !shiftEnabled;
    setShiftEnabled(nextShiftState);
    setPresetSelection('custom');
    const nextInput = nextShiftState
      ? { ...controls, windDirection: shiftDirection, windSpeed: shiftSpeed }
      : controls;
    executeScenario(
      nextInput,
      strategy,
      nextShiftState
        ? `Sudden shift applied: ${shiftSpeed} m/s toward ${directionLabel(shiftDirection)}`
        : 'Sudden wind shift cleared.',
    );
  };

  const updateMapView = (view: PollutantView) => {
    setMapView(view);
    if (view === 'pm25' || view === 'pm10') setTrendPollutant(view);
  };

  const mistingIsOn = prediction.flowRateLpm > 0 && prediction.activeZoneIds.length > 0;
  const decisionTitle = appliedStrategy === 'continuous'
    ? 'Continuous suppression — all four zones'
    : prediction.activeZoneIds.length
      ? `Targeted suppression — ${activeZonesLabel}`
      : prediction.decision;

  return (
    <div className="simulation-page">
      <section className="simulation-intro" aria-label="Simulation overview">
        <div className="sim-title">
          <Eyebrow>DETERMINISTIC SIMULATION <span>FOR CLEANER, SAFER COMMUNITIES</span></Eyebrow>
          <h1>Live Digital Twin Simulation</h1>
          <p>
            Adjust environmental conditions and see how DustTwin predicts dust movement and activates
            targeted misting response in real time.
          </p>
        </div>
        <div className="sim-intro-card">
          <span><Wind aria-hidden="true" /></span>
          <div>
            <small>Wind Speed</small>
            <strong>{appliedInput.windSpeed.toFixed(1)} m/s</strong>
            <p>{directionLabel(appliedInput.windDirection)} ({appliedInput.windDirection}°)</p>
          </div>
        </div>
        <div className="sim-intro-card">
          <span><Thermometer aria-hidden="true" /></span>
          <div>
            <small>Temperature</small>
            <strong>{appliedInput.temperatureC}°C</strong>
            <p>Modeled ambient</p>
          </div>
        </div>
        <div className="sim-intro-card">
          <span><Droplets aria-hidden="true" /></span>
          <div>
            <small>Humidity</small>
            <strong>{appliedInput.humidity}% RH</strong>
            <p>Relative humidity</p>
          </div>
        </div>
        <div className="sim-intro-card">
          <span><Clock3 aria-hidden="true" /></span>
          <div>
            <small>Last Calculation</small>
            <strong>{localTime}</strong>
            <p>Scenario updated · input-driven</p>
          </div>
        </div>
        <div className="sim-intro-card model-state-card">
          <span><Activity aria-hidden="true" /></span>
          <div>
            <small>Model State</small>
            <strong>Digital Twin</strong>
            <p className="sim-state-text running">
              <i />{hasCalculated ? 'SCENARIO UPDATED' : 'READY'}
            </p>
          </div>
        </div>
      </section>

      <div className="simulation-dashboard">
        <aside className="sim-panel control-panel" aria-label="Simulation controls">
          <div className="panel-title-row">
            <h2><SlidersHorizontal aria-hidden="true" />Simulation Controls</h2>
            <div className="panel-title-actions">
              <button type="button" className="quiet-button" onClick={resetAll}>
                <RefreshCw size={13} aria-hidden="true" />Reset All
              </button>
            </div>
          </div>

          <div className="preset-row">
            <Zap aria-hidden="true" />
            <div className="preset-copy">
              <b>Construction Dust Event</b>
              <small>Quick scenario preset</small>
            </div>
            <select
              aria-label="Scenario preset"
              value={presetSelection}
              onChange={(event) =>
                event.currentTarget.value === 'construction'
                  ? loadConstructionPreset()
                  : setPresetSelection('custom')
              }
            >
              <option value="construction">Construction Dust Event</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <RangeControl
            icon={<CloudFog aria-hidden="true" />}
            label="Dust Source Intensity"
            value={controls.dustIntensity}
            displayValue={`${controls.dustIntensity}%`}
            min={0}
            max={100}
            step={1}
            ariaLabel="Dust source intensity"
            ticks={['0', '25', '50', '75', '100']}
            onChange={(value) => setControl('dustIntensity', value)}
          />

          <RangeControl
            icon={<Wind aria-hidden="true" />}
            label="Wind Speed"
            value={shiftEnabled ? shiftSpeed : controls.windSpeed}
            displayValue={`${(shiftEnabled ? shiftSpeed : controls.windSpeed).toFixed(1)} m/s`}
            min={0}
            max={10}
            step={0.1}
            ariaLabel="Wind speed"
            ticks={['0', '2', '4', '6', '8', '10']}
            onChange={(value) =>
              shiftEnabled
                ? (setPresetSelection('custom'), setShiftSpeed(value))
                : setControl('windSpeed', value)
            }
          />

          <div className="control-group direction-control">
            <div className="control-heading">
              <div className="control-label"><LocateFixed aria-hidden="true" /><span>Wind Direction</span></div>
              <output className="control-heading-value">
                {directionLabel(shiftEnabled ? shiftDirection : controls.windDirection)} ({shiftEnabled ? shiftDirection : controls.windDirection}°)
              </output>
            </div>
            <div className="direction-row">
              <select
                aria-label="Wind direction"
                value={shiftEnabled ? shiftDirection : controls.windDirection}
                onChange={(event) =>
                  shiftEnabled
                    ? (setPresetSelection('custom'), setShiftDirection(Number(event.currentTarget.value)))
                    : setControl('windDirection', Number(event.currentTarget.value))
                }
              >
                {directionOptions.map(([degrees, label]) => (
                  <option value={degrees} key={degrees}>{label}</option>
                ))}
              </select>
              <div
                className="compass-dial"
                style={{ '--compass': `${shiftEnabled ? shiftDirection : controls.windDirection}deg` } as CSSProperties}
                aria-hidden="true"
              >
                <span>➤</span><small>N</small>
              </div>
            </div>
          </div>

          <RangeControl
            icon={<Thermometer aria-hidden="true" />}
            label="Temperature"
            value={controls.temperatureC}
            displayValue={`${controls.temperatureC}°C`}
            min={10}
            max={50}
            step={1}
            ariaLabel="Temperature"
            ticks={['10', '20', '30', '40', '50']}
            onChange={(value) => setControl('temperatureC', value)}
          />

          <RangeControl
            icon={<Droplets aria-hidden="true" />}
            label="Humidity"
            value={controls.humidity}
            displayValue={`${controls.humidity}%`}
            min={0}
            max={100}
            step={1}
            ariaLabel="Humidity"
            ticks={['0', '20', '40', '60', '80', '100']}
            onChange={(value) => setControl('humidity', value)}
          />

          <div className="control-group strategy-control-group">
            <div className="control-heading">
              <div className="control-label"><ShieldCheck aria-hidden="true" /><span>Control Strategy</span></div>
              <span className="strategy-mode" aria-hidden="true">AUTO</span>
            </div>
            <select
              aria-label="Control strategy"
              value={strategy}
              onChange={(event) => {
                setStrategy(event.currentTarget.value as ControlStrategy);
                setPresetSelection('custom');
              }}
            >
              {strategyOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="control-group shift-control">
            <div className="toggle-line">
              <div>
                <span className="control-label"><Wind aria-hidden="true" /><span>Sudden Wind Shift</span></span>
                <small>Shift direction / speed</small>
              </div>
              <button
                type="button"
                className={`switch ${shiftEnabled ? 'on' : ''}`}
                aria-label="Toggle sudden wind shift"
                aria-pressed={shiftEnabled}
                onClick={toggleShift}
              />
            </div>
            {shiftEnabled && (
              <div className="shift-fields">
                <label>
                  New Direction
                  <select
                    aria-label="New wind direction"
                    value={shiftDirection}
                    onChange={(event) => setShiftDirection(Number(event.currentTarget.value))}
                  >
                    {directionOptions.map(([degrees, label]) => (
                      <option value={degrees} key={degrees}>{label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  New Speed
                  <select
                    aria-label="New wind speed"
                    value={shiftSpeed}
                    onChange={(event) => setShiftSpeed(Number(event.currentTarget.value))}
                  >
                    <option value={4}>4.0 m/s</option>
                    <option value={6}>6.0 m/s</option>
                    <option value={8}>8.0 m/s</option>
                    <option value={10}>10.0 m/s</option>
                  </select>
                </label>
              </div>
            )}
          </div>

          <div className="sim-actions">
            <button
              type="button"
              className="cta-button"
              onClick={applyChanges}
              disabled={isApplying}
              aria-busy={isApplying}
            >
              <span className="cta-icon">
                {isApplying ? <LoaderCircle size={15} className="applying-icon" /> : <span className="play-disc">▶</span>}
              </span>
              {isApplying ? 'Applying…' : 'Apply Changes'}
            </button>
            <button
              type="button"
              className="pause-action"
              onClick={applyChanges}
              disabled={isApplying}
              aria-label="Run Scenario"
              title="Run Scenario and calculate outputs"
            >
              <Play size={14} aria-hidden="true" />Run Scenario
            </button>
          </div>
          <span className="apply-feedback" role="status" aria-live="polite">{applyFeedback}</span>
        </aside>

        <section className="sim-center" aria-label="Live construction site map and charts">
          <div className="sim-map-panel">
            <SimulationMap
              prediction={prediction}
              input={appliedInput}
              view={mapView}
              onViewChange={updateMapView}
            />
          </div>

          <div className="sim-bottom-charts">
            <article className="sim-chart-card trend-chart-card" aria-label="Boundary particulate trend">
              <div className="chart-card-heading">
                <h3><Activity size={16} aria-hidden="true" />Boundary PM Trend</h3>
                <label className="chart-select-wrap">
                  <span className="sr-only">Trend pollutant</span>
                  <select
                    aria-label="Trend pollutant"
                    value={trendPollutant}
                    onChange={(event) => setTrendPollutant(event.currentTarget.value as TrendPollutant)}
                  >
                    <option value="pm25">PM2.5</option>
                    <option value="pm10">PM10</option>
                  </select>
                </label>
              </div>
              <div className="trend-legend" aria-label="Sensor line legend">
                {(['north', 'east', 'south', 'west'] as const).map((boundary) => (
                  <span key={boundary}>
                    <i style={{ background: sensorColors[boundary] }} />Sensor {sensorShortName[boundary]}
                  </span>
                ))}
                <span className="trend-active-key"><i />Misting active</span>
              </div>
              <BoundaryTrendChart data={trendHistory} pollutant={trendPollutant} />
            </article>
            <StrategyComparisonChart
              results={strategyResults}
              metric={comparisonMetric}
              onMetricChange={setComparisonMetric}
            />
          </div>
        </section>

        <aside className="sim-panel analytics-panel" aria-label="Live simulation analytics">
          <div className="analytics-heading">
            <h2><BarChart3 aria-hidden="true" />Live Analytics</h2>
            <p>Simulation estimates — not field measurements</p>
          </div>
          <div className="analytics-grid">
            <MetricTile
              icon={<Gauge />}
              title="Projected PM2.5"
              value={`${prediction.projectedPm25} µg/m³`}
              detail="Highest-risk boundary reading"
              tone="cyan"
            />
            <MetricTile
              icon={<Activity />}
              title="Projected PM10"
              value={`${prediction.projectedPm10} µg/m³`}
              detail="Highest-risk boundary · Derived (1.65×)"
            />
            <MetricTile
              icon={<ShieldCheck />}
              title="Boundary Risk"
              value={prediction.risk}
              detail={`Score ${prediction.riskIndex}/100 · ${prediction.risk === 'LOW' ? 'Below threshold' : 'Exceedance predicted'}`}
              tone={riskTone(prediction.risk)}
            >
              <div className={`risk-meter risk-meter-${prediction.risk.toLowerCase().replace(' ', '-')}`}>
                <span style={{ width: `${prediction.riskIndex}%` }} />
              </div>
            </MetricTile>
            <MetricTile
              icon={<LocateFixed />}
              title="Predicted Escape Zone"
              value={prediction.predictedEscapeBoundary}
              detail={
                prediction.primaryBoundary
                  ? `Sensor ${prediction.sensors.find((sensor) => sensor.id === prediction.primaryBoundary)?.label} most exposed`
                  : 'No threshold event forecast'
              }
              tone={prediction.risk === 'HIGH' || prediction.risk === 'VERY HIGH' ? 'orange' : ''}
            />
            <MetricTile
              icon={<Droplets />}
              title="Active Misting Zones"
              value={activeZonesLabel}
              detail={`${prediction.activeNozzles} active nozzle${prediction.activeNozzles === 1 ? '' : 's'}`}
              tone={prediction.activeZoneIds.length ? 'cyan' : ''}
            />
            <MetricTile
              icon={<Clock3 />}
              title="Prediction Lead Time"
              value={formatLeadTime(prediction.leadTimeSeconds)}
              detail={prediction.leadTimeSeconds ? 'Before threshold exceedance' : 'No boundary event predicted'}
            />
          </div>

          <section className="water-live-panel" aria-label="Water use, required flow, and estimated misting duration">
            <div className="water-panel-heading"><Droplets aria-hidden="true" /><span>Water Usage</span></div>
            <div className="water-panel-values">
              <div>
                <small>Required Flow</small>
                <strong>{prediction.flowRateLpm.toFixed(2)} L/min</strong>
                <span>{prediction.flowPerZoneLpm ? `${prediction.flowPerZoneLpm.toFixed(2)} L/min / zone` : 'Standby flow'}</span>
              </div>
              <div>
                <small>Estimated Misting Duration</small>
                <strong>{prediction.mistingSeconds} sec</strong>
                <span>Estimated burst</span>
              </div>
              <div>
                <small>Projected Water Use</small>
                <strong>{prediction.waterUsedL.toFixed(2)} L</strong>
                <span>Scenario projected use</span>
              </div>
            </div>
          </section>

          <div className={`analytics-decision-card ${mistingIsOn ? 'is-active' : ''}`} title={prediction.decision}>
            <small><ShieldCheck aria-hidden="true" />Control Decision</small>
            <strong><i />{mistingIsOn ? 'MISTING ON' : 'MISTING OFF'}</strong>
            <span>{decisionTitle}</span>
          </div>

          <div className="analytics-system-status">
            <div className="analytics-status-heading">
              <span><i className="is-running" />System Status</span>
              <b className="is-running">{hasCalculated ? 'SCENARIO CALCULATED' : 'READY'}</b>
            </div>
            <div><span>Strategy</span><strong>{strategyOptions.find((option) => option.value === appliedStrategy)?.label}</strong></div>
            <div>
              <span>Pump output</span>
              <strong className={prediction.flowRateLpm > 0 ? 'pump-on' : ''}>
                {prediction.flowRateLpm > 0 ? `MISTING (${prediction.flowRateLpm.toFixed(2)} L/min)` : 'OFF (0.00 L/min)'}
              </strong>
            </div>
          </div>

          <section className="why-decision" aria-label="Decision explanation">
            <h3><CircleHelp aria-hidden="true" />Why this decision?</h3>
            <ul>
              {prediction.decisionReasons.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
