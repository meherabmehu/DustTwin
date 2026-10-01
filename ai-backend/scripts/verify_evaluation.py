"""Recalculate published errors independently from the frozen exported CSV."""

import csv
import gzip
from io import StringIO
import json
import math
from pathlib import Path
import sys

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from dusttwin.preparation import file_sha256, load_partition


def main() -> None:
    report = json.loads((ROOT / "reports/evaluation/test-metrics.json").read_text())
    for name, expected in report["evidence_sha256"].items():
        assert file_sha256(ROOT / name) == expected, name
    rows = list(csv.DictReader(StringIO(gzip.decompress((ROOT / report["trace_file"]).read_bytes()).decode())))
    data = load_partition(ROOT, "test")
    assert len(rows) == report["samples"] == len(data["y"])
    np.testing.assert_array_equal([row["episode_id"] for row in rows], data["episode_id"])
    np.testing.assert_array_equal([float(row["actual_pm10_ug_m3"]) for row in rows], data["y"])
    for row in rows:
        assert int(row["target_second"]) - int(row["issue_second"]) == 30
        assert float(row["target_observation_second"]) <= int(row["target_second"])
        assert 0 <= float(row["target_age_seconds"]) <= 1.5
        assert 0 <= float(row["history_max_age_seconds"]) <= 1.5
        assert row["input_availability_mask"] == "1" * 121
    for episode in (None, *sorted(set(data["episode_id"]))):
        subset = rows if episode is None else [row for row in rows if row["episode_id"] == episode]
        expected_models = report["models"] if episode is None else report["by_recording"][episode]
        for name in report["models"]:
            errors = [float(row[f"{name}_pm10_ug_m3"]) - float(row["actual_pm10_ug_m3"]) for row in subset]
            expected = expected_models[name]
            assert expected["samples"] == len(errors)
            actual = {"mae_ug_m3": math.fsum(abs(error) for error in errors) / len(errors),
                      "rmse_ug_m3": math.sqrt(math.fsum(error ** 2 for error in errors) / len(errors)),
                      "mean_error_ug_m3": math.fsum(errors) / len(errors)}
            for metric, value in actual.items():
                assert math.isclose(value, expected[metric], rel_tol=1e-12, abs_tol=1e-10), (episode, name, metric)
    aggregates = {}
    for name in report["models"]:
        results = [item["models"][name] for item in report["descriptive_warnings_by_recording"].values()]
        events, warnings, matches = (sum(item[field] for item in results) for field in ("scorable_events", "scored_warnings", "matched_events"))
        leads = [match["lead_seconds"] for item in results for match in item["matches"]]
        aggregates[name] = {"events": events, "warnings": warnings, "matched_events": matches,
                            "false_alerts": warnings - matches, "mean_matched_lead_seconds": sum(leads) / len(leads) if leads else None}
        for item in results:
            assert len(item["matches"]) == item["matched_events"]
            assert len(item["false_alert_issue_seconds"]) + item["matched_events"] == item["scored_warnings"]
            assert len(item["missed_event_onsets_seconds"]) + item["matched_events"] == item["scorable_events"]
            assert len({match["event_onset_second"] for match in item["matches"]}) == item["matched_events"]
            assert all(0 < match["lead_seconds"] <= 30 for match in item["matches"])
    print(json.dumps({"verified_trace_rows": len(rows), "metrics_and_hashes": "passed", "descriptive_warnings": aggregates}, indent=2))


if __name__ == "__main__":
    main()
