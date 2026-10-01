"""Common plant, future isolation, water/ambient and boundary coverage."""

import gzip
import json
from pathlib import Path
import sys
import unittest

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from dusttwin.model import ForecastModel
from dusttwin.simulation import crossing_status, directional_gain, make_environment, run_strategy, simulate_case, travel_bearing

CONFIG = json.loads((ROOT / "experiments/scenarios/defaults.json").read_text())


class SimulationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model = ForecastModel(ROOT)

    def test_wind_from_conversion_and_diagonal_two_edges(self):
        self.assertEqual(travel_bearing(270), 90)
        np.testing.assert_allclose(directional_gain(270, CONFIG["zones"]), [0, 1, 0, 0], atol=1e-12)
        np.testing.assert_allclose(directional_gain(225, CONFIG["zones"]), [.5, .5, 0, 0], atol=1e-12)

    def test_crossing_states_are_from_trajectory(self):
        states = crossing_status(np.array([300, 100, 100, 100]), np.array([[280, 200, 110, 90], [260, 260, 120, 80]]), 250)
        self.assertEqual(states[0], {"status": "already_exceeded", "eta_seconds": 0})
        self.assertEqual(states[1], {"status": "future_crossing", "eta_seconds": 2})
        self.assertEqual(states[2]["status"], "no_crossing_within_horizon")
        self.assertIsNone(states[2]["eta_seconds"])

    def test_saved_case_is_deterministic(self):
        case = next(case for case in CONFIG["cases"] if case["id"] == "east")
        result = simulate_case(CONFIG, case, self.model)
        saved = json.loads(gzip.decompress((ROOT / "demo/simulation/east.json.gz").read_bytes()))
        self.assertEqual(result, saved)

    def test_future_source_and_wind_do_not_change_earlier_controller_choices(self):
        case = next(case for case in CONFIG["cases"] if case["id"] == "east")
        source, wind, available = make_environment(CONFIG, case)
        left = run_strategy(CONFIG, source, wind, available, "predictive", self.model)
        source[300:], wind[300:] = 6500, 90
        right = run_strategy(CONFIG, source, wind, available, "predictive", self.model)
        self.assertEqual(left["trace"][:300], right["trace"][:300])
        # At clock 300 the newly revealed source/wind differ; decisions were issued at 299.
        self.assertEqual(left["trace"][300]["commands"], right["trace"][300]["commands"])
        self.assertEqual(left["trace"][300]["forecast"], right["trace"][300]["forecast"])

    def test_diagonal_includes_both_risks_and_dropout_is_explicit(self):
        diagonal = json.loads(gzip.decompress((ROOT / "demo/simulation/diagonal.json.gz").read_bytes()))
        points = diagonal["runs"]["predictive"]["trace"]
        self.assertTrue(any(point["forecast"] and set(point["forecast"]["risk_zones"]) == {"A", "B"} and all(point["commands"][:2]) for point in points))
        lost = json.loads(gzip.decompress((ROOT / "demo/simulation/data-loss.json.gz").read_bytes()))
        missing = lost["runs"]["predictive"]["trace"][110]
        self.assertFalse(missing["data_available"])
        self.assertIsNone(missing["source_proxy_pm10_ug_m3"])
        self.assertEqual(missing["forecast"]["forecast_status"], "sensor_unavailable_safe_spray")
        recovered = lost["runs"]["predictive"]["trace"][140]
        self.assertEqual(recovered["forecast"]["forecast_status"], "source_history_unavailable_reactive_fallback")


if __name__ == "__main__":
    unittest.main()
