"""Fixed event persistence, availability, warning cooldown and matching rules."""

import json
from pathlib import Path
import sys
import unittest

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from dusttwin.events import score_warnings, threshold_events

CONFIG = json.loads((ROOT / "configs/demo-events.json").read_text())


class WarningTests(unittest.TestCase):
    def test_short_spikes_missing_snapshots_and_incomplete_history_are_excluded(self):
        pm = np.zeros(250)
        pm[10:16], pm[50:54], pm[100:106], pm[180:190] = 600, 600, 600, 600
        available = np.ones(250, dtype=bool)
        available[103] = False
        events = threshold_events({"pm10": pm, "available": available}, np.arange(30, 220), CONFIG)
        self.assertEqual(events["qualified_onsets_seconds"], [10, 180])
        self.assertEqual(events["scorable_onsets_seconds"], [180])
        self.assertEqual(events["unscored_onsets_without_complete_warning_window"], [10])

    def test_warning_matches_once_and_respects_cooldown(self):
        issue = np.arange(240)
        current = np.zeros(240)
        prediction = np.zeros(240)
        prediction[20:23], prediction[90], prediction[160] = 600, 600, 600
        current[160] = 700  # Already exceeded: not an advance warning.
        events = {"scorable_onsets_seconds": [45, 200], "unscored_onsets_without_complete_warning_window": []}
        result = score_warnings(issue, current, prediction, events, CONFIG)
        self.assertEqual(result["warning_issue_seconds"], [20, 90])
        self.assertEqual(result["matched_events"], 1)
        self.assertEqual(result["matches"][0]["lead_seconds"], 25)
        self.assertEqual(result["false_alert_issue_seconds"], [90])
        self.assertEqual(result["missed_event_onsets_seconds"], [200])
        self.assertEqual(result["precision"], .5)
        self.assertEqual(result["recall"], .5)

    def test_no_alerts_or_events_does_not_invent_rates(self):
        result = score_warnings(np.arange(10), np.zeros(10), np.zeros(10),
            {"scorable_onsets_seconds": [], "unscored_onsets_without_complete_warning_window": []}, CONFIG)
        self.assertIsNone(result["precision"])
        self.assertIsNone(result["recall"])
        self.assertIsNone(result["mean_matched_lead_seconds"])


if __name__ == "__main__":
    unittest.main()
