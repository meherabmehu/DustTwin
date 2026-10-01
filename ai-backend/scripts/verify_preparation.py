"""Verify prepared histories and targets against the unchanged native recordings."""

import json
from pathlib import Path
import sys

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from dusttwin.data import raw_profiles, read_opc
from dusttwin.preparation import array_sha256, feature_matrix, load_partition, partition_map


def main() -> None:
    task = json.loads((ROOT / "configs/forecast-task.json").read_text())
    schema = json.loads((ROOT / "configs/features.json").read_text())
    manifest = json.loads((ROOT / "reports/preparation/split-manifest.json").read_text())
    _, files = raw_profiles(ROOT)
    recordings = [read_opc(path, body) for path, body in files]
    assignment = partition_map(task, recordings)
    originals = {r["episode_id"]: r for r in recordings}
    checked = 0
    for partition in task["partitions"]:
        samples = load_partition(ROOT, partition)
        assert set(samples["episode_id"]) == set(task["partitions"][partition])
        assert (samples["target_second"] - samples["issue_second"] == task["horizon_seconds"]).all()
        for report in manifest["recordings"]:
            if report["partition"] != partition:
                continue
            episode = report["episode_id"]
            assert assignment[episode] == partition
            with np.load(ROOT / report["grid_file"], allow_pickle=False) as archive:
                grid = dict(archive)
            assert array_sha256(grid) == report["grid_array_sha256"]
            original = originals[episode]
            native_clock = np.asarray(original["clock_seconds"])
            native_values = np.asarray(original["values"][task["source_column"]])
            rows = grid["original_row_index"]
            np.testing.assert_array_equal(grid["observation_second"], native_clock[rows] - native_clock[0])
            assert (grid["observation_second"] <= grid["grid_second"]).all()
            np.testing.assert_array_equal(grid["pm10"][grid["available"]], native_values[rows][grid["available"]])
            mask = samples["episode_id"] == episode
            issue, target = samples["issue_second"][mask], samples["target_second"][mask]
            history_indices = issue[:, None] - np.arange(120, -1, -1)
            assert (grid["observation_second"][history_indices] <= history_indices).all()
            assert grid["available"][history_indices].all() and grid["available"][target].all()
            np.testing.assert_array_equal(samples["X"][mask], feature_matrix(grid["pm10"][history_indices], schema))
            np.testing.assert_array_equal(samples["y"][mask], grid["pm10"][target])
            np.testing.assert_array_equal(samples["target_observation_second"][mask], grid["observation_second"][target])
            assert (samples["target_observation_second"][mask] <= target).all()
            # Reconstruct eligibility independently from all grid issue times.
            eligible = []
            for second in range(120, len(grid["pm10"]) - 30):
                if grid["available"][second - 120:second + 1].all() and grid["available"][second + 30]:
                    eligible.append(second)
            np.testing.assert_array_equal(issue, eligible)
            checked += len(issue)
    print(json.dumps({"verified_windows": checked, "recordings": len(assignment),
                      "checks": "native provenance, strictly causal history, exact target horizon, freshness, complete eligibility, fixed groups, array hashes"}))


if __name__ == "__main__":
    main()
