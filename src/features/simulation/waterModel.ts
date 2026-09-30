import {
  HIGH_FLOW_LPM,
  LOW_FLOW_LPM,
  MAX_ACTIVE_ZONES,
  MAX_FLOW_LPM,
  MODERATE_FLOW_LPM,
  NOZZLES_PER_ZONE,
  PUMP_FLOW_RATE_LPM,
} from '../../config/waterSystemConfig';
import type { RiskStatus, ZoneId } from './simulationTypes';

const clampCount = (count: number) => Math.min(MAX_ACTIVE_ZONES, Math.max(0, Math.floor(count)));

/**
 * Variable misting flow rate per active zone based on suppression level demand.
 * LOW: 0.25 L/min
 * MODERATE: 0.50 L/min
 * HIGH: 0.75 L/min
 * VERY HIGH: 1.00 L/min
 */
export function getRequiredFlowPerZone(risk: RiskStatus): number {
  switch (risk) {
    case 'LOW':
      return 0;
    case 'MODERATE':
      return MODERATE_FLOW_LPM;
    case 'HIGH':
      return HIGH_FLOW_LPM;
    case 'VERY HIGH':
      return MAX_FLOW_LPM;
    default:
      return MODERATE_FLOW_LPM;
  }
}

/**
 * Returns total system flow for the currently active zones and per-zone flow rate.
 */
export function calculateFlowRateLpm(
  activeZoneCount: number,
  flowPerZone: number = MODERATE_FLOW_LPM,
): number {
  const count = clampCount(activeZoneCount);
  if (count <= 0) return 0;
  return Math.min(PUMP_FLOW_RATE_LPM, count * flowPerZone);
}

/**
 * Rule-based misting duration estimate for a given scenario:
 * MODERATE: 30 sec
 * HIGH: 60 sec
 * VERY HIGH: 90 sec
 */
export function estimateMistingDurationSeconds(
  risk: RiskStatus,
  _peakPm25 = 0,
  _dustIntensity = 0,
): number {
  switch (risk) {
    case 'LOW':
      return 0;
    case 'MODERATE':
      return 30;
    case 'HIGH':
      return 60;
    case 'VERY HIGH':
      return 90;
    default:
      return 0;
  }
}

/**
 * Standard engineering formula:
 * Water Used = Flow Rate Per Zone × Number of Active Zones × Misting Duration (in minutes)
 * Example: 0.50 L/min × 2 zones × (30 / 60) min = 0.50 L
 */
export function calculateWaterUseL(
  activeZoneCount: number,
  activeSeconds: number,
  flowPerZone: number = MODERATE_FLOW_LPM,
): number {
  const count = clampCount(activeZoneCount);
  const safeSeconds = Math.max(0, activeSeconds);
  if (count <= 0 || safeSeconds <= 0) return 0;
  return flowPerZone * count * (safeSeconds / 60);
}

export function calculateWaterForZonesL(
  zones: readonly ZoneId[],
  activeMinutes: number,
  flowPerZone: number = MODERATE_FLOW_LPM,
): number {
  return calculateWaterUseL(zones.length, Math.max(0, activeMinutes) * 60, flowPerZone);
}

export function calculateActiveNozzles(activeZoneCount: number): number {
  return clampCount(activeZoneCount) * NOZZLES_PER_ZONE;
}

export function formatSimulationDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
