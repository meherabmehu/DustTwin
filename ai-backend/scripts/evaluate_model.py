"""Evaluate the frozen artifact once; reruns verify the saved evidence."""

import csv
from datetime import datetime, timezone
import gzip
from io import StringIO
import json
from pathlib import Path
import subprocess
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from dusttwin.events import score_warnings, threshold_events
from dusttwin.model import ForecastModel
from dusttwin.preparation import file_sha256, load_partition, regression_metrics


def main() -> None:
    report_dir = ROOT / "reports/evaluation"
    report_path = report_dir / "test-metrics.json"
    if report_path.exists():
        report = json.loads(report_path.read_text())
        for name, expected in report["evidence_sha256"].items():
            if file_sha256(ROOT / name) != expected:
                raise ValueError(f"Frozen evaluation evidence changed: {name}")
        model = ForecastModel(ROOT)
        if model.metadata["artifact_sha256"] != report["artifact_sha256"]:
            raise ValueError("A different artifact requires a declared new experiment")
        print("Final test is already evaluated. Frozen artifact and evidence hashes verified; no new model selection or scoring.")
        return
    model = ForecastModel(ROOT)
    selection = json.loads((ROOT / "reports/training/validation-selection.json").read_text())
    if selection["artifact_sha256"] != model.metadata["artifact_sha256"] or selection["selected_model_id"] != model.metadata["model_id"]:
        raise ValueError("Artifact is not the frozen validation selection")
    data = load_partition(ROOT, "test")
    event_config = json.loads((ROOT / "configs/demo-events.json").read_text())
    predictions = {"persistence": data["persistence"], "trailing_mean": data["trailing_mean"],
                   "selected_model": model.predict_features(data["X"])}
    report_dir.mkdir(parents=True, exist_ok=True)
    pooled = {name: regression_metrics(data["y"], prediction) for name, prediction in predictions.items()}
    report = {"task_id": model.metadata["task_id"], "model_id": model.metadata["model_id"],
              "evaluated_at_utc": datetime.now(timezone.utc).isoformat(), "partition": "test", "group": 4,
              "condition_label": "temperature increased", "samples": len(data["y"]), "units": "ug/m3",
              "artifact_sha256": model.metadata["artifact_sha256"], "selection_frozen_at_git_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
              "models": pooled, "by_recording": {}, "descriptive_warnings_by_recording": {},
              "event_configuration": event_config, "target_range_ug_m3": {"minimum": float(data["y"].min()), "maximum": float(data["y"].max())},
              "maximum_target_age_seconds": float(data["target_age_seconds"].max()),
              "limitations": ["Only three test recordings in one related experimental group", "Overlapping windows are dependent", "Changed temperature condition", "One laboratory setup/instrument", "No calibrated uncertainty, boundary or suppression evidence"]}
    report["mae_improvement_over_persistence_percent"] = 100 * (pooled["persistence"]["mae_ug_m3"] - pooled["selected_model"]["mae_ug_m3"]) / pooled["persistence"]["mae_ug_m3"]
    report["mae_improvement_over_trailing_mean_percent"] = 100 * (pooled["trailing_mean"]["mae_ug_m3"] - pooled["selected_model"]["mae_ug_m3"]) / pooled["trailing_mean"]["mae_ug_m3"]
    report["by_target_operating_setting"] = {}
    for label, mask in (("below_demo_setting", data["y"] < event_config["threshold_pm10_ug_m3"]), ("at_or_above_demo_setting", data["y"] >= event_config["threshold_pm10_ug_m3"])):
        report["by_target_operating_setting"][label] = {name: regression_metrics(data["y"][mask], prediction[mask]) for name, prediction in predictions.items()} if mask.any() else None
    episodes = sorted(set(data["episode_id"]))
    fig, axes = plt.subplots(len(episodes), 1, figsize=(12, 9), layout="constrained")
    failure_fig, failure_axes = plt.subplots(len(episodes), 1, figsize=(12, 9), layout="constrained")
    colors = {"selected_model": "#1764ab", "persistence": "#8b939b", "trailing_mean": "#ad771a"}
    labels = {"selected_model": "Trained forecast (issued 30 s earlier)", "persistence": "Persistence", "trailing_mean": "Trailing mean"}
    for episode, axis, failure_axis in zip(episodes, axes, failure_axes):
        mask = data["episode_id"] == episode
        actual, time = data["y"][mask], data["target_second"][mask]
        episode_predictions = {name: prediction[mask] for name, prediction in predictions.items()}
        report["by_recording"][episode] = {name: regression_metrics(actual, prediction) for name, prediction in episode_predictions.items()}
        grid_path = ROOT / f"data/processed/{model.metadata['task_id']}/grids/{episode}.npz"
        with np.load(grid_path, allow_pickle=False) as archive:
            grid = dict(archive)
        events = threshold_events(grid, data["issue_second"][mask], event_config)
        report["descriptive_warnings_by_recording"][episode] = {"events": events, "models": {
            name: score_warnings(data["issue_second"][mask], data["persistence"][mask], prediction, events, event_config)
            for name, prediction in episode_predictions.items()}}
        worst = int(np.argmax(np.abs(episode_predictions["selected_model"] - actual)))
        report["by_recording"][episode]["worst_selected_forecast"] = {"issue_second": int(data["issue_second"][mask][worst]),
            "target_second": int(time[worst]), "actual_pm10_ug_m3": float(actual[worst]),
            "predicted_pm10_ug_m3": float(episode_predictions["selected_model"][worst]),
            "absolute_error_ug_m3": float(abs(episode_predictions["selected_model"][worst] - actual[worst]))}
        close = np.abs(time - time[worst]) <= 90
        for target_axis, selected in ((axis, np.ones(len(actual), dtype=bool)), (failure_axis, close)):
            target_axis.plot(time[selected] / 60, actual[selected], color="#181d22", linewidth=.9, label="Recorded target")
            for name, prediction in episode_predictions.items():
                target_axis.plot(time[selected] / 60, prediction[selected], color=colors[name], linewidth=.8, alpha=.9, label=labels[name])
            target_axis.set_ylabel("PM10 (µg/m³)")
            target_axis.set_title(episode, loc="left", fontsize=11)
            target_axis.grid(alpha=.2)
        failure_axis.axvline(time[worst] / 60, color="#c43333", linestyle="--", alpha=.7)
    for current_fig, current_axes, title, filename in (
        (fig, axes, "Held-out group 4: recorded targets and 30-second forecasts", "test-full-profiles.png"),
        (failure_fig, failure_axes, "Largest absolute model error in each held-out recording (±90 seconds)", "test-failure-windows.png")):
        current_axes[0].legend(fontsize=8, ncols=2, loc="upper right")
        current_axes[-1].set_xlabel("Target elapsed minutes within recording")
        current_fig.suptitle(title, fontsize=14)
        current_fig.savefig(report_dir / filename, dpi=150)
        plt.close(current_fig)
    residual_fig, residual_axes = plt.subplots(1, 2, figsize=(12, 4.5), layout="constrained")
    error = predictions["selected_model"] - data["y"]
    residual_axes[0].hist(error, bins=80, color="#1764ab")
    residual_axes[0].set_xlabel("Forecast − recorded target (µg/m³)")
    residual_axes[0].set_ylabel("Eligible windows (overlapping)")
    residual_axes[1].scatter(data["y"], error, s=3, alpha=.15, color="#1764ab", rasterized=True)
    residual_axes[1].axhline(0, color="#333", linewidth=.8)
    residual_axes[1].set_xlabel("Recorded target PM10 (µg/m³)")
    residual_axes[1].set_ylabel("Forecast − target (µg/m³)")
    residual_fig.suptitle("Held-out residuals: all 15,065 eligible targets")
    residual_fig.savefig(report_dir / "test-residuals.png", dpi=150)
    plt.close(residual_fig)
    buffer = StringIO(newline="")
    fields = ["episode_id", "issue_second", "target_second", "target_observation_second", "target_age_seconds", "history_max_age_seconds", "input_availability_mask", "actual_pm10_ug_m3", "selected_model_pm10_ug_m3", "persistence_pm10_ug_m3", "trailing_mean_pm10_ug_m3"]
    writer = csv.DictWriter(buffer, fieldnames=fields)
    writer.writeheader()
    for index in range(len(data["y"])):
        row = {name: data[name][index].item() for name in fields[:6]}
        row.update({"input_availability_mask": "1" * 121, "actual_pm10_ug_m3": data["y"][index].item()})
        row.update({f"{name}_pm10_ug_m3": prediction[index].item() for name, prediction in predictions.items()})
        writer.writerow(row)
    trace_path = report_dir / "test-forecast-traces.csv.gz"
    trace_path.write_bytes(gzip.compress(buffer.getvalue().encode(), mtime=0))
    report["trace_file"] = str(trace_path.relative_to(ROOT))
    report["evidence_sha256"] = {str(path.relative_to(ROOT)): file_sha256(path) for path in (
        trace_path, report_dir / "test-full-profiles.png", report_dir / "test-failure-windows.png", report_dir / "test-residuals.png",
        ROOT / "reports/training/validation-selection.json", ROOT / "models/model-metadata.json")}
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"models": pooled, "mae_improvement_over_persistence_percent": report["mae_improvement_over_persistence_percent"],
                      "by_recording": report["by_recording"], "warning_results": report["descriptive_warnings_by_recording"]}, indent=2))


if __name__ == "__main__":
    main()
