"""Tests for leakage, irregular clocks and recording separation."""

import copy
import json
from pathlib import Path
import sys
import unittest

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from dusttwin.preparation import causal_grid, feature_matrix, partition_map, recording_samples

TASK = json.loads((ROOT / "configs/forecast-task.json").read_text())
SCHEMA = json.loads((ROOT / "configs/features.json").read_text())


def recording(clocks, values, episode="synthetic"):
    return {"episode_id": episode, "group": episode, "environment": "laboratory", "clock_seconds": list(clocks),
            "values": {"PM10(ug/m3)": list(values)}}


class CausalPreparationTests(unittest.TestCase):
    def test_latest_past_observation_and_last_duplicate(self):
        grid, report = causal_grid(recording([100, 100.9, 101.1, 101.1, 103.2], [5, 7, 9, 11, 13]), TASK)
        np.testing.assert_allclose(grid["pm10"][:3], [5, 7, 11])
        self.assertTrue(np.isnan(grid["pm10"][3]))
        self.assertEqual(report["duplicate_rows_removed"], 1)
        self.assertEqual(grid["original_row_index"][2], 3)
        self.assertTrue((grid["observation_second"] <= grid["grid_second"]).all())

    def test_target_is_30_seconds_not_30_native_rows(self):
        clocks = np.arange(0, 220, .7)
        samples, grid, _ = recording_samples(recording(clocks, clocks), TASK, SCHEMA)
        self.assertEqual(samples["issue_second"][0], 120)
        self.assertEqual(samples["target_second"][0], 150)
        self.assertAlmostEqual(samples["y"][0], 149.8)
        self.assertAlmostEqual(samples["target_age_seconds"][0], .2)
        self.assertEqual(samples["y"][0], grid["pm10"][150])

    def test_future_changes_cannot_change_issue_features(self):
        clocks = np.arange(220, dtype=float)
        original = recording(clocks, clocks)
        changed = copy.deepcopy(original)
        changed["values"]["PM10(ug/m3)"][151:] = [999999] * 69
        left, _, _ = recording_samples(original, TASK, SCHEMA)
        right, _, _ = recording_samples(changed, TASK, SCHEMA)
        mask = left["issue_second"] <= 150
        np.testing.assert_array_equal(left["X"][mask], right["X"][mask])
        self.assertNotEqual(left["y"][mask][-1], right["y"][mask][-1])

    def test_gap_rejects_whole_lookback_and_stale_target(self):
        clocks = np.r_[np.arange(160), np.arange(165, 340)]
        samples, grid, report = recording_samples(recording(clocks, clocks), TASK, SCHEMA)
        self.assertFalse(grid["available"][161])
        self.assertTrue((samples["history_max_age_seconds"] <= 1.5).all())
        self.assertTrue((samples["target_age_seconds"] <= 1.5).all())
        self.assertFalse(np.isin(samples["issue_second"], np.arange(131, 135)).any())
        self.assertFalse(np.isin(samples["issue_second"], np.arange(161, 285)).any())
        rejected = sum(report[key] for key in ("unavailable_history_only", "unavailable_target_only", "unavailable_history_and_target"))
        self.assertEqual(report["candidate_windows"], report["eligible_windows"] + rejected)

    def test_analytic_features_include_both_endpoints(self):
        history = (2 * np.arange(121) + 5)[None, :]
        features = feature_matrix(history, SCHEMA)[0]
        np.testing.assert_allclose(features[:7], [245, 243, 235, 225, 185, 125, 5])
        self.assertAlmostEqual(features[7], 215)
        self.assertAlmostEqual(features[9], 2)
        self.assertAlmostEqual(features[-1], 2)

    def test_partition_duplication_and_missing_recordings_fail(self):
        task = copy.deepcopy(TASK)
        task["partitions"] = {"train": ["a"], "test": ["a"]}
        with self.assertRaises(ValueError):
            partition_map(task, [recording(range(200), range(200), "a")])
        a, b = recording(range(200), range(200), "a"), recording(range(200), range(200), "b")
        b["group"] = a["group"]
        with self.assertRaises(ValueError):
            partition_map(task, [a, b])
        task["partitions"] = {"train": ["a"], "test": ["b"]}
        with self.assertRaises(ValueError):
            partition_map(task, [recording(range(200), range(200), "a")])
        samples, _, _ = recording_samples(recording(range(200), range(200), "a"), TASK, SCHEMA)
        self.assertEqual(set(samples["episode_id"]), {"a"})
        self.assertEqual(samples["issue_second"].min(), 120)
        self.assertLessEqual(samples["target_second"].max(), 199)


if __name__ == "__main__":
    unittest.main()
