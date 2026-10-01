"""Real artifact/API agreement, causal request validation and replay reveal."""

import copy
import json
from pathlib import Path
import sys
import unittest

import numpy as np
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services/inference"))
from app import create_app


def fixture_request(history):
    return {"task_id": "construction_pm10_30s_v1", "monitor_id": "OPC-N3", "clock_type": "elapsed_seconds_per_recording",
            "units": "ug/m3", "horizon_seconds": 30, "issue_time_seconds": 120,
            "history": [{"time_seconds": t, "observation_time_seconds": float(t), "pm10_ug_m3": value} for t, value in enumerate(history)]}


class InferenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture = json.loads((ROOT / "reports/training/prediction-fixture.json").read_text())
        cls.client = TestClient(create_app())
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)

    def test_all_five_fixture_predictions_match_api(self):
        for history, expected in zip(self.fixture["history_pm10_ug_m3"], self.fixture["expected_predictions_ug_m3"]):
            result = self.client.post("/v1/predict", json=fixture_request(history))
            self.assertEqual(result.status_code, 200)
            self.assertAlmostEqual(result.json()["predicted_pm10_ug_m3"], expected, places=8)
            self.assertNotIn("actual_pm10_ug_m3", result.json())
            self.assertIsNone(result.json()["crossing_eta_seconds"])

    def test_future_duplicate_stale_wrong_unit_and_nonfinite_rejected(self):
        original = fixture_request(self.fixture["history_pm10_ug_m3"][0])
        mutations = [("units", "mg/m3"), ("task_id", "fake"), ("horizon_seconds", 60), ("monitor_id", "other")]
        for field, value in mutations:
            bad = copy.deepcopy(original)
            bad[field] = value
            self.assertEqual(self.client.post("/v1/predict", json=bad).status_code, 422)
        for field, value in (("time_seconds", 121), ("time_seconds", 119), ("observation_time_seconds", 120.1), ("observation_time_seconds", 118.0), ("pm10_ug_m3", -1.0)):
            bad = copy.deepcopy(original)
            bad["history"][-1][field] = value
            self.assertEqual(self.client.post("/v1/predict", json=bad).status_code, 422)
        bad = copy.deepcopy(original)
        bad["history"][0]["pm10_ug_m3"] = float("nan")
        response = self.client.post("/v1/predict", content=json.dumps(bad), headers={"Content-Type": "application/json"})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["code"], "invalid_request")

    def test_replay_future_target_not_revealed_and_saved_live_agree(self):
        episode = "lab_e3_drill10"
        first = self.client.get(f"/v1/replay/{episode}?second=120").json()
        self.assertIsNone(first["matured_forecast"])
        self.assertTrue(all(p["time_seconds"] <= 120 for p in first["past_observations"]))
        self.assertEqual(first["forecast"]["target_time_seconds"], 150)
        later = self.client.get(f"/v1/replay/{episode}?second=150").json()
        self.assertEqual(later["matured_forecast"]["issue_time_seconds"], 120)
        self.assertAlmostEqual(later["matured_forecast"]["predicted_pm10_ug_m3"], first["forecast"]["predicted_pm10_ug_m3"], places=8)
        with TestClient(create_app(load_model=False)) as backup:
            self.assertFalse(backup.get("/health").json()["ready"])
            self.assertEqual(backup.post("/v1/predict", json=first["request"]).status_code, 503)
            saved = backup.get(f"/v1/replay/{episode}?second=120").json()["forecast"]
            self.assertEqual(saved["mode"], "saved_inference")
            self.assertAlmostEqual(saved["predicted_pm10_ug_m3"], first["forecast"]["predicted_pm10_ug_m3"], places=8)


if __name__ == "__main__":
    unittest.main()
