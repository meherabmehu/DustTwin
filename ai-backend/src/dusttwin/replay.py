"""Serve only past observations and already matured forecast targets."""

import bisect
import json
from pathlib import Path

from .inference import PredictionRequest
from .preparation import file_sha256


class ReplayStore:
    def __init__(self, root: Path):
        self.index = json.loads((root / "demo/replay/index.json").read_text())
        self.episodes = {}
        for item in self.index["episodes"]:
            path = root / "demo/replay" / item["file"]
            if file_sha256(path) != item["sha256"]:
                raise ValueError("Replay source checksum mismatch")
            self.episodes[item["episode_id"]] = json.loads(path.read_text())

    def snapshot(self, episode: str, second: int, engine=None) -> dict:
        if episode not in self.episodes:
            raise KeyError("Unknown recording")
        recording = self.episodes[episode]
        times = recording["forecast_issue_seconds"]
        index = bisect.bisect_left(times, second)
        if index == len(times) or times[index] != second:
            raise ValueError("Clock must select an eligible forecast issue second")
        history = [{"time_seconds": t, "observation_time_seconds": recording["observation_seconds"][t],
                    "pm10_ug_m3": recording["pm10_ug_m3"][t]} for t in range(second - 120, second + 1)]
        request = PredictionRequest(task_id=self.index["task_id"], monitor_id="OPC-N3", clock_type="elapsed_seconds_per_recording",
                                    units="ug/m3", horizon_seconds=30, issue_time_seconds=second, history=history)
        if engine:
            forecast = engine.predict(request)
        else:
            forecast = {"mode": "saved_inference", "model_id": self.index["model_id"], "artifact_sha256": self.index["artifact_sha256"],
                "issue_time_seconds": second, "target_time_seconds": second + 30, "predicted_pm10_ug_m3": recording["saved_forecast_pm10_ug_m3"][index],
                "current_pm10_ug_m3": recording["pm10_ug_m3"][second], "horizon_seconds": 30, "units": "ug/m3",
                "baselines": {"persistence_pm10_ug_m3": recording["pm10_ug_m3"][second], "trailing_mean_pm10_ug_m3": recording["saved_trailing_mean_pm10_ug_m3"][index]},
                "scope": "Previously computed output from the frozen artifact. Live inference unavailable."}
        past_index = bisect.bisect_left(times, second - 30)
        matured = None
        if past_index < len(times) and times[past_index] == second - 30:
            matured = {"issue_time_seconds": second - 30, "target_time_seconds": second,
                       "predicted_pm10_ug_m3": recording["saved_forecast_pm10_ug_m3"][past_index],
                       "actual_pm10_ug_m3": recording["pm10_ug_m3"][second],
                       "target_observation_time_seconds": recording["observation_seconds"][second]}
        return {"episode_id": episode, "partition": recording["partition"], "clock_second": second,
                "request": request.model_dump(), "forecast": forecast, "matured_forecast": matured,
                "past_observations": [{"time_seconds": t, "pm10_ug_m3": recording["pm10_ug_m3"][t]} for t in range(max(0, second - 240), second + 1)],
                "attribution": self.index["attribution"]}
