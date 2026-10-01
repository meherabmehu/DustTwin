"""Audit the newer raw OPC-N3 recordings before choosing a forecast task."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from dusttwin.data import PM_COLUMNS, CONTEXT_COLUMNS, raw_profiles, read_opc


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-plots", action="store_true")
    args = parser.parse_args()
    inventory, files = raw_profiles(ROOT)
    recordings = sorted([read_opc(path, body) for path, body in files], key=lambda x: x["episode_id"])
    summaries = []
    sequences = {}
    for recording in recordings:
        clock = np.array(recording["clock_seconds"])
        steps = np.diff(clock)
        values = recording["values"]
        summary = {key: recording[key] for key in ("episode_id", "environment", "group",
                  "drilling_duration_label_seconds", "archive_path", "sha256", "clock_type", "known_dates")}
        summary.update({"rows": len(clock), "elapsed_seconds": float(clock[-1] - clock[0]),
                        "median_step_seconds": float(np.median(steps)),
                        "minimum_step_seconds": float(steps.min()), "maximum_step_seconds": float(steps.max()),
                        "duplicate_timestamp_count": len(clock) - len(set(clock)),
                        "backward_step_count": int((steps < 0).sum()),
                        "intervals_over_1_5_seconds": int((steps > 1.5).sum()), "fields": {}})
        for column in PM_COLUMNS + CONTEXT_COLUMNS:
            array = np.array([np.nan if value is None else value for value in values[column]])
            valid = array[np.isfinite(array)]
            summary["fields"][column] = {
                "observed": len(valid), "missing": int(np.isnan(array).sum()),
                "nonfinite_nonmissing": int(np.isinf(array).sum()),
                "negative": int((valid < 0).sum()), "zero": int((valid == 0).sum()),
                "min": float(valid.min()), "max": float(valid.max()),
                "mean": float(valid.mean()), "p05": float(np.quantile(valid, .05)),
                "median": float(np.median(valid)), "p95": float(np.quantile(valid, .95)),
                "max_value_count": int((valid == valid.max()).sum()),
            }
        triples = list(zip(*(values[column] for column in PM_COLUMNS)))
        sequences[recording["episode_id"]] = {
            tuple(triples[i:i + 10]) for i in range(len(triples) - 9)
        }
        summary["pm_triplet_sequence_sha256"] = hashlib.sha256(json.dumps(triples).encode()).hexdigest()
        summaries.append(summary)
    overlap = []
    for i, left in enumerate(recordings):
        for right in recordings[i + 1:]:
            common = len(sequences[left["episode_id"]] & sequences[right["episode_id"]])
            if common:
                overlap.append({"left": left["episode_id"], "right": right["episode_id"],
                                "matching_ten_row_pm_triplets": common})
    summary = {
        "schema_version": 1, "dataset_doi": "10.17632/7f22n9v7hp.1",
        "raw_channel_rule": "Use PM10(ug/m3); exclude RollMean_* and Analysed workbooks",
        "opc_files": len(recordings), "laboratory_files": sum(r["environment"] == "laboratory" for r in recordings),
        "outdoor_files": sum(r["environment"] == "outdoor" for r in recordings),
        "laboratory_rows": sum(len(r["clock_seconds"]) for r in recordings if r["environment"] == "laboratory"),
        "outdoor_rows": sum(len(r["clock_seconds"]) for r in recordings if r["environment"] == "outdoor"),
        "identical_ten_row_sequences_between_files": overlap,
        "recordings": summaries,
    }
    output = ROOT / "reports/data-audit"
    output.mkdir(parents=True, exist_ok=True)
    (output / "mendeley-2024-inventory.json").write_text(json.dumps(inventory, indent=2) + "\n")
    (output / "mendeley-2024-summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    if not args.skip_plots:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        lab = [r for r in recordings if r["environment"] == "laboratory"]
        fig, axes = plt.subplots(4, 3, figsize=(12, 9), layout="constrained")
        for recording in lab:
            axis = axes[recording["group"] - 1, [10, 50, 90].index(recording["drilling_duration_label_seconds"])]
            elapsed = (np.array(recording["clock_seconds"]) - recording["clock_seconds"][0]) / 60
            axis.plot(elapsed, recording["values"]["PM10(ug/m3)"], linewidth=.65, color="#185b86")
            axis.set_title(recording["episode_id"], fontsize=10, loc="left")
            axis.grid(alpha=.2)
            if axis in axes[:, 0]:
                axis.set_ylabel("PM10 (µg/m³)")
            if axis in axes[-1, :]:
                axis.set_xlabel("Recorded elapsed minutes")
        fig.suptitle("Raw OPC-N3 laboratory profiles: separate recordings and scales", fontsize=14)
        fig.savefig(output / "mendeley-2024-lab-profiles.png", dpi=150)
        plt.close(fig)
    print(json.dumps({key: summary[key] for key in ("opc_files", "laboratory_rows", "outdoor_rows",
                     "identical_ten_row_sequences_between_files")}))


if __name__ == "__main__":
    main()
