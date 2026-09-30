import {
  MAX_ACTIVE_ZONES,
  NOZZLES_PER_ZONE,
  NOZZLE_FLOW_RATE_LPM,
  PUMP_FLOW_RATE_LPM,
} from '../../config/waterSystem';
import type { ZoneId } from './simulationTypes';

const clampCount = (count: number) => Math.min(MAX_ACTIVE_ZONES, Math.max(0, Math.floor(count)));

/** Returns actual configured system flow for the currently active zone count. */
export function calculateFlowRateLpm(activeZoneCount: number): number {
  const activeNozzles = clampCount(activeZoneCount) * NOZZLES_PER_ZONE;
  return Math.min(PUMP_FLOW_RATE_LPM, activeNozzles * NOZZLE_FLOW_RATE_LPM);
}

/** L = configured L/min × elapsed minutes; pause/reset are handled by the run-state reducer. */
export function calculateWaterUseL(activeZoneCount: number, activeSeconds: number): number {
  const safeSeconds = Math.max(0, activeSeconds);
  return calculateFlowRateLpm(activeZoneCount) * (safeSeconds / 60);
}

export function calculateWaterForZonesL(zones: readonly ZoneId[], activeMinutes: number): number {
  return calculateWaterUseL(zones.length, Math.max(0, activeMinutes) * 60);
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
