# Model API contract

Backend root defaults to `http://127.0.0.1:8000`. Endpoint JSON can be inspected through `/openapi.json`; no online Swagger assets are needed. Use [integration.md](integration.md) for the frontend adapter.

## Live prediction

```sh
curl http://127.0.0.1:8000/health
curl -X POST http://127.0.0.1:8000/v1/predict \
  -H 'Content-Type: application/json' \
  --data-binary @examples/predict-request.json
```

[predict-request.json](../examples/predict-request.json) contains a complete valid 121-point **measured replay history**, including the actual contributing native observation times. [predict-response.json](../examples/predict-response.json) is an actual sample response from that included model; `inference_milliseconds` varies on each call. These samples are derived from Askarov and Choi (2024), DOI `10.17632/7f22n9v7hp.1`, CC BY 4.0; see [NOTICE](../NOTICE.md).

Required body fields:

| Field | Required value/rule |
|---|---|
| `task_id` | `construction_pm10_30s_v1` |
| `monitor_id` | `OPC-N3` |
| `clock_type` | `elapsed_seconds_per_recording` |
| `units` | `ug/m3` |
| `horizon_seconds` | `30` |
| `issue_time_seconds` | Integer ≥120 |
| `history` | Exactly 121 ordered snapshots, from issue−120 through issue inclusive |
| `history[].time_seconds` | Consecutive integer elapsed seconds |
| `history[].observation_time_seconds` | Actual source observation time, nondecreasing, ≤grid time and at most 1.5 seconds old |
| `history[].pm10_ug_m3` | Finite nonnegative concentration |

Extra fields, wrong types/units, future/reordered/duplicate timestamps, stale observations, missing snapshots, negative and nonfinite values are rejected. Do not send irregular native rows as this history. The accepted input is a causal latest-past one-second grid. The shared `causal_grid` implementation in `src/dusttwin/preparation.py` defines that transformation and last-duplicate policy; raw ingestion and a different hardware monitor require their own audited adapter/validation. Never invent native observation timestamps just to satisfy validation.

Returned forecast includes `snapshot_id`, model/artifact identity, dataset DOI, issue/target time, PM10 prediction/current observation, baselines, sixteen real features, observation freshness, measured call duration and scope. Persistence is the current value; the trailing mean is the **last 61 inclusive snapshots / 60 seconds**. The target is issue+30, not the next 30 native rows.

`crossing_status` is `already_exceeded`, `endpoint_exceeds_setting` or `endpoint_below_setting` for the illustrative 500 setting. `crossing_eta_seconds` is null: a single endpoint cannot determine an exact crossing time. This model supplies no probability or calibrated uncertainty.

## Recorded replay

```sh
curl http://127.0.0.1:8000/v1/replay
curl 'http://127.0.0.1:8000/v1/replay/lab_e3_drill10?second=120'
```

The index lists episode IDs and eligible clock bounds. Snapshot fields:

- `request`: exactly the causal history accepted by `/v1/predict`.
- `forecast`: live artifact output when ready, otherwise clearly labelled saved output.
- `past_observations`: chartable measurements no later than the chosen clock.
- `matured_forecast`: earlier issue at clock−30, with its now-observed target; null before one exists.
- `attribution`, `partition`, `episode_id`, `clock_second`.

At clock 120 the current forecast targets 150; its actual target is absent. At clock 150 the earlier forecast's target is revealed. [replay-snapshot.json](../examples/replay-snapshot.json) shows the complete first response. Only eligible issue seconds are accepted; gaps/out-of-range clocks return 422.

## Evidence and simulation

`GET /v1/evidence` returns `metadata`, `training` and `test`. Test errors are measured laboratory forecasting evidence. Saved scenario indexes/traces and `POST /v1/simulate` are separately labelled uncalibrated site-control experiments; see [simulation.md](simulation.md).

Simulation request: `scenario_id` is one of `low-risk`, `east`, `diagonal`, `wind-shift`, `data-loss`. Optional fields/defaults/ranges:

| Field | Default | Range |
|---|---:|---|
| `source_scale` | 1.0 | 0.25–2.0 |
| `wind_from_degrees` | null (case default) | 0 inclusive to 360 exclusive |
| `wind_speed_metres_second` | 3.0 | 0.5–12.0 |
| `flow_litres_minute_per_zone` | 0.5 | 0.1–2.0 |
| `mist_source_fraction_removed` | 0.65 | 0–0.95 |

All strategies receive the same changed assumptions. Returned `runs` has `no_control`, `continuous`, `reactive`, `predictive`, each with its trace and metrics. These outputs do not establish physical savings or field boundary accuracy.

## Errors and browser access

| Status | Meaning | Frontend action |
|---|---|---|
| 422 | Invalid input/clock | Display the error; fix the history or selected clock |
| 404 | Unknown recording/scenario/route | Use IDs from the index |
| 503 | Live model or requested simulation unavailable | Label unavailable; use explicitly saved replay when offered |
| Browser fetch failure | Network/server/origin problem | Check address, server readiness and configured origin; clear live values |

Configure exact origins through `DUSTTWIN_ALLOWED_ORIGINS`, comma-separated without paths. Example: `http://localhost:5173,http://127.0.0.1:5173`. Those two hostnames are distinct origins. GET/POST and Content-Type are permitted for listed origins; credentials are not required. The setting controls browser access, not service authentication. Default is same-origin only.

Frozen artifact SHA-256: `d78f1b37269f72af45933e01722968fb13ed82178f6d8b3e4c5584d46cec09c7`. The loader verifies that artifact plus the feature source, frozen configuration, Python version and model library pins. Changing those files without a declared model version prevents live loading.
