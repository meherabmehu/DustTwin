# DustTwin AI Model & Hybrid Cyber-Physical Control Architecture

This document details the real-world integration of the trained machine learning model into the DustTwin platform, bridging laboratory sensor forecasting with real-time cyber-physical site dust mitigation.

---

## 1. Architectural Overview: Hybrid AI + Deterministic Control

DustTwin employs a **hybrid architecture** that combines the strengths of data-driven machine learning with physics-based deterministic site control:

```
┌────────────────────────────────────────────────────────┐
│                   DustTwin Platform                    │
└────────────────────────────────────┬───────────────────┘
                                     │
         ┌───────────────────────────┴───────────────────────────┐
         ▼                                                       ▼
┌─────────────────────────────────┐             ┌─────────────────────────────────┐
│     AI Model Forecast Engine    │             │   Deterministic Control Engine  │
│         (ai-backend/)           │             │            (Frontend)           │
├─────────────────────────────────┤             ├─────────────────────────────────┤
│ • Model: HistGBM                │             │ • Wind advection & plume spread │
│ • Predicts: PM10 magnitude at   │             │ • Directional boundary mapping  │
│   t + 30s horizon               │             │ • Risk banding (Low/Med/High)   │
│ • Input: 120s / 121 causal PM10 │             │ • Targeted zone selection (A–D) │
│   historical snapshots          │             │ • Actuator & relay actuation    │
│ • Sensor: OPC-N3 optical counter│             │ • Dynamic water-flow metering   │
└────────────────┬────────────────┘             └────────────────┬────────────────┘
                 │                                               │
                 │   Future PM10 Magnitude (+30s)                │   Wind Vector & Geometry
                 └───────────────────────┬───────────────────────┘
                                         ▼
                 ┌───────────────────────────────────────────────┐
                 │          Hybrid Predictive Decision           │
                 │                                               │
                 │   Elevated future PM10 predicted (+30s)       │
                 │   + Wind direction NW at 4.2 m/s              │
                 │   → Activate targeted misting in Zones A & D  │
                 │   → Conserve water in inactive Zones B & C    │
                 └───────────────────────────────────────────────┘
```

### Clean Boundary of Responsibility
- **What the AI Model Predicts:**
  - Future PM10 particulate mass concentration approximately 30 seconds ahead ($y_{t+30}$).
  - Causal feature representations (16 engineered features: 7 lags + rolling mean, standard deviation, and linear slope over 30s, 60s, and 120s windows).
- **What the AI Model DOES NOT Predict:**
  - The model **does not** predict PM2.5, wind speed, wind direction, relative humidity, nozzle spray effectiveness, or exact perimeter crossing times.
  - Those physical transport and control decisions remain strictly within DustTwin's deterministic site model.
- **No Synthetic Fallback:**
  - When the AI backend is stopped or offline, the interface explicitly reports `OFFLINE` and operates in deterministic scenario mode. It **never** manufactures random or synthetic numbers disguised as model inference.

---

## 2. Model Provenance & Verification

The trained artifact is verified against strict cryptographic and runtime criteria:

- **Model Artifact:** `ai-backend/models/artifacts/pm10-initial.joblib`
- **Artifact SHA-256:** `d78f1b37269f72af45933e01722968fb13ed82178f6d8b3e4c5584d46cec09c7`
- **Algorithm:** `HistGradientBoostingRegressor` (Scikit-learn `1.9.1`, `max_depth=3`, `max_iter=100`, `early_stopping=False`, `l2_regularization=0.0`)
- **Python Version:** Python 3.14 (matched against serialization environment)
- **Dataset Attribution:** Derived from Askarov & Choi (2024), *"Particulate matter and noise data collected during drilling processes in a controlled environment"*, Mendeley Data, DOI: [10.17632/7f22n9v7hp.1](https://data.mendeley.com/datasets/7f22n9v7hp/1), licensed under CC BY 4.0.
- **Experimental Partitions:**
  - Training: Groups 1 & 2 (10s, 50s, 90s concrete drilling episodes)
  - Validation: Group 3 (lab_e3_drill10, lab_e3_drill50, lab_e3_drill90)
  - Test Holdout: Group 4 (lab_e4_drill10, lab_e4_drill50, lab_e4_drill90; 15,065 test evaluation points)

---

## 3. Two Levels of Evaluation: Laboratory vs. Site-Control

The project strictly separates two distinct validation domains:

| Dimension | 1. Laboratory Model Evaluation | 2. DustTwin Site-Control Simulation |
| :--- | :--- | :--- |
| **Domain** | Offline statistical validation on physical sensor data | Cyber-physical closed-loop site simulation |
| **Dataset** | Mendeley OPC-N3 concrete drilling measurements | Standard 8-minute construction baseline scenario |
| **Primary Metric** | Mean Absolute Error (MAE) & RMSE | Reduction in PM, Exceedance, and Water |
| **Key Results** | • **Model MAE:** `88.405 µg/m³`<br>• **Model RMSE:** `179.272 µg/m³`<br>• **Persistence MAE:** `95.702 µg/m³`<br>• **Trailing Mean MAE:** `81.565 µg/m³` | • **PM Reduction:** `28%`<br>• **Boundary Exceedance Reduction:** `96%`<br>• **Water Use Reduction:** `93%`<br>• **Lead Time:** `26 sec` |
| **Interpretation** | Demonstrates the trained model achieves the lowest RMSE (penalizing sudden dust surges) on unseen test episodes. | Demonstrates that proactive targeted misting drastically curbs boundary emissions while saving water. |

---

## 4. REST API Specification

The Python FastAPI service (`ai-backend/services/inference/app.py`) exposes the following endpoints:

### Core Endpoints

- `GET /health`
  - Returns backend readiness, active mode (`live_inference` or `saved_inference`), model ID, and artifact SHA-256.
- `POST /v1/predict`
  - Body: `{ "series": [ { "second": 0, "pm10_ug_m3": 45.2 }, ... 121 points ... ] }`
  - Evaluates live model inference for the given causal history slice.
- `GET /v1/replay`
  - Returns index of all 6 recorded laboratory drilling episodes with partitions, duration, and suggested peak seconds.
- `GET /v1/replay/{episode_id}?second={second}`
  - Returns a point-in-time replay snapshot containing:
    - `forecast`: Current PM10, +30s predicted PM10, issue/target times, baselines, and model mode.
    - `matured_forecast`: Available when $t \ge 150\text{s}$, comparing the earlier prediction made at $t-30\text{s}$ against the recorded actual ground-truth PM10 at second $t$.
- `GET /v1/evidence`
  - Returns model metadata, validation selection report, and holdout test metrics.
- `GET /v1/scenarios` & `POST /v1/simulate`
  - Provides saved counterfactual scenarios and dynamic simulation evaluation.

---

## 5. Startup and Verification Instructions

### Prerequisites
- Node.js 18+ & npm
- Python 3.14 (required to load the joblib model artifact)

---

### Windows (PowerShell)

```powershell
# 1. Clone repository and navigate to root
cd DustTwin

# 2. Install frontend dependencies and verify build
npm install
npm test
npm run build

# 3. Set up Python 3.14 virtual environment in ai-backend
cd ai-backend
py -3.14 -m venv .venv
.venv\Scripts\Activate.ps1

# 4. Install backend dependencies
pip install -r requirements.txt

# 5. Verify trained model artifact and verification suite
python scripts/verify_model.py
python scripts/verify_handoff.py

# 6. Start the AI inference service (default port 8000)
$env:DUSTTWIN_ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
python scripts/serve.py

# 7. In a separate PowerShell terminal, start Vite frontend:
cd ..
npm run dev
```

---

### Linux / macOS (Bash)

```bash
# 1. Clone repository and navigate to root
cd DustTwin

# 2. Install frontend dependencies and verify build
npm install
npm test
npm run build

# 3. Set up Python 3.14 virtual environment in ai-backend
cd ai-backend
python3.14 -m venv .venv
source .venv/bin/activate

# 4. Install backend dependencies
pip install -r requirements.txt

# 5. Verify trained model artifact and handoff
python scripts/verify_model.py
python scripts/verify_handoff.py

# 6. Start the AI inference service (port 8000)
export DUSTTWIN_ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
python scripts/serve.py

# 7. In a separate terminal, start Vite frontend:
cd ..
npm run dev
```

---

## 6. Frontend Integration Architecture

The frontend integrates with the backend via `src/integrations/dusttwin-ai/`:

- `dusttwin-client.ts`: Resilient, typed API client with timeout protection and CORS-safe header handling.
- `types.ts`: Comprehensive TypeScript interfaces for forecasts, matured verifications, replay metadata, and evidence schemas.
- `useDustTwinHealth.ts`: React hook managing backend availability states (`checking`, `live`, `saved`, `offline`).
- `useDustTwinReplay.ts`: React hook managing causal replay scrubbing, caching, and matured comparison evaluation.
- `AiForecastCard.tsx`: Compact HUD component matching the dark navy/cyan industrial palette, featuring live/replay mode toggling, timeline scrubber, peak jump buttons, and matured ground-truth verification.
- `ModelEvidenceSection.tsx`: Dedicated validation section on the Results page presenting test holdout metrics (MAE/RMSE) and transparently distinguishing laboratory point evaluation from site-control physics simulation.
