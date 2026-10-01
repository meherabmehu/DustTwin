# DustTwin

DustTwin is a responsive, multi-page frontend prototype for predictive construction-site dust monitoring and targeted misting control. The UI follows the supplied dark navy / cyan dashboard references and includes an interactive live simulation, a browser-based circuit demonstration, and a tabletop prototype explainer.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

## Pages

- `/` — Overview
- `/problem` — Construction dust problem
- `/how-it-works` — Five-step process and system architecture
- `/simulation` — Interactive live digital twin mock
- `/circuit-simulation` — Browser-based wiring and relay demonstration
- `/prototype` — Judge-facing tabletop hardware prototype
- `/results` — Clearly labelled illustrative simulation results
- `/team` — Replaceable placeholder team roles

## Model and AI Backend Integration

DustTwin features a real, verified **Hybrid AI + Deterministic Control Architecture**:

- **AI Forecasting Engine (`ai-backend/`):** Houses the trained `HistGradientBoostingRegressor` model artifact (`models/artifacts/pm10-initial.joblib`, SHA-256: `d78f1b37...`). The model predicts particulate PM10 concentration approximately 30 seconds ahead based on 120s (121 causal snapshots) of OPC-N3 particulate time series data.
- **Deterministic Site-Control Engine (Frontend):** Translates wind velocity, direction, boundary sensor geometry, and risk classifications into targeted zone misting actions (Zones A–D) and water flow optimization.
- **Measured Replay Demo:** Supports 6 real-world laboratory drilling episodes (Groups 3 & 4) with timeline scrubbing, peak dust event jumps, and matured forecast verification comparing earlier model predictions directly against recorded actual sensor readings.
- **Model Validation Evidence:** The Results page clearly distinguishes laboratory model evaluation (MAE: 88.405 µg/m³, RMSE: 179.272 µg/m³ on 15,065 test holdout samples) from site-control simulation outcomes (28% PM reduction, 96% boundary exceedance reduction, 93% water savings).
- **Offline Resilience:** If the Python backend is offline, the frontend runs seamlessly in deterministic scenario mode and explicitly flags backend status without synthesizing fake predictions.

For detailed architecture diagrams, API specifications, and benchmark breakdowns, see [docs/AI_INTEGRATION.md](docs/AI_INTEGRATION.md).

### Quickstart AI Backend

#### Windows (PowerShell)
```powershell
cd ai-backend
py -3.14 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python scripts/verify_model.py
$env:DUSTTWIN_ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
python scripts/serve.py
```

#### Linux / macOS (Bash)
```bash
cd ai-backend
python3.14 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python scripts/verify_model.py
export DUSTTWIN_ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
python scripts/serve.py
```

Run frontend in parallel:
```bash
npm run dev
```
