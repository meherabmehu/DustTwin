"""Validated, timestamped inference shared by API and recorded replay."""

import hashlib
import json
from threading import Lock
from time import perf_counter
from typing import Literal

import numpy as np
from pydantic import BaseModel, ConfigDict, Field, model_validator

from .preparation import feature_matrix, feature_names


class Measurement(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, strict=True)
    time_seconds: int = Field(ge=0)
    observation_time_seconds: float = Field(ge=0)
    pm10_ug_m3: float = Field(ge=0)


class PredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, strict=True)
    task_id: Literal["construction_pm10_30s_v1"]
    monitor_id: Literal["OPC-N3"]
    clock_type: Literal["elapsed_seconds_per_recording"]
    units: Literal["ug/m3"]
    horizon_seconds: Literal[30]
    issue_time_seconds: int = Field(ge=120)
    history: list[Measurement] = Field(min_length=121, max_length=121)

    @model_validator(mode="after")
    def check_causal_history(self):
        expected = list(range(self.issue_time_seconds - 120, self.issue_time_seconds + 1))
        if [point.time_seconds for point in self.history] != expected:
            raise ValueError("History must be 121 consecutive one-second snapshots ending at issue time; no duplicate, future or reordered times")
        previous_observation = -1.0
        for point in self.history:
            age = point.time_seconds - point.observation_time_seconds
            if age < 0 or age > 1.5:
                raise ValueError("Every snapshot must use an observation at or before its grid time, at most 1.5 seconds old")
            if point.observation_time_seconds < previous_observation:
                raise ValueError("Contributing observation times must not move backward")
            previous_observation = point.observation_time_seconds
        return self


def snapshot_id(request: PredictionRequest) -> str:
    return hashlib.sha256(json.dumps(request.model_dump(), sort_keys=True, separators=(",", ":")).encode()).hexdigest()


class InferenceEngine:
    def __init__(self, model):
        self.model = model
        self.lock = Lock()

    def predict(self, request: PredictionRequest) -> dict:
        history = np.array([[point.pm10_ug_m3 for point in request.history]])
        with self.lock:
            start = perf_counter()
            prediction = float(self.model.predict_history(history)[0])
            milliseconds = (perf_counter() - start) * 1000
        features = feature_matrix(history, self.model.schema)[0]
        current = float(history[0, -1])
        setting = 500
        status = "already_exceeded" if current >= setting else ("endpoint_exceeds_setting" if prediction >= setting else "endpoint_below_setting")
        return {"snapshot_id": snapshot_id(request), "mode": "live_inference", "model_id": self.model.metadata["model_id"],
                "artifact_sha256": self.model.metadata["artifact_sha256"], "task_id": request.task_id,
                "dataset_doi": "10.17632/7f22n9v7hp.1", "monitor_id": request.monitor_id,
                "issue_time_seconds": request.issue_time_seconds, "target_time_seconds": request.issue_time_seconds + 30,
                "horizon_seconds": 30, "units": "ug/m3", "predicted_pm10_ug_m3": prediction,
                "current_pm10_ug_m3": current, "baselines": {"persistence_pm10_ug_m3": current,
                "trailing_mean_pm10_ug_m3": float(history[0, -61:].mean())},
                "input_quality": {"snapshots": 121, "maximum_observation_age_seconds": max(p.time_seconds - p.observation_time_seconds for p in request.history)},
                "features": dict(zip(feature_names(self.model.schema), features.tolist())), "inference_milliseconds": milliseconds,
                "demo_setting_ug_m3": setting, "crossing_status": status, "crossing_eta_seconds": None,
                "scope": "Laboratory OPC-N3 forecast; no boundary validation or calibrated uncertainty. Endpoint forecast cannot determine crossing ETA."}
