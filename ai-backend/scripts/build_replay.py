"""Export attributed, hash-pinned recorded replay and saved model outputs."""

import json
from pathlib import Path
import sys

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from dusttwin.model import ForecastModel
from dusttwin.preparation import array_sha256, file_sha256, load_partition


def main() -> None:
    model = ForecastModel(ROOT)
    manifest = json.loads((ROOT / "reports/preparation/split-manifest.json").read_text())
    reports = {r["episode_id"]: r for r in manifest["recordings"]}
    directory = ROOT / "demo/replay"
    directory.mkdir(parents=True, exist_ok=True)
    index = {"schema_version": 1, "task_id": model.metadata["task_id"], "model_id": model.metadata["model_id"],
             "artifact_sha256": model.metadata["artifact_sha256"],
             "attribution": "Derived from Askarov and Choi (2024), DOI 10.17632/7f22n9v7hp.1, CC BY 4.0. Source files unchanged; causally gridded and forecast. No contributor endorsement.",
             "source_url": "https://data.mendeley.com/datasets/7f22n9v7hp/1", "license_url": "https://creativecommons.org/licenses/by/4.0/", "episodes": []}
    for partition in ("validation", "test"):
        data = load_partition(ROOT, partition)
        # Reproduce outputs from the frozen artifact; no fitting or model selection.
        forecasts = model.predict_features(data["X"])
        for episode in sorted(set(data["episode_id"])):
            mask = data["episode_id"] == episode
            report = reports[episode]
            with np.load(ROOT / report["grid_file"], allow_pickle=False) as archive:
                grid = dict(archive)
            if array_sha256(grid) != report["grid_array_sha256"]:
                raise ValueError("Replay grid differs from prepared source")
            first_rise = next((i for i in range(120, len(grid["pm10"])) if grid["pm10"][i] >= 500), 120)
            payload = {"episode_id": episode, "partition": partition, "group": report["group"],
                       "drilling_duration_label_seconds": report["drilling_duration_label_seconds"],
                       "source_sha256": report["sha256"], "grid_array_sha256": report["grid_array_sha256"],
                       "known_dates": report["known_dates"], "clock_type": "elapsed_seconds_per_recording",
                       "pm10_ug_m3": grid["pm10"].tolist(), "observation_seconds": grid["observation_second"].tolist(),
                       "available": grid["available"].tolist(), "forecast_issue_seconds": data["issue_second"][mask].tolist(),
                       "saved_forecast_pm10_ug_m3": forecasts[mask].tolist(), "saved_trailing_mean_pm10_ug_m3": data["trailing_mean"][mask].tolist()}
            path = directory / f"{episode}.json"
            path.write_text(json.dumps(payload, separators=(",", ":"), allow_nan=False) + "\n")
            index["episodes"].append({"episode_id": episode, "partition": partition, "group": report["group"],
                "label": f"Group {report['group']} · {report['drilling_duration_label_seconds']} s drilling",
                "file": path.name, "sha256": file_sha256(path), "last_second": len(grid["pm10"]) - 1,
                "first_issue_second": int(data["issue_second"][mask][0]), "last_issue_second": int(data["issue_second"][mask][-1]),
                "suggested_start_second": max(120, first_rise - 45)})
    (directory / "index.json").write_text(json.dumps(index, indent=2) + "\n")
    print(json.dumps({"episodes": len(index["episodes"]), "model_id": index["model_id"], "output": str(directory.relative_to(ROOT))}))


if __name__ == "__main__":
    main()
