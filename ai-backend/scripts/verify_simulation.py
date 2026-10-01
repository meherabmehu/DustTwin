"""Independently integrate every saved command/concentration trace."""

import gzip
import json
import math
from pathlib import Path
import sys

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from dusttwin.preparation import file_sha256


def main() -> None:
    index = json.loads((ROOT / "demo/simulation/index.json").read_text())
    assert index["config_sha256"] == file_sha256(ROOT / "experiments/scenarios/defaults.json")
    assert index["implementation_sha256"] == file_sha256(ROOT / "src/dusttwin/simulation.py")
    checked = 0
    for case in index["scenarios"]:
        path = ROOT / "demo/simulation" / case["file"]
        assert file_sha256(path) == case["sha256"]
        payload = json.loads(gzip.decompress(path.read_bytes()))
        config = payload["parameters"]
        for strategy, run in payload["runs"].items():
            points = run["trace"]
            assert len(points) == config["duration_seconds"] + 1
            assert [point["second"] for point in points] == list(range(481))
            water = 0
            switches = 0
            previous = [False] * 4
            last_switch = [-15] * 4
            maxima = []
            duty = [0] * 4
            for point in points[1:]:
                water += sum(point["commands"]) * config["flow_litres_minute_per_zone"] / 60
                assert math.isclose(water, point["water_litres"], abs_tol=1e-10)
                assert sum(point["commands"]) <= config["maximum_active_zones"]
                assert min(point["pm10_ug_m3"]) >= config["ambient_pm10_ug_m3"]
                maxima.append(max(point["pm10_ug_m3"]))
                for zone, active in enumerate(point["commands"]):
                    duty[zone] += active
                    if active != previous[zone]:
                        time = point["second"] - 1
                        minimum = config["minimum_on_seconds"] if previous[zone] else config["minimum_off_seconds"]
                        assert time - last_switch[zone] >= minimum
                        last_switch[zone] = time
                        switches += 1
                previous = point["commands"]
            metrics = run["metrics"]
            expected = {"water_litres": water, "mean_max_boundary_pm10_ug_m3": math.fsum(maxima) / 480,
                        "peak_boundary_pm10_ug_m3": max(maxima), "exceedance_seconds": sum(value >= config["boundary_setting_ug_m3"] for value in maxima),
                        "integrated_max_boundary_exposure_ug_s_m3": math.fsum(maxima), "zone_switches": switches}
            for field, value in expected.items():
                assert math.isclose(value, metrics[field], rel_tol=1e-12, abs_tol=1e-10), (case["id"], strategy, field)
            assert duty == list(metrics["zone_duty_seconds"].values())
            assert metrics == case["metrics"][strategy]
            if strategy == "no_control":
                assert water == 0 and switches == 0
            if strategy == "continuous":
                assert math.isclose(water, 4 * .5 * 480 / 60, abs_tol=1e-10)
            checked += 1
    print(json.dumps({"verified_runs": checked, "intervals": checked * 480, "checks": "all trace-derived metrics, flow integration, ambient floor, minimum switching, capacity, schema and hashes"}))


if __name__ == "__main__":
    main()
