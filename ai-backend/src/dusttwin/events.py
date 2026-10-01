"""Descriptive threshold warnings; an endpoint forecast is not a crossing ETA."""

import numpy as np


def threshold_events(grid: dict, issue_seconds: np.ndarray, config: dict) -> dict:
    above = np.asarray(grid["available"]) & (np.asarray(grid["pm10"]) >= config["threshold_pm10_ug_m3"])
    edges = np.diff(np.r_[False, above, False].astype(int))
    starts, ends = np.flatnonzero(edges == 1), np.flatnonzero(edges == -1)
    qualified = []
    last_onset = -np.inf
    for start, end in zip(starts, ends):
        # The frozen rule gives event and warning onset cooldowns of 60 seconds.
        if end - start >= config["minimum_exceedance_seconds"] and start - last_onset >= config["warning_cooldown_seconds"]:
            qualified.append(int(start))
            last_onset = start
    eligible = set(map(int, issue_seconds))
    window = config["matching_window_seconds"]
    scorable = [start for start in qualified if all(second in eligible for second in range(start - window, start))]
    return {"qualified_onsets_seconds": qualified, "scorable_onsets_seconds": scorable,
            "unscored_onsets_without_complete_warning_window": [start for start in qualified if start not in scorable]}


def score_warnings(issue_seconds: np.ndarray, current: np.ndarray, predicted: np.ndarray,
                   events: dict, config: dict) -> dict:
    warnings = []
    last_warning = -np.inf
    for second, observed, prediction in zip(issue_seconds, current, predicted):
        if observed < config["threshold_pm10_ug_m3"] <= prediction and second - last_warning >= config["warning_cooldown_seconds"]:
            warnings.append(int(second))
            last_warning = second
    unmatched = list(events["scorable_onsets_seconds"])
    matches = []
    false_alerts = []
    unscored_alerts = []
    for warning in warnings:
        match = next((event for event in unmatched if 0 < event - warning <= config["matching_window_seconds"]), None)
        if match is not None:
            unmatched.remove(match)
            matches.append({"warning_issue_second": warning, "event_onset_second": match, "lead_seconds": match - warning})
        elif any(0 < event - warning <= config["matching_window_seconds"] for event in events["unscored_onsets_without_complete_warning_window"]):
            unscored_alerts.append(warning)
        else:
            false_alerts.append(warning)
    scored_warnings = len(matches) + len(false_alerts)
    event_count = len(events["scorable_onsets_seconds"])
    return {"warning_issue_seconds": warnings, "matches": matches, "false_alert_issue_seconds": false_alerts,
            "unscored_alert_issue_seconds": unscored_alerts, "missed_event_onsets_seconds": unmatched,
            "scorable_events": event_count, "scored_warnings": scored_warnings, "matched_events": len(matches),
            "precision": len(matches) / scored_warnings if scored_warnings else None,
            "recall": len(matches) / event_count if event_count else None,
            "mean_matched_lead_seconds": float(np.mean([match["lead_seconds"] for match in matches])) if matches else None}
