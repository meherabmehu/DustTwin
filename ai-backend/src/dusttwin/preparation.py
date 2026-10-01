"""Causal snapshots, recording-local windows and one shared feature extractor."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def array_sha256(arrays: dict[str, np.ndarray]) -> str:
    """Hash values/schema independently of ZIP container metadata."""
    digest = hashlib.sha256()
    for name, value in sorted(arrays.items()):
        array = np.ascontiguousarray(value)
        digest.update(json.dumps([name, array.dtype.str, array.shape]).encode())
        digest.update(array.tobytes())
    return digest.hexdigest()


def feature_names(schema: dict) -> list[str]:
    return [f"pm10_lag_{lag}s" for lag in schema["lag_seconds"]] + [
        f"pm10_{stat}_{window}s" for window in schema["statistic_window_seconds"]
        for stat in schema["statistics"]]


def feature_matrix(history: np.ndarray, schema: dict) -> np.ndarray:
    """History is ordered oldest to newest, including the current snapshot."""
    history = np.asarray(history, dtype=np.float64)
    if history.ndim != 2 or history.shape[1] != schema["history_snapshots"]:
        raise ValueError("Expected a batch of 121 one-second PM10 snapshots")
    if not np.isfinite(history).all() or (history < 0).any():
        raise ValueError("History must contain finite nonnegative PM10")
    columns = [history[:, -1 - lag] for lag in schema["lag_seconds"]]
    for window in schema["statistic_window_seconds"]:
        values = history[:, -(window + 1):]
        centered_time = np.arange(window + 1, dtype=float) - window / 2
        stats = {"mean": values.mean(axis=1),
                 "std": values.std(axis=1, ddof=schema["std_ddof"]),
                 "slope": (values @ centered_time) / (centered_time @ centered_time)}
        columns.extend(stats[stat] for stat in schema["statistics"])
    return np.column_stack(columns)


def causal_grid(recording: dict, task: dict) -> tuple[dict[str, np.ndarray], dict]:
    clocks = np.asarray(recording["clock_seconds"], dtype=np.float64)
    values = np.asarray(recording["values"][task["source_column"]], dtype=np.float64)
    if not len(clocks) or len(clocks) != len(values) or not np.isfinite(clocks).all():
        raise ValueError("Invalid recording clocks or length")
    origin = clocks[0]
    if (clocks < origin).any():
        raise ValueError("Recording has observations before its declared grid origin")
    order = np.argsort(clocks, kind="stable")
    sorted_clock = clocks[order]
    keep = np.r_[np.diff(sorted_clock) != 0, True]
    retained_rows = order[keep]
    elapsed = clocks[retained_rows] - origin
    # Strict <= comparison. No future interpolation or floating-point lookahead.
    grid_time = np.arange(int(np.floor(elapsed[-1])) + 1, dtype=np.float64)
    selected = np.searchsorted(elapsed, grid_time, side="right") - 1
    observed_time = elapsed[selected]
    age = grid_time - observed_time
    raw_value = values[retained_rows[selected]]
    available = (age <= task["maximum_observation_age_seconds"]) & np.isfinite(raw_value) & (raw_value >= 0)
    grid = {"grid_second": grid_time, "pm10": np.where(available, raw_value, np.nan),
            "observation_second": observed_time, "observation_age_seconds": age,
            "original_row_index": retained_rows[selected], "available": available}
    report = {"original_rows": len(clocks), "retained_native_rows": len(elapsed),
              "duplicate_rows_removed": int(len(clocks) - len(elapsed)),
              "backward_native_steps": int((np.diff(clocks) < 0).sum()),
              "invalid_native_pm10_rows": int((~np.isfinite(values) | (values < 0)).sum()),
              "grid_snapshots": len(grid_time), "stale_grid_snapshots": int((age > task["maximum_observation_age_seconds"]).sum()),
              "unavailable_grid_snapshots": int((~available).sum()),
              "clock_origin_in_source_seconds": float(origin),
              "last_observation_elapsed_seconds": float(elapsed[-1])}
    return grid, report


def recording_samples(recording: dict, task: dict, schema: dict) -> tuple[dict, dict, dict]:
    if task["grid_interval_seconds"] != 1 or task["lookback_seconds"] != schema["lookback_seconds"]:
        raise ValueError("Task and feature clock must agree")
    grid, report = causal_grid(recording, task)
    lookback, horizon = task["lookback_seconds"], task["horizon_seconds"]
    issue = np.arange(lookback, len(grid["pm10"]) - horizon)
    if not len(issue):
        raise ValueError("Recording too short for the frozen task")
    history = sliding_window_view(grid["pm10"], lookback + 1)[issue - lookback]
    history_ok = np.isfinite(history).all(axis=1)
    target = issue + horizon
    target_ok = grid["available"][target]
    accepted = history_ok & target_ok
    report.update({"insufficient_history_issue_times": min(lookback, len(grid["pm10"])),
                   "insufficient_future_issue_times": min(horizon, len(grid["pm10"]) - lookback),
                   "candidate_windows": len(issue), "unavailable_history_only": int((~history_ok & target_ok).sum()),
                   "unavailable_target_only": int((history_ok & ~target_ok).sum()),
                   "unavailable_history_and_target": int((~history_ok & ~target_ok).sum()),
                   "eligible_windows": int(accepted.sum())})
    issue, target, history = issue[accepted], target[accepted], history[accepted]
    ages = sliding_window_view(grid["observation_age_seconds"], lookback + 1)[issue - lookback]
    samples = {"X": feature_matrix(history, schema), "y": grid["pm10"][target],
               "persistence": history[:, -1],
               "trailing_mean": history[:, -(schema["baseline_mean_window_seconds"] + 1):].mean(axis=1),
               "episode_id": np.full(len(issue), recording["episode_id"]),
               "issue_second": issue, "target_second": target,
               "target_observation_second": grid["observation_second"][target],
               "target_age_seconds": grid["observation_age_seconds"][target],
               "history_max_age_seconds": ages.max(axis=1)}
    if not len(issue):
        raise ValueError("No eligible windows in recording")
    report.update({"first_issue_second": int(issue[0]), "last_issue_second": int(issue[-1]),
                   "maximum_history_age_seconds": float(ages.max()),
                   "maximum_target_age_seconds": float(samples["target_age_seconds"].max())})
    return samples, grid, report


def partition_map(task: dict, recordings: list[dict]) -> dict[str, str]:
    mapping = {}
    for partition, episodes in task["partitions"].items():
        for episode in episodes:
            if episode in mapping:
                raise ValueError("Recording assigned to more than one partition")
            mapping[episode] = partition
    actual = [r["episode_id"] for r in recordings if r["environment"] == task["environment"]]
    if len(set(actual)) != len(actual) or set(actual) != set(mapping):
        raise ValueError("Raw recording identities differ from the frozen partition set")
    groups = {}
    for recording in recordings:
        if recording["episode_id"] in mapping:
            partition = mapping[recording["episode_id"]]
            group = recording["group"]
            if group in groups and groups[group] != partition:
                raise ValueError("Related experiment group spans multiple partitions")
            groups[group] = partition
    return mapping


def regression_metrics(actual: np.ndarray, predicted: np.ndarray) -> dict:
    actual, predicted = np.asarray(actual), np.asarray(predicted)
    if actual.shape != predicted.shape or not len(actual) or not np.isfinite(predicted).all() or not np.isfinite(actual).all():
        raise ValueError("Predictions must be finite and match the eligible targets")
    error = predicted - actual
    return {"samples": len(actual), "mae_ug_m3": float(np.abs(error).mean()),
            "rmse_ug_m3": float(np.sqrt(np.mean(error ** 2))),
            "mean_error_ug_m3": float(error.mean())}


def load_partition(root: Path, partition: str) -> dict[str, np.ndarray]:
    manifest = json.loads((root / "reports/preparation/split-manifest.json").read_text())
    path = root / manifest["partitions"][partition]["file"]
    with np.load(path, allow_pickle=False) as archive:
        arrays = dict(archive)
    if array_sha256(arrays) != manifest["partitions"][partition]["array_sha256"]:
        raise ValueError("Prepared array hash differs from manifest")
    for config in ("forecast-task", "features"):
        if file_sha256(root / f"configs/{config}.json") != manifest["config_sha256"][config]:
            raise ValueError("Configuration changed; prepare again under a new declared task")
    return arrays
