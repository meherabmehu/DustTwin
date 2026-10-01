# DustTwin Model Integration

The complete model/backend handoff for connecting the trained DustTwin AI to your existing website. Keep your frontend design and call this API for the actual predictions.

The **trained model is included** in this repository. No retraining, GPU, Kaggle or separate model download is needed. Python **3.14** and the pinned packages are required; the live package is verified on macOS / Apple M4. Other platforms require the same setup checks before being called verified.

## Start the backend

```sh
git clone https://github.com/arifshekhk8/DustTwin-Model-Integration.git
cd DustTwin-Model-Integration
python3.14 -m venv .venv
.venv/bin/python -m pip install -r requirements-service.txt
.venv/bin/python scripts/verify_model.py
export DUSTTWIN_ALLOWED_ORIGINS='http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:5174'
.venv/bin/python scripts/serve.py
```

Open [health](http://127.0.0.1:8000/health) and confirm `ready: true` and `mode: live_inference`. If port 8000 is already used, add `--port 8100` and use that address in the frontend. The environment example is a reference; the launcher does not automatically read `.env` files.

For Windows, use `py -3.14 -m venv .venv`, `.venv\Scripts\python.exe` for Python commands and `$env:DUSTTWIN_ALLOWED_ORIGINS='http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:5174'` in PowerShell. This platform has not been tested here.

## Connect your website

Follow [the frontend integration guide](docs/integration.md). Copy the adapter in `frontend/` into your existing website and set its backend address. A React hook and TypeScript declarations are included.

To try the runnable browser example, keep the backend running and open a second terminal:

```sh
.venv/bin/python scripts/serve_example.py
```

Open [the example](http://127.0.0.1:5174/examples/) and click **Connect backend**. It uses real model output; **POST this history again** sends the complete measured input to `/v1/predict`. See [the API contract](docs/api.md) and [complete sample request](examples/predict-request.json).

**This repository contains the files; it does not host a running API.** For a local demonstration run both the backend and your frontend on the laptop. For an online website, host Python separately or behind a same-origin proxy and use its HTTPS API address.

## API

| Endpoint | Purpose |
|---|---|
| `GET /health` | Model readiness and exact artifact identity |
| `GET /v1/replay` | Available measured recordings and eligible clock ranges |
| `GET /v1/replay/{episode_id}?second=120` | Past measurements, real model forecast and previously matured actual |
| `POST /v1/predict` | Predict from an exact validated 121-snapshot history |
| `GET /v1/evidence` | Model metadata, validation selection and final test results |
| `GET /v1/scenarios` | Optional saved simulation cases |
| `GET /v1/scenarios/{id}` | Optional simulation trace for all four strategies |
| `POST /v1/simulate` | Rerun the common simulation with explicit assumptions |

The model predicts OPC-N3 laboratory **PM10 30 seconds ahead**, using the preceding **120 seconds / 121 snapshots**. Recorded replay is the quickest valid input source for the Round 1 demo. Wind, site layout and nozzle settings belong to the separate simulation; they are not learned forecast features.

## What's included

- `models/artifacts/pm10-initial.joblib`: real trained model (54,679 bytes), with metadata, SHA-256 and model card.
- `src/`, `services/`, `scripts/`, `configs/`, `requirements-*.txt`: complete inference, preparation and reproduction source.
- `demo/replay/`: six attributed recorded-data replays with previously computed backups.
- `demo/simulation/`, `experiments/scenarios/`: optional fair strategy simulation and assumptions.
- `reports/`, `data/manifest.json`, `docs/`: actual evaluation, source provenance and scientific limits.
- `tests/`: model, causal input, replay, simulation and integration checks.
- `frontend/`, `examples/`: browser adapter, optional React hook, runnable example and real sample request/response.

Original bulk training downloads are acquired through `scripts/download_data.py`; they are unnecessary for using the fitted model. Python itself, installed dependencies and the teammate's frontend remain separate installations.

For source reproduction and the distinction between original and handoff checks, read [reproducibility.md](docs/reproducibility.md). Preserve the handed-off model; use a separate scratch clone for fitting.

## Results to show honestly

Held-out MAE (µg/m³): **model 88.405**, persistence **95.702**, trailing mean **81.565**. The model beats persistence but loses to the mean on MAE. It demonstrates trained laboratory forecasting; it does not validate outdoor boundary accuracy, exact crossing ETA or physical misting effectiveness. Read [the model card](models/model-card.md) and keep simulation results labelled as simulation.

## Verify

Verified from a fresh GitHub clone on Python 3.14.6 / Apple M4: five model fixtures, 23 Python tests, three adapter tests, three Chromium browser journeys and TypeScript checking pass. The browser exercised the included example across origins, including direct prediction, matured actual reveal, stale-response rejection and service recovery. See [actual check details](reports/integration/checks.json).

```sh
.venv/bin/python scripts/verify_model.py
.venv/bin/python scripts/verify_handoff.py
.venv/bin/python -m unittest discover -s tests -v
```

Optional adapter checks (Node and npm needed only for these checks):

```sh
npm ci
npm run check:types
npm run test:client
npx playwright install chromium
npm run test:browser
```

Browser checks start their own backend/example on ports 18100/15174. They use `.venv/bin/python`; on Windows or another environment set `DUSTTWIN_TEST_PYTHON` to its Python executable. Production startup and your existing frontend do not need these optional test packages.

The original source/evidence is from [DustTwin-AI](https://github.com/arifshekhk8/DustTwin-AI), pinned in [upstream provenance](models/upstream-provenance.json). Code/model: MIT. Dataset derivatives: attributed CC BY 4.0; see [NOTICE](NOTICE.md). Continuation notes: [following.md](following.md).
