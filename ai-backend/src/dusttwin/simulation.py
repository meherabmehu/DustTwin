"""One common site plant; controllers see observations and their own past only."""

from copy import deepcopy
import hashlib
import json
import math

import numpy as np

STRATEGIES = ("no_control", "continuous", "reactive", "predictive")


def travel_bearing(wind_from: float) -> float:
    return (wind_from + 180) % 360


def directional_gain(wind_from: float, zones: list[dict]) -> np.ndarray:
    travel = travel_bearing(wind_from)
    return np.array([max(0, math.cos(math.radians(travel - zone["bearing_degrees"]))) ** 2 for zone in zones])


def crossing_status(current: np.ndarray, trajectory: np.ndarray, threshold: float) -> list[dict]:
    output = []
    for zone in range(len(current)):
        if current[zone] >= threshold:
            output.append({"status": "already_exceeded", "eta_seconds": 0})
        else:
            crossing = np.flatnonzero(trajectory[:, zone] >= threshold)
            output.append({"status": "future_crossing", "eta_seconds": int(crossing[0]) + 1} if len(crossing) else {"status": "no_crossing_within_horizon", "eta_seconds": None})
    return output


def make_environment(config: dict, case: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    times = np.arange(config["duration_seconds"] + 1)
    start, duration = config["activity_start_second"], config["activity_duration_seconds"]
    relative = times - start
    activity = np.where(relative < 0, 0.0, np.where(relative <= duration,
        np.minimum(relative / config["activity_ramp_seconds"], 1), np.exp(-(relative - duration) / config["source_decay_seconds"])))
    source = config["source_background_proxy_ug_m3"] + config["source_peak_increment_ug_m3"] * case["source_multiplier"] * activity
    wind = np.full(len(times), case["wind_from_degrees"], dtype=float)
    if "wind_shift_second" in case:
        wind[times >= case["wind_shift_second"]] = case["wind_after_from_degrees"]
    available = np.ones(len(times), dtype=bool)
    if "dropout_start_second" in case:
        available[(times >= case["dropout_start_second"]) & (times < case["dropout_end_second"])] = False
    return source, wind, available


def untreated_rollout(current: np.ndarray, source_past: list, wind_past: list, endpoint: float, config: dict) -> np.ndarray:
    # Only known past is supplied; no scenario timeline or future source enters here.
    response = math.exp(-1 / config["boundary_response_seconds"])
    contribution = np.maximum(0, current - config["ambient_pm10_ug_m3"])
    current_source, current_wind = source_past[-1], wind_past[-1]
    delays = [max(1, min(120, round(zone["distance_metres"] / config["wind_speed_metres_second"]))) for zone in config["zones"]]
    trajectory = []
    for future in range(1, config["forecast_horizon_seconds"] + 1):
        incoming = []
        for zone_index, delay in enumerate(delays):
            relative = future - delay
            if relative <= 0:
                source = source_past[relative - 1]
                wind = wind_past[relative - 1]
            else:
                source = current_source + (endpoint - current_source) * relative / config["forecast_horizon_seconds"]
                wind = current_wind
            incoming.append(source * config["transport_gain"] * directional_gain(wind, config["zones"])[zone_index])
        contribution = response * contribution + (1 - response) * np.array(incoming)
        trajectory.append(config["ambient_pm10_ug_m3"] + contribution.copy())
    return np.array(trajectory)


def controller_decision(strategy: str, observed: np.ndarray | None, source_past: list, wind_past: list,
                        active: np.ndarray, config: dict, model) -> tuple[np.ndarray, dict]:
    diagnostic = {"forecast_status": "not_used_by_strategy", "crossings": None, "trajectory": None,
                  "source_forecast_pm10_ug_m3": None, "risk_zones": [], "capacity_limited_zones": []}
    if strategy == "no_control":
        return np.zeros(4, dtype=bool), diagnostic
    if strategy == "continuous":
        return np.ones(4, dtype=bool), diagnostic
    if observed is None:
        diagnostic["forecast_status"] = "sensor_unavailable_safe_spray"
        return np.ones(4, dtype=bool), diagnostic
    on = observed >= config["boundary_setting_ug_m3"]
    keep_on = observed >= config["release_setting_ug_m3"]
    if strategy == "predictive":
        if model is not None and len(source_past) >= 121 and all(v is not None for v in source_past[-121:]) and all(v is not None for v in wind_past[-121:]):
            endpoint = float(model.predict_history(np.asarray(source_past[-121:])[None, :])[0])
            trajectory = untreated_rollout(observed, source_past[-121:], wind_past[-121:], endpoint, config)
            peaks = trajectory.max(axis=0)
            on |= peaks >= config["boundary_setting_ug_m3"]
            keep_on |= peaks >= config["release_setting_ug_m3"]
            diagnostic.update({"forecast_status": "learned_source_proxy_with_assumed_transport", "crossings": crossing_status(observed, trajectory, config["boundary_setting_ug_m3"]),
                               "trajectory": trajectory.tolist(), "source_forecast_pm10_ug_m3": endpoint,
                               "risk_zones": [zone["id"] for zone, risk in zip(config["zones"], on) if risk]})
        else:
            diagnostic["forecast_status"] = "source_history_unavailable_reactive_fallback"
    desired = np.where(active, keep_on, on)
    return desired, diagnostic


def run_strategy(config: dict, source: np.ndarray, wind: np.ndarray, available: np.ndarray, strategy: str, model=None) -> dict:
    if strategy not in STRATEGIES:
        raise ValueError("Unknown strategy")
    count = len(config["zones"])
    background = config["ambient_pm10_ug_m3"]
    contribution = np.zeros(count)
    active = np.zeros(count, dtype=bool)
    switched_at = np.full(count, -config["minimum_off_seconds"])
    commands_history = []
    source_past = [config["source_background_proxy_ug_m3"]] * 120
    wind_past = [float(wind[0])] * 120
    water, switches = 0.0, 0
    duty = np.zeros(count, dtype=int)
    response = math.exp(-1 / config["boundary_response_seconds"])
    delays = [max(1, min(120, round(zone["distance_metres"] / config["wind_speed_metres_second"]))) for zone in config["zones"]]
    traces = [{"second": 0, "pm10_ug_m3": [background] * count, "commands": [False] * count, "water_litres": 0.0,
               "data_available": bool(available[0]), "source_proxy_pm10_ug_m3": float(source[0]) if available[0] else None,
               "wind_from_degrees": float(wind[0]) if available[0] else None, "forecast": None}]
    for second in range(config["duration_seconds"]):
        source_past.append(float(source[second]) if available[second] else None)
        wind_past.append(float(wind[second]) if available[second] else None)
        observed = background + contribution.copy() if available[second] else None
        desired, diagnostic = controller_decision(strategy, observed, source_past, wind_past, active, config, model)
        capacity_limited = []
        if desired.sum() > config["maximum_active_zones"]:
            candidates = np.flatnonzero(desired)
            priorities = observed if observed is not None else np.zeros(count)
            keep = sorted(candidates, key=lambda i: (-priorities[i], i))[:config["maximum_active_zones"]]
            capacity_limited = [config["zones"][i]["id"] for i in candidates if i not in keep]
            desired = np.array([i in keep for i in range(count)])
        diagnostic["capacity_limited_zones"] = capacity_limited
        for zone in range(count):
            minimum = config["minimum_on_seconds"] if active[zone] else config["minimum_off_seconds"]
            if desired[zone] != active[zone] and second - switched_at[zone] >= minimum:
                active[zone] = desired[zone]
                switched_at[zone] = second
                switches += 1
        commands_history.append(active.copy())
        effective_index = second - config["actuator_delay_seconds"]
        effective = commands_history[effective_index] if effective_index >= 0 else np.zeros(count, dtype=bool)
        incoming = []
        for zone_index, delay in enumerate(delays):
            emission_second = second + 1 - delay
            source_value = float(source[emission_second]) if emission_second >= 0 else config["source_background_proxy_ug_m3"]
            wind_value = float(wind[emission_second]) if emission_second >= 0 else float(wind[0])
            incoming.append(source_value * config["transport_gain"] * directional_gain(wind_value, config["zones"])[zone_index])
        contribution = response * contribution + (1 - response) * np.array(incoming) * (1 - config["mist_source_fraction_removed"] * effective)
        water += active.sum() * config["flow_litres_minute_per_zone"] / 60
        duty += active
        diagnostic["issue_second"] = second
        traces.append({"second": second + 1, "pm10_ug_m3": (background + contribution).tolist(), "commands": active.tolist(),
                       "effective_misting": effective.tolist(), "water_litres": float(water), "data_available": bool(available[second + 1]),
                       "source_proxy_pm10_ug_m3": float(source[second + 1]) if available[second + 1] else None,
                       "wind_from_degrees": float(wind[second + 1]) if available[second + 1] else None, "forecast": diagnostic})
    concentrations = np.array([point["pm10_ug_m3"] for point in traces[1:]])
    maximum = concentrations.max(axis=1)
    metrics = {"water_litres": float(water), "mean_max_boundary_pm10_ug_m3": float(maximum.mean()),
               "peak_boundary_pm10_ug_m3": float(maximum.max()),
               "exceedance_seconds": int((maximum >= config["boundary_setting_ug_m3"]).sum()),
               "integrated_max_boundary_exposure_ug_s_m3": float(maximum.sum()), "zone_switches": switches,
               "zone_duty_seconds": dict(zip([zone["id"] for zone in config["zones"]], duty.tolist())),
               "metric_rule": "Maximum of four simulated boundary concentrations at each one-second interval end; average/integral/exceedance over 480 intervals"}
    return {"strategy": strategy, "metrics": metrics, "trace": traces}


def simulate_case(config: dict, case: dict, model=None) -> dict:
    source, wind, available = make_environment(config, case)
    environment_digest = hashlib.sha256(source.tobytes() + wind.tobytes() + available.tobytes()).hexdigest()
    runs = {strategy: run_strategy(config, source, wind, available, strategy, model) for strategy in STRATEGIES}
    return {"scenario_id": case["id"], "name": case["name"], "scope": config["scope"], "parameters": deepcopy(config), "case": deepcopy(case),
            "environment_sha256": environment_digest, "predictor_artifact_sha256": model.metadata["artifact_sha256"] if model else None,
            "predictor_scope": "Frozen laboratory model applied to a synthetic source-concentration proxy; spatial/control outcomes unvalidated",
            "wind_convention": "Meteorological wind-from; plume travel = (wind-from + 180) modulo 360", "runs": runs}
