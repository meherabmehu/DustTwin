/**
 * Prototype water hardware and variable suppression configuration.
 * Traceable engineering values for prototype demonstration.
 * Configurable flow rates per active zone based on suppression demand.
 */
export const LOW_FLOW_LPM = 0.25;
export const MODERATE_FLOW_LPM = 0.50;
export const HIGH_FLOW_LPM = 0.75;
export const MAX_FLOW_LPM = 1.00;
export const NOZZLES_PER_ZONE = 1;
export const PUMP_FLOW_RATE_LPM = 4.00;
export const MAX_ACTIVE_ZONES = 4;

/** Shared, fixed comparison window so strategy water estimates are comparable. */
export const STRATEGY_COMPARISON_WINDOW_MIN = 8;
