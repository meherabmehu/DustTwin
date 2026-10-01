"""Fit the frozen seven candidates using training and validation only."""

from datetime import datetime, timezone
import importlib.metadata
import json
from pathlib import Path
import platform
import subprocess
import sys
from time import perf_counter

import joblib
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from threadpoolctl import threadpool_limits

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from dusttwin.model import nonnegative_predictions
from dusttwin.preparation import file_sha256, load_partition, regression_metrics


def main() -> None:
    start = perf_counter()
    config = json.loads((ROOT / "configs/training.json").read_text())
    schema = json.loads((ROOT / "configs/features.json").read_text())
    manifest = json.loads((ROOT / "reports/preparation/split-manifest.json").read_text())
    # Intentionally no call to load_partition(..., "test") in this program.
    train, validation = load_partition(ROOT, "train"), load_partition(ROOT, "validation")
    candidates = []
    for alpha in config["ridge"]["alphas"]:
        candidates.append((f"ridge_alpha{alpha:g}", make_pipeline(StandardScaler(), Ridge(
            alpha=alpha, random_state=config["random_seed"], **config["ridge"]["parameters"]))))
    for depth in config["hist_gradient_boosting"]["depths"]:
        for iterations in config["hist_gradient_boosting"]["iterations"]:
            candidates.append((f"hist_gb_depth{depth}_iter{iterations}", HistGradientBoostingRegressor(
                max_depth=depth, max_iter=iterations, random_state=config["random_seed"],
                **config["hist_gradient_boosting"]["parameters"])))
    results = []
    with threadpool_limits(limits=config["maximum_native_threads"]):
        for index, (name, estimator) in enumerate(candidates):
            fit_start = perf_counter()
            estimator.fit(train["X"], train["y"])
            fit_seconds = perf_counter() - fit_start
            if name.startswith("ridge"):
                scaler = estimator.named_steps["standardscaler"]
                np.testing.assert_allclose(scaler.mean_, train["X"].mean(axis=0), rtol=1e-12)
                assert scaler.n_samples_seen_ == len(train["y"])
                settings = {"scaler": scaler.get_params(), "ridge": estimator.named_steps["ridge"].get_params()}
            else:
                assert not estimator.do_early_stopping_ and estimator.n_iter_ == estimator.max_iter
                settings = estimator.get_params()
            prediction, clipped = nonnegative_predictions(estimator, validation["X"])
            metrics = regression_metrics(validation["y"], prediction)
            per_recording = {episode: regression_metrics(validation["y"][validation["episode_id"] == episode],
                prediction[validation["episode_id"] == episode]) for episode in manifest["partitions"]["validation"]["episodes"]}
            result = {"candidate_order": index, "model_id": name, "fit_seconds": fit_seconds,
                      "validation": metrics, "validation_by_recording": per_recording,
                      "validation_negative_predictions_clipped": clipped, "estimator_parameters": settings}
            results.append(result)
            print(json.dumps({"model_id": name, "fit_seconds": fit_seconds, "validation": metrics}), flush=True)
    selected = min(results, key=lambda r: (r["validation"]["mae_ug_m3"], r["validation"]["rmse_ug_m3"], r["candidate_order"]))
    estimator = candidates[selected["candidate_order"]][1]
    artifacts = ROOT / "models/artifacts"
    artifacts.mkdir(parents=True, exist_ok=True)
    artifact = artifacts / "pm10-initial.joblib"
    joblib.dump({"model_id": selected["model_id"], "estimator": estimator, "feature_schema": schema,
                 "feature_names": manifest["feature_names"]}, artifact, compress=3)
    versions = {name: importlib.metadata.version(name) for name in ("numpy", "scipy", "scikit-learn", "joblib", "threadpoolctl")}
    cpu = subprocess.check_output(["sysctl", "-n", "machdep.cpu.brand_string"], text=True).strip() if sys.platform == "darwin" else platform.processor()
    metadata = {"model_id": selected["model_id"], "experiment_id": config["experiment_id"], "task_id": config["task_id"],
        "trained_at_utc": datetime.now(timezone.utc).isoformat(), "artifact_file": str(artifact.relative_to(ROOT)),
        "artifact_sha256": file_sha256(artifact), "artifact_bytes": artifact.stat().st_size,
        "feature_names": manifest["feature_names"], "python_version": platform.python_version(),
        "python_major_minor": list(sys.version_info[:2]), "dependencies": versions,
        "host": {"cpu": cpu, "architecture": platform.machine(), "platform": platform.platform()},
        "maximum_native_threads": config["maximum_native_threads"],
        "config_sha256": {name: file_sha256(ROOT / f"configs/{name}.json") for name in ("forecast-task", "features", "training", "demo-events")},
        "source_sha256": {name: file_sha256(ROOT / name) for name in ("src/dusttwin/data.py", "src/dusttwin/preparation.py", "src/dusttwin/model.py", "scripts/train_models.py")},
        "training_git_parent_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "training_worktree_had_changes": bool(subprocess.check_output(["git", "status", "--porcelain"], cwd=ROOT, text=True).strip()),
        "prepared_manifest_sha256": file_sha256(ROOT / "reports/preparation/split-manifest.json"),
        "training_array_sha256": manifest["partitions"]["train"]["array_sha256"],
        "validation_array_sha256": manifest["partitions"]["validation"]["array_sha256"],
        "trained_partitions": ["train"], "selection_partition": "validation", "test_used_for_training_or_selection": False,
        "prediction_postprocessing": config["prediction_postprocessing"]}
    (ROOT / "models/model-metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    indices = np.linspace(0, len(validation["y"]) - 1, 5, dtype=int)
    histories = []
    for index in indices:
        with np.load(ROOT / f"data/processed/{config['task_id']}/grids/{validation['episode_id'][index]}.npz", allow_pickle=False) as grid:
            issue = validation["issue_second"][index]
            histories.append(grid["pm10"][issue - 120:issue + 1].tolist())
    with threadpool_limits(limits=config["maximum_native_threads"]):
        fixture_prediction = nonnegative_predictions(estimator, validation["X"][indices])[0]
    fixture = {"model_id": selected["model_id"], "partition": "validation", "sample_indices": indices.tolist(),
               "history_pm10_ug_m3": histories, "features": validation["X"][indices].tolist(),
               "expected_predictions_ug_m3": fixture_prediction.tolist(), "absolute_tolerance": 1e-8}
    report_dir = ROOT / "reports/training"
    report_dir.mkdir(parents=True, exist_ok=True)
    (report_dir / "prediction-fixture.json").write_text(json.dumps(fixture, indent=2) + "\n")
    baselines = {name: regression_metrics(validation["y"], validation[name]) for name in ("persistence", "trailing_mean")}
    report = {"experiment_id": config["experiment_id"], "task_id": config["task_id"], "selection_partition": "validation",
              "training_samples": len(train["y"]), "validation_samples": len(validation["y"]),
              "selected_model_id": selected["model_id"], "artifact_sha256": metadata["artifact_sha256"],
              "baselines": baselines, "candidates": results,
              "selected_mae_improvement_over_persistence_percent": 100 * (baselines["persistence"]["mae_ug_m3"] - selected["validation"]["mae_ug_m3"]) / baselines["persistence"]["mae_ug_m3"],
              "sum_fit_seconds": sum(r["fit_seconds"] for r in results), "run_seconds_excluding_imports": perf_counter() - start,
              "test_scored": False, "refitted_with_validation": False}
    (report_dir / "validation-selection.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"selected": selected["model_id"], "sum_fit_seconds": report["sum_fit_seconds"], "run_seconds_excluding_imports": report["run_seconds_excluding_imports"], "artifact_sha256": metadata["artifact_sha256"]}), flush=True)


if __name__ == "__main__":
    main()
