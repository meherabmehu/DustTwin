"""Pinned scenario replay and validated reruns of common assumptions."""

import gzip
import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .preparation import file_sha256
from .simulation import simulate_case


class SimulationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, strict=True)
    scenario_id: Literal["low-risk", "east", "diagonal", "wind-shift", "data-loss"]
    source_scale: float = Field(default=1.0, ge=.25, le=2.0)
    wind_from_degrees: float | None = Field(default=None, ge=0, lt=360)
    wind_speed_metres_second: float = Field(default=3.0, ge=.5, le=12.0)
    flow_litres_minute_per_zone: float = Field(default=.5, ge=.1, le=2.0)
    mist_source_fraction_removed: float = Field(default=.65, ge=0, le=.95)


class ScenarioStore:
    def __init__(self, root: Path):
        self.root = root
        self.index = json.loads((root / "demo/simulation/index.json").read_text())

    def saved(self, scenario_id: str) -> dict:
        item = next((item for item in self.index["scenarios"] if item["id"] == scenario_id), None)
        if item is None:
            raise KeyError("Unknown scenario")
        path = self.root / "demo/simulation" / item["file"]
        if file_sha256(path) != item["sha256"]:
            raise ValueError("Simulation evidence hash mismatch")
        return json.loads(gzip.decompress(path.read_bytes()))

    def run(self, request: SimulationRequest, model) -> dict:
        config = json.loads((self.root / "experiments/scenarios/defaults.json").read_text())
        case = next(case for case in config["cases"] if case["id"] == request.scenario_id)
        case["source_multiplier"] *= request.source_scale
        if request.wind_from_degrees is not None:
            offset = request.wind_from_degrees - case["wind_from_degrees"]
            case["wind_from_degrees"] = request.wind_from_degrees
            if "wind_after_from_degrees" in case:
                case["wind_after_from_degrees"] = (case["wind_after_from_degrees"] + offset) % 360
        for name in ("wind_speed_metres_second", "flow_litres_minute_per_zone", "mist_source_fraction_removed"):
            config[name] = getattr(request, name)
        return simulate_case(config, case, model)
