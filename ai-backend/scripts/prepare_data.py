"""Prepare the frozen task and score only validation baselines."""

import json
from pathlib import Path
import sys

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from dusttwin.data import raw_profiles, read_opc
from dusttwin.preparation import (array_sha256, feature_names, file_sha256,
                                 partition_map, recording_samples, regression_metrics)


def main() -> None:
    task = json.loads((ROOT / "configs/forecast-task.json").read_text())
    schema = json.loads((ROOT / "configs/features.json").read_text())
    _, sources = raw_profiles(ROOT)
    recordings = sorted([read_opc(path, body) for path, body in sources], key=lambda r: r["episode_id"])
    assignment = partition_map(task, recordings)
    output = ROOT / "data/processed" / task["task_id"]
    (output / "grids").mkdir(parents=True, exist_ok=True)
    manifest = {"schema_version": 1, "task_id": task["task_id"], "dataset_doi": task["dataset_doi"],
                "config_sha256": {name: file_sha256(ROOT / f"configs/{name}.json") for name in ("forecast-task", "features")},
                "feature_names": feature_names(schema), "recordings": [], "partitions": {},
                "independence_note": "Overlapping windows are not independent events. Twelve recordings in four labelled groups from one setup.",
                "history_provenance": "Grid files retain every contributing observation time, age and original row; sample issue indices locate the 121-point history."}
    batches = {name: [] for name in task["partitions"]}
    for recording in recordings:
        if recording["episode_id"] not in assignment:
            continue
        samples, grid, report = recording_samples(recording, task, schema)
        partition = assignment[recording["episode_id"]]
        grid_path = output / "grids" / f"{recording['episode_id']}.npz"
        np.savez_compressed(grid_path, **grid)
        report.update({key: recording[key] for key in ("episode_id", "group", "archive_path", "sha256", "clock_type", "known_dates", "drilling_duration_label_seconds")})
        report.update({"partition": partition, "grid_file": str(grid_path.relative_to(ROOT)), "grid_array_sha256": array_sha256(grid)})
        manifest["recordings"].append(report)
        batches[partition].append(samples)
    combined = {}
    for partition, items in batches.items():
        arrays = {key: np.concatenate([item[key] for item in items], axis=0) for key in items[0]}
        path = output / f"{partition}.npz"
        np.savez_compressed(path, **arrays)
        combined[partition] = arrays
        manifest["partitions"][partition] = {"file": str(path.relative_to(ROOT)), "array_sha256": array_sha256(arrays),
            "episodes": task["partitions"][partition], "samples": len(arrays["y"]), "features": arrays["X"].shape[1]}
    report_dir = ROOT / "reports/preparation"
    report_dir.mkdir(parents=True, exist_ok=True)
    (report_dir / "split-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    validation = combined["validation"]
    metrics = {"task_id": task["task_id"], "partition": "validation", "units": "ug/m3", "models": {
        name: regression_metrics(validation["y"], validation[name]) for name in ("persistence", "trailing_mean")}}
    (report_dir / "validation-baselines.json").write_text(json.dumps(metrics, indent=2) + "\n")
    print(json.dumps({"partitions": manifest["partitions"], "validation_baselines": metrics["models"]}, indent=2))


if __name__ == "__main__":
    main()
