import {
  HIGH_FLOW_LPM,
  LOW_FLOW_LPM,
  MAX_ACTIVE_ZONES,
  MAX_FLOW_LPM,
  MODERATE_FLOW_LPM,
  NOZZLES_PER_ZONE,
} from '../../config/waterSystemConfig';
import {
  AMBIENT_PM25_UG_M3,
  PM25_MODERATE_THRESHOLD,
  SENSOR_RELEASE_THRESHOLD_PM25,
  STRATEGY_LABELS,
  ZONE_TO_BOUNDARY,
} from './simulationConfig';
import {
  advanceSensorReadings,
  createInitialReadings,
  derivePm10,
  getRiskStatus,
  getSensorBaseline,
  getSensorReadings,
} from './sensorModel';
import { getPlumeEstimate, normalizeBearing } from './plumeModel';
import {
  formatBoundaryList,
  getHighestRisk,
  getPredictedBoundaries,
  getPredictiveZonesWithFeedback,
  getPrimaryBoundary,
  getZonesForStrategy,
} from './zoneLogic';
import {
  calculateActiveNozzles,
  calculateFlowRateLpm,
  calculateWaterUseL,
  estimateMistingDurationSeconds,
  getRequiredFlowPerZone,
} from './waterModel';
import { calculateCombinedRisk, type RiskBreakdown } from './riskModel';
import type {
  BoundaryId,
  ControlStrategy,
  SensorReading,
  SimulationInput,
  SimulationPrediction,
  SimulationRunState,
  ZoneId,
} from './simulationTypes';
import type { BoundaryTrendPoint } from './BoundaryTrendChart';

const round = (value: number) => Math.round(value);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const defaultInput: SimulationInput = Object.freeze({
  dustIntensity: 70,
  windSpeed: 4.2,
  windDirection: 315,
  temperatureC: 28,
  humidity: 45,
});

export function directionLabel(degrees: number): string {
  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return labels[round(normalizeBearing(degrees) / 45) % labels.length];
}

export function normalizeSimulationInput(input: SimulationInput): SimulationInput {
  return {
    dustIntensity: clamp(input.dustIntensity, 0, 100),
    windSpeed: clamp(input.windSpeed, 0, 10),
    windDirection: normalizeBearing(input.windDirection),
    humidity: clamp(input.humidity, 0, 100),
    temperatureC: clamp(input.temperatureC, 10, 50),
  };
}

export function createInitialSimulationReadings(input: SimulationInput = defaultInput) {
  return createInitialReadings(normalizeSimulationInput(input));
}

function maximumBy<T>(items: readonly T[], getValue: (item: T) => number): number {
  if (!items.length) return 0;
  return Math.max(...items.map(getValue));
}

function buildChart(
  currentPm25: number,
  noControlForecastPm25: number,
  projectedPm25: number,
): SimulationPrediction['chart'] {
  return Array.from({ length: 9 }, (_, index) => {
    const fraction = index / 8;
    const baseline = currentPm25 + (noControlForecastPm25 - currentPm25) * fraction;
    const twin = currentPm25 + (projectedPm25 - currentPm25) * (1 - Math.exp(-2.3 * fraction));
    return {
      time: `${index} min`,
      twin: round(clamp(twin, 0, 300)),
      baseline: round(clamp(baseline, 0, 300)),
    };
  });
}

/**
 * Deterministic explanation of the scenario result for judges and operators.
 */
function buildDecision(
  input: SimulationInput,
  strategy: ControlStrategy,
  riskBreakdown: RiskBreakdown,
  highestSensor: SensorReading | null,
  activeZoneIds: readonly ZoneId[],
  predictedBoundaries: readonly BoundaryId[],
  flowPerZoneLpm: number,
  leadTimeSeconds: number | null,
): { decision: string; reasons: string[] } {
  const zoneNames = activeZoneIds.map((zone) => `Zone ${zone}`).join(', ');
  const boundaryNames = formatBoundaryList(predictedBoundaries);
  const dustLevel = input.dustIntensity >= 75 ? 'high' : input.dustIntensity >= 40 ? 'moderate' : 'low';
  const flowLabel =
    flowPerZoneLpm >= 1.00 ? 'maximum' : flowPerZoneLpm >= 0.75 ? 'high' : flowPerZoneLpm >= 0.50 ? 'moderate' : 'low';

  const reasons: string[] = [
    `Dust source intensity is ${dustLevel} at ${input.dustIntensity}%; wind (${input.windSpeed.toFixed(1)} m/s toward ${directionLabel(input.windDirection)}) carries plume toward ${boundaryNames || 'site boundaries'}.`,
    highestSensor
      ? `${highestSensor.sensorName} has the highest predicted PM at ${highestSensor.pm25} µg/m³ PM2.5 (moderate threshold: ${PM25_MODERATE_THRESHOLD} µg/m³).`
      : 'Boundary sensors monitor PM2.5 and derived PM10 readings across all quadrants.',
    leadTimeSeconds !== null
      ? `Boundary threshold exceedance predicted in ${leadTimeSeconds < 60 ? `${leadTimeSeconds} s` : `${(leadTimeSeconds / 60).toFixed(1)} min`} before dust escape.`
      : 'No boundary threshold exceedance predicted under current scenario conditions.',
    activeZoneIds.length
      ? strategy === 'continuous'
        ? 'Continuous suppression running across all four zones (A, B, C, D).'
        : `Targeted suppression activated for ${zoneNames}; unaffected boundaries remain on standby.`
      : 'Misting is on standby; no suppression zone is active.',
    activeZoneIds.length
      ? `${flowLabel.charAt(0).toUpperCase() + flowLabel.slice(1)} flow (${flowPerZoneLpm.toFixed(2)} L/min per zone) selected based on ${riskBreakdown.status} risk to conserve water.`
      : 'Water flow is 0.00 L/min to prevent unnecessary water usage.',
  ];

  let decision = 'Misting standby — risk below boundary threshold.';
  if (strategy === 'continuous') {
    decision = 'Continuous suppression — all four zones are spraying.';
  } else if (strategy === 'noControl') {
    decision = 'Monitoring only — suppression is disabled.';
  } else if (activeZoneIds.length > 0) {
    decision = `Targeted suppression — ${zoneNames} activated ahead of boundary risk.`;
  }

  return { decision, reasons };
}

/**
 * Generates deterministic 0s - 60s scenario projection points for the Boundary PM Trend chart.
 * Replaces live ticking with an explainable physical scenario model.
 */
export function generateScenarioTrendPoints(
  sensors: readonly SensorReading[],
  activeZoneIds: readonly ZoneId[],
): BoundaryTrendPoint[] {
  const activeBoundaries = new Set(activeZoneIds.map((zone) => ZONE_TO_BOUNDARY[zone]));
  const timeSteps = [0, 10, 20, 30, 40, 60];

  return timeSteps.map((seconds) => {
    const readings = {} as BoundaryTrendPoint['readings'];
    for (const sensor of sensors) {
      const isMisting = activeBoundaries.has(sensor.id);
      let pm25 = sensor.forecastPm25;
      if (isMisting) {
        // Exponential knockdown under active misting
        const targetPm = AMBIENT_PM25_UG_M3 + (sensor.forecastPm25 - AMBIENT_PM25_UG_M3) * 0.24;
        pm25 = Math.round(targetPm + (sensor.forecastPm25 - targetPm) * Math.exp(-0.065 * seconds));
      }
      readings[sensor.id] = {
        pm25,
        pm10: derivePm10(pm25),
      };
    }
    return {
      elapsedSeconds: seconds,
      label: `${seconds} sec`,
      readings,
      activeZoneIds: [...activeZoneIds],
    };
  });
}

/**
 * Single deterministic inference path for the simulation route.
 * Input-driven: evaluates once per scenario execution.
 */
export function predictSimulation(
  rawInput: SimulationInput,
  currentPm25: Record<BoundaryId, number> = createInitialSimulationReadings(rawInput),
  strategy: ControlStrategy = 'predictive',
  running = true,
  runState?: Partial<SimulationRunState>,
): SimulationPrediction {
  const input = normalizeSimulationInput(rawInput);
  const baseline = getSensorBaseline(input);
  const plume = getPlumeEstimate(input);

  // Raw forecast readings without misting to determine true boundary exposure
  const noControlReadings = getSensorReadings(input, baseline, []);
  const liveSensors = getSensorReadings(input, currentPm25, []);
  const peakBaselinePm25 = maximumBy(noControlReadings, (s) => s.forecastPm25);

  // Combined Multi-Factor Risk Calculation
  const riskBreakdown = calculateCombinedRisk(input, peakBaselinePm25);
  const risk = riskBreakdown.status;
  const riskIndex = riskBreakdown.score;

  // Boundary prediction: only predict if combined risk is above LOW
  const predictedBoundaries = risk === 'LOW' ? [] : getPredictedBoundaries(noControlReadings);
  const primaryBoundary = predictedBoundaries.length ? getPrimaryBoundary(noControlReadings) : null;

  // Zone selection based on control strategy and sensor feedback
  const feedback = strategy === 'predictive'
    ? (risk === 'LOW'
        ? { zoneIds: [] as ZoneId[], heldOffBoundaries: [] as BoundaryId[] }
        : getPredictiveZonesWithFeedback(predictedBoundaries, currentPm25, runState?.activeZoneIds ?? [], runState?.heldOffBoundaries ?? []))
    : {
        zoneIds: getZonesForStrategy(strategy, liveSensors, predictedBoundaries),
        heldOffBoundaries: runState?.heldOffBoundaries ?? [],
      };

  const selectedZones = feedback.zoneIds;
  const heldOffBoundaries = feedback.heldOffBoundaries;
  const activeZoneIds = running ? selectedZones.slice(0, MAX_ACTIVE_ZONES) : [];
  const activeBoundaryIds = activeZoneIds.map((zone) => ZONE_TO_BOUNDARY[zone]);

  // Boundary sensors under the current scenario strategy
  const sensors = getSensorReadings(input, currentPm25, activeBoundaryIds);

  // The most exposed / highest-risk boundary sensor
  const leadingSensor = sensors.find((s) => s.id === primaryBoundary)
    ?? sensors.reduce((max, s) => s.pm25 > max.pm25 ? s : max, sensors[0]);

  // Projected PM in Live Analytics MUST show the highest-risk boundary sensor reading
  const projectedPm25 = leadingSensor ? leadingSensor.pm25 : peakBaselinePm25;
  const projectedPm10 = leadingSensor ? leadingSensor.pm10 : derivePm10(projectedPm25);
  const baselinePm25 = peakBaselinePm25;
  const baselinePm10 = derivePm10(baselinePm25);
  const currentBoundaryPm25 = leadingSensor ? leadingSensor.pm25 : 8;
  const currentBoundaryPm10 = derivePm10(currentBoundaryPm25);

  // Prediction lead time based on physical plume transport speed to the exposed boundary
  const leadTimeSeconds = predictedBoundaries.length && plume.effectiveVelocityMps > 0 && leadingSensor
    ? Math.max(1, Math.round(leadingSensor.distanceM / plume.effectiveVelocityMps))
    : null;

  // Variable misting flow rate per active zone based on required suppression demand
  const flowPerZoneLpm = activeZoneIds.length > 0 ? getRequiredFlowPerZone(risk) : 0;
  const flowRateLpm = calculateFlowRateLpm(activeZoneIds.length, flowPerZoneLpm);
  const activeNozzles = calculateActiveNozzles(activeZoneIds.length);

  // Estimated misting duration and projected water use for this scenario
  const mistingSeconds = activeZoneIds.length > 0
    ? estimateMistingDurationSeconds(risk, baselinePm25, input.dustIntensity)
    : 0;
  const waterUsedL = calculateWaterUseL(activeZoneIds.length, mistingSeconds, flowPerZoneLpm);
  const elapsedSeconds = mistingSeconds;

  const { decision, reasons } = buildDecision(
    input,
    strategy,
    riskBreakdown,
    leadingSensor,
    activeZoneIds,
    predictedBoundaries,
    flowPerZoneLpm,
    leadTimeSeconds,
  );

  return {
    input,
    strategy,
    running,
    sensors,
    plume,
    risk,
    currentRisk: risk,
    riskIndex,
    predictedBoundaries,
    predictedEscapeBoundary: predictedBoundaries.length ? formatBoundaryList(predictedBoundaries) : 'None predicted',
    primaryBoundary,
    predictedZoneIds: selectedZones,
    activeZoneIds,
    heldOffBoundaries,
    projectedPm25,
    projectedPm10,
    baselinePm25,
    baselinePm10,
    currentBoundaryPm25,
    currentBoundaryPm10,
    leadTimeSeconds,
    waterUsedL,
    flowRateLpm,
    flowPerZoneLpm,
    activeNozzles,
    elapsedSeconds,
    mistingSeconds,
    decision,
    decisionReasons: reasons,
    chart: buildChart(currentBoundaryPm25, baselinePm25, projectedPm25),
  };
}

export interface AdvanceResult {
  state: SimulationRunState;
  prediction: SimulationPrediction;
}

export function advanceSimulation(
  previous: SimulationRunState,
  input: SimulationInput,
  strategy: ControlStrategy,
  seconds = 1,
): AdvanceResult {
  if (!previous.running || seconds <= 0) {
    return {
      state: previous,
      prediction: predictSimulation(input, previous.currentPm25, strategy, previous.running, previous),
    };
  }

  const beforeStep = predictSimulation(input, previous.currentPm25, strategy, true, previous);
  const safeSeconds = Math.min(60, seconds);
  const nextCurrentPm25 = advanceSensorReadings(
    normalizeSimulationInput(input),
    previous.currentPm25,
    beforeStep.activeZoneIds.map((zone) => ZONE_TO_BOUNDARY[zone]),
    safeSeconds,
  );
  const flowPerZone = getRequiredFlowPerZone(beforeStep.risk);
  const waterIncrement = calculateWaterUseL(beforeStep.activeZoneIds.length, safeSeconds, flowPerZone);
  const state: SimulationRunState = {
    running: true,
    elapsedSeconds: previous.elapsedSeconds + safeSeconds,
    mistingSeconds: previous.mistingSeconds + (beforeStep.activeZoneIds.length ? safeSeconds : 0),
    waterUsedL: previous.waterUsedL + waterIncrement,
    currentPm25: nextCurrentPm25,
    activeZoneIds: beforeStep.activeZoneIds,
    heldOffBoundaries: beforeStep.heldOffBoundaries,
  };

  return { state, prediction: predictSimulation(input, state.currentPm25, strategy, true, state) };
}

export function createInitialRunState(input: SimulationInput = defaultInput): SimulationRunState {
  return {
    running: true,
    elapsedSeconds: 0,
    mistingSeconds: 0,
    waterUsedL: 0,
    currentPm25: createInitialSimulationReadings(input),
    activeZoneIds: [],
    heldOffBoundaries: [],
  };
}

export function resetRunState(input: SimulationInput = defaultInput): SimulationRunState {
  return createInitialRunState(input);
}
