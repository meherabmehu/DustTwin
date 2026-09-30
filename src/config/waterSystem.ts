/**
 * Prototype water hardware assumptions. Keep water estimates traceable to these values.
 * Replace with measured prototype flow rate after hardware calibration.
 */
export const NOZZLE_FLOW_RATE_LPM = 0.5;
export const NOZZLES_PER_ZONE = 1;
export const PUMP_FLOW_RATE_LPM = 2.5;
export const MAX_ACTIVE_ZONES = 4;

/** Shared, fixed comparison window so strategy water estimates are comparable. */
export const STRATEGY_COMPARISON_WINDOW_MIN = 8;
