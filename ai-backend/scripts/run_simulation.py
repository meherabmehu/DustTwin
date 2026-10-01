"""Run every frozen scenario/strategy and save actual simulation traces."""

import gzip
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from dusttwin.model import ForecastModel
from dusttwin.preparation import file_sha256
from dusttwin.simulation import simulate_case


def main() -> None:
    config_path = ROOT / "experiments/scenarios/defaults.json"
    config = json.loads(config_path.read_text())
    model = ForecastModel(ROOT)
    output = ROOT / "demo/simulation"
    output.mkdir(parents=True, exist_ok=True)
    index = {"experiment_id": config["experiment_id"], "scope": config["scope"], "config_sha256": file_sha256(config_path),
             "implementation_sha256": file_sha256(ROOT / "src/dusttwin/simulation.py"), "model_artifact_sha256": model.metadata["artifact_sha256"], "scenarios": []}
    summary = {"scope": config["scope"], "aggregation": "maximum across four boundaries at each one-second interval end", "scenarios": {}}
    for case in config["cases"]:
        result = simulate_case(config, case, model)
        path = output / f"{case['id']}.json.gz"
        path.write_bytes(gzip.compress(json.dumps(result, separators=(",", ":"), allow_nan=False).encode(), mtime=0))
        metrics = {strategy: run["metrics"] for strategy, run in result["runs"].items()}
        index["scenarios"].append({"id": case["id"], "name": case["name"], "file": path.name, "sha256": file_sha256(path), "environment_sha256": result["environment_sha256"], "metrics": metrics})
        summary["scenarios"][case["id"]] = metrics
        print(json.dumps({"scenario": case["id"], "metrics": metrics}), flush=True)
    (output / "index.json").write_text(json.dumps(index, indent=2) + "\n")
    reports = ROOT / "reports/simulation"
    reports.mkdir(parents=True, exist_ok=True)
    (reports / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")


if __name__ == "__main__":
    main()
