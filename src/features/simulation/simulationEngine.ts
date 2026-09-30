import { MAX_ACTIVE_ZONES } from '../../config/waterSystem';
import { PM25_MODERATE_THRESHOLD, SENSOR_RELEASE_THRESHOLD_PM25, STRATEGY_LABELS, ZONE_TO_BOUNDARY } from './simulationConfig';
import { advanceSensorReadings, createInitialReadings, derivePm10, getSensorReadings } from './sensorModel';
import { getPlumeEstimate, normalizeBearing } from './plumeModel';
import { formatBoundaryList, getHighestRisk, getPredictedBoundaries, getPredictiveZonesWithFeedback, getPrimaryBoundary, getZonesForStrategy } from './zoneLogic';
import { calculateActiveNozzles, calculateFlowRateLpm, calculateWaterUseL } from './waterModel';
import type { BoundaryId, ControlStrategy, SimulationInput, SimulationPrediction, SimulationRunState, ZoneId } from './simulationTypes';

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

function buildDecision(
  strategy: ControlStrategy,
  running: boolean,
  activeZoneIds: readonly ZoneId[],
  predictedBoundaries: readonly BoundaryId[],
  heldOffBoundaries: readonly BoundaryId[],
): { decision: string; reasons: string[] } {
  const zoneNames = activeZoneIds.map((zone) => `Zone ${zone}`).join(', ');
  const boundaryNames = formatBoundaryList(predictedBoundaries);

  if (!running) {
    return {
      decision: 'Paused — pump and misting outputs are off.',
      reasons: ['The simulation clock is paused, so readings, active time, and water use are held.', 'Resume to continue the deterministic sensor and control loop.'],
    };
  }

  switch (strategy) {
    case 'noControl':
      return {
        decision: 'Monitoring only — suppression is disabled.',
        reasons: predictedBoundaries.length
          ? [`Forecast sensors show ${boundaryNames} at or above ${PM25_MODERATE_THRESHOLD} µg/m³ PM2.5.`, 'No Control keeps every misting zone off for comparison.']
          : [`All four forecast sensors are below ${PM25_MODERATE_THRESHOLD} µg/m³ PM2.5.`, 'No Control keeps every misting zone off.'],
      };
    case 'continuous':
      return {
        decision: 'Continuous response — all four zones are spraying.',
        reasons: ['Continuous strategy deliberately runs Zones A, B, C, and D while the simulation is running.', 'Water is accumulated from configured flow × active nozzles × elapsed misting time.'],
      };
    case 'reactive':
      return activeZoneIds.length
        ? {
          decision: `Reactive trigger — ${zoneNames} activated after sensor threshold exceedance.`,
          reasons: [`A live boundary sensor crossed the moderate threshold (${PM25_MODERATE_THRESHOLD} µg/m³ PM2.5).`, `${activeZoneIds.length} matching boundary zone${activeZoneIds.length === 1 ? '' : 's'} are active; other zones remain on standby.`],
        }
        : {
          decision: 'Reactive standby — waiting for a measured boundary threshold crossing.',
          reasons: [`Reactive control uses live sensor readings, not the wind-direction selection.`, `No current boundary sensor has crossed ${PM25_MODERATE_THRESHOLD} µg/m³ PM2.5.`],
        };
    case 'predictive':
    default:
      return activeZoneIds.length
        ? {
          decision: `Predictive response — targeting ${zoneNames} ahead of the forecast boundary risk.`,
          reasons: [
            `${boundaryNames} forecast at or above ${PM25_MODERATE_THRESHOLD} µg/m³ PM2.5 from the modeled plume and sensor readings.`,
            `${activeZoneIds.length} boundary-matched zone${activeZoneIds.length === 1 ? '' : 's'} selected; unaffected boundaries stay on standby.`,
            ...(heldOffBoundaries.length ? [`${formatBoundaryList(heldOffBoundaries)} zone feedback is on hold below ${SENSOR_RELEASE_THRESHOLD_PM25} µg/m³ until its live sensor re-crosses ${PM25_MODERATE_THRESHOLD} µg/m³.`] : []),
          ],
        }
        : heldOffBoundaries.length
          ? {
            decision: 'Predictive hold — live sensor feedback reached the misting release level.',
            reasons: [`${formatBoundaryList(heldOffBoundaries)} sensor feedback fell to ${SENSOR_RELEASE_THRESHOLD_PM25} µg/m³ PM2.5 or lower.`, `Those zones stay off until a live sensor rises to ${PM25_MODERATE_THRESHOLD} µg/m³; the plume forecast continues to be monitored.`],
          }
          : {
            decision: 'Predictive standby — no boundary threshold crossing is forecast.',
            reasons: [`All modeled boundary forecasts are below ${PM25_MODERATE_THRESHOLD} µg/m³ PM2.5.`, 'No misting zone is activated while the projected boundary risk is low.'],
          };
  }
}

/**
 * Single deterministic inference path for the simulation route. The service adapter delegates
 * here so a future ML/API predictor can replace this implementation without moving UI formulas.
 */
export function predictSimulation(
  rawInput: SimulationInput,
  currentPm25: Record<BoundaryId, number> = createInitialSimulationReadings(rawInput),
  strategy: ControlStrategy = 'predictive',
  running = true,
  runState?: Partial<SimulationRunState>,
): SimulationPrediction {
  const input = normalizeSimulationInput(rawInput);
  const noControlReadings = getSensorReadings(input, currentPm25, []);
  const predictedBoundaries = getPredictedBoundaries(noControlReadings);
  const predictedZoneIds = getZonesForStrategy('predictive', noControlReadings, predictedBoundaries);
  const feedback = strategy === 'predictive'
    ? getPredictiveZonesWithFeedback(predictedBoundaries, currentPm25, runState?.activeZoneIds ?? [], runState?.heldOffBoundaries ?? [])
    : { zoneIds: getZonesForStrategy(strategy, noControlReadings, predictedBoundaries), heldOffBoundaries: runState?.heldOffBoundaries ?? [] };
  const selectedZones = feedback.zoneIds.slice(0, MAX_ACTIVE_ZONES);
  const heldOffBoundaries = feedback.heldOffBoundaries;
  const activeZoneIds = running ? selectedZones : [];
  const activeBoundaryIds = activeZoneIds.map((zone) => ZONE_TO_BOUNDARY[zone]);
  const sensors = getSensorReadings(input, currentPm25, activeBoundaryIds);
  const plume = getPlumeEstimate(input);
  const risk = getHighestRisk(noControlReadings, true);
  const currentRisk = getHighestRisk(sensors, false);
  const baselinePm25 = maximumBy(sensors, (sensor) => sensor.forecastPm25);
  const baselinePm10 = derivePm10(baselinePm25);
  const projectedPm25 = maximumBy(sensors, (sensor) => sensor.projectedPm25);
  const projectedPm10 = derivePm10(projectedPm25);
  const currentBoundaryPm25 = maximumBy(sensors, (sensor) => sensor.pm25);
  const currentBoundaryPm10 = derivePm10(currentBoundaryPm25);
  const primaryBoundary = predictedBoundaries.length ? getPrimaryBoundary(noControlReadings) : null;
  const leadTimeSeconds = predictedBoundaries.length
    ? Math.max(1, Math.round(Math.min(...sensors.filter((sensor) => predictedBoundaries.includes(sensor.id)).map((sensor) => sensor.distanceM / plume.effectiveVelocityMps))))
    : null;
  const riskIndex = round(clamp((baselinePm25 / 150) * 100, 0, 100));
  const flowRateLpm = calculateFlowRateLpm(activeZoneIds.length);
  const activeNozzles = calculateActiveNozzles(activeZoneIds.length);
  const waterUsedL = Math.max(0, runState?.waterUsedL ?? 0);
  const elapsedSeconds = Math.max(0, runState?.elapsedSeconds ?? 0);
  const mistingSeconds = Math.max(0, runState?.mistingSeconds ?? 0);
  const { decision, reasons } = buildDecision(strategy, running, activeZoneIds, predictedBoundaries, heldOffBoundaries);

  return {
    input,
    strategy,
    running,
    sensors,
    plume,
    risk,
    currentRisk,
    riskIndex,
    predictedBoundaries,
    predictedEscapeBoundary: predictedBoundaries.length ? formatBoundaryList(predictedBoundaries) : 'None predicted',
    primaryBoundary,
    predictedZoneIds,
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
  const waterIncrement = calculateWaterUseL(beforeStep.activeZoneIds.length, safeSeconds);
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
