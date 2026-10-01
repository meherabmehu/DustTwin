"""DustTwin model API for an existing frontend; no frontend build is required."""

from contextlib import asynccontextmanager
import json
import os
from pathlib import Path
import sys
from urllib.parse import urlsplit

from fastapi import FastAPI, HTTPException, Query
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))
from dusttwin.inference import InferenceEngine, PredictionRequest
from dusttwin.model import ForecastModel
from dusttwin.replay import ReplayStore
from dusttwin.scenario_store import ScenarioStore, SimulationRequest


def cors_origins(value: str) -> list[str]:
    origins = []
    for entry in value.split(","):
        origin = entry.strip().rstrip("/")
        if not origin:
            continue
        parsed = urlsplit(origin)
        if (parsed.scheme not in ("http", "https") or not parsed.hostname
                or parsed.username or parsed.password or parsed.path
                or parsed.query or parsed.fragment or "*" in origin):
            raise ValueError("DUSTTWIN_ALLOWED_ORIGINS must contain explicit HTTP(S) origins")
        # Accessing port also validates malformed port strings.
        parsed.port
        if origin not in origins:
            origins.append(origin)
    return origins


def create_app(root: Path = ROOT, load_model: bool = True, allowed_origins: list[str] | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app):
        app.state.engine = None
        app.state.model_error = None
        if load_model:
            try:
                app.state.engine = InferenceEngine(ForecastModel(root))
            except (OSError, ValueError) as error:
                app.state.model_error = str(error)
        else:
            app.state.model_error = "Live model intentionally unavailable"
        app.state.replay = ReplayStore(root)
        app.state.scenarios = ScenarioStore(root) if (root / "demo/simulation/index.json").exists() else None
        yield

    app = FastAPI(title="DustTwin", version="1.0.0", lifespan=lifespan, docs_url=None, redoc_url=None)
    origins = cors_origins(os.environ.get("DUSTTWIN_ALLOWED_ORIGINS", "")) if allowed_origins is None else cors_origins(",".join(allowed_origins))
    if origins:
        app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False,
                           allow_methods=["GET", "POST"], allow_headers=["Content-Type"])

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request, exception):
        # Exclude raw invalid inputs/exception objects, including NaN/Infinity.
        return JSONResponse(status_code=422, content={"code": "invalid_request", "errors": [
            {"field": ".".join(map(str, item["loc"])), "message": item["msg"]} for item in exception.errors()]})

    @app.get("/health")
    def health():
        engine = app.state.engine
        return {"ready": engine is not None, "mode": "live_inference" if engine else "saved_inference",
                "model_id": app.state.replay.index["model_id"], "artifact_sha256": app.state.replay.index["artifact_sha256"],
                "task_id": "construction_pm10_30s_v1", "monitor_id": "OPC-N3", "horizon_seconds": 30,
                "grid_interval_seconds": 1, "reason": app.state.model_error}

    @app.post("/v1/predict")
    def predict(request: PredictionRequest):
        if app.state.engine is None:
            raise HTTPException(503, "Live trained model unavailable; use the labelled saved replay")
        return app.state.engine.predict(request)

    @app.get("/v1/replay")
    def replay_index():
        return app.state.replay.index

    @app.get("/v1/replay/{episode_id}")
    def replay_snapshot(episode_id: str, second: int = Query(ge=120)):
        try:
            return app.state.replay.snapshot(episode_id, second, app.state.engine)
        except KeyError as error:
            raise HTTPException(404, str(error)) from error
        except ValueError as error:
            raise HTTPException(422, str(error)) from error

    @app.get("/v1/evidence")
    def evidence():
        return {"metadata": json.loads((root / "models/model-metadata.json").read_text()),
                "test": json.loads((root / "reports/evaluation/test-metrics.json").read_text()),
                "training": json.loads((root / "reports/training/validation-selection.json").read_text())}

    @app.get("/v1/scenarios")
    def scenarios():
        if app.state.scenarios is None:
            raise HTTPException(503, "Simulation evidence unavailable")
        return app.state.scenarios.index

    @app.get("/v1/scenarios/{scenario_id}")
    def scenario(scenario_id: str):
        if app.state.scenarios is None:
            raise HTTPException(503, "Simulation evidence unavailable")
        try:
            return app.state.scenarios.saved(scenario_id)
        except KeyError as error:
            raise HTTPException(404, str(error)) from error
        except ValueError as error:
            raise HTTPException(503, str(error)) from error

    @app.post("/v1/simulate")
    def simulate(request: SimulationRequest):
        if app.state.scenarios is None:
            raise HTTPException(503, "Simulation evidence unavailable")
        if app.state.engine is None:
            raise HTTPException(503, "Changing assumptions needs the trained model; saved scenarios remain available")
        with app.state.engine.lock:
            return app.state.scenarios.run(request, app.state.engine.model)

    app.mount("/demo", StaticFiles(directory=root / "demo"), name="demo")
    app.mount("/reports", StaticFiles(directory=root / "reports"), name="reports")
    dist = root / "apps/web/dist"
    if dist.exists():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

        @app.get("/{path:path}")
        def website(path: str):
            if path.startswith(("v1/", "health", "openapi")):
                raise HTTPException(404, "Unknown API route")
            return FileResponse(dist / "index.html")
    return app


app = create_app()
