# Forecast and control evaluation protocol

Status: D2 preparation, M1 training/reload and M2 frozen held-out evaluation are complete on 1 October 2026. The authoritative task configuration is `configs/forecast-task.json`; D008 records the dataset change. [Preparation evidence](preparation.md) defines exact features/counts, [training evidence](training.md) records validation selection, and [the model card](../models/model-card.md) reports the mixed final result. Test data must not be reused to tune this artifact.

## First measured-data task

Given the previous 120 seconds of recorded OPC-N3 PM10, predict the latest observed PM10 snapshot at a grid time 30 seconds later. Use the raw `PM10(ug/m3)` field in `10.17632/7f22n9v7hp.1`. Exclude `RollMean_*` fields and analysed workbooks. Initial model features use only past PM10; measured optional channels require an explicit later experiment. The source provides one OPC instrument across laboratory sessions. It was selected by data availability/provenance, without evaluating any model's final test performance.

Native record intervals are approximately one second, with some timestamps rounded to whole seconds. Use elapsed time within each recording. Keep the last original row for a duplicate timestamp, count the removals, and create a one-second grid from that recording's first observation. At each grid time use only the latest raw reading at or before it. A reading older than 1.5 seconds is unavailable. No interpolation from future readings is allowed.

Include both lookback endpoints: `[t - 120, t]` contains 121 snapshots. The target is the available snapshot at `t + 30`, not the next 30th row of an irregular file. Reject windows containing an unavailable history or target. Export the contributing observation times/ages so a target's up-to-1.5-second freshness tolerance is visible. Never bridge recordings or invent missing dates.

## Data preparation and separation

1. Preserve original observations and file hashes. Record every filter, rejected row and conversion.
2. Sort by experiment, sensor and time; resolve duplicates deterministically. Derive inputs only from observations at or before forecast issue time.
3. Use whole labelled groups: every laboratory recording in groups 1/2 is training, group 3 is validation and group 4 is final test. Outdoor recordings are excluded from this first task. The audit found missing calendar dates and nonchronological folder ordering, so this is a group holdout, not a strict global chronological split. Group 4 is labelled temperature increased; disclose that changed-condition test. Freeze the assignment before fitting.
4. Construct samples whose full history and target lie within a single recording and its assigned partition. No training target or feature value may come from another recording, validation or test. D2 reports actual retained windows and exclusions, not just raw row counts.
5. Fit preprocessing and normalization on training only. Avoid bidirectional interpolation, centered smoothing and backfilling from future values. Training-only fitted imputation or causal forward filling may be used when justified; score only targets actually observed.
6. Keep test labels inaccessible to model selection. Report the experimental-regime limitations; do not move group assignments to find a favorable result. Quality auditing of source files is complete, but no final model error has been computed.

The accepted archive has twelve laboratory file recordings in four labelled groups, from one instrument/setup. A repeated condition or thousands of overlapping windows do not imply thousands of independent construction events. Record file/group counts and disclose what remains unknown about statistical independence. The rejected forty-minute file is not used for training.

## Baselines and model selection

- Persistence: `prediction(t + H) = observed PM10(t)`.
- Trailing mean: mean of observed PM10 over the preceding 60 seconds, with a fixed rule for available history.
- Learned baseline: ridge regression using causal lag values and trailing statistics, with alpha chosen from 0.1, 1 and 10.
- Candidate: one small gradient-boosted tree ensemble, initially depths 2/3 and 50/100 iterations. Disable any default random holdout that violates the chronological protocol. Freeze all other parameters, seed and dependency versions.

Features: recent PM10 lags and past-only mean/std/slope over 30/60/120 seconds. Exclude event elapsed time, drilling-duration labels, experiment identity, future activity labels, total-future statistics and simulator hidden state. If adding channels/monitors later, declare that task and its split before inspecting final test results.

Choose the learned model by validation MAE, then RMSE and simplicity. Retraining on combined train/validation is a documented later choice; keep the initial selection run and artifact reproducible. Evaluate the selected frozen artifact on test once. Do not force the learned model to win; persistence can be competitive.

## Outputs and reporting

Save `models/model-card.md`, feature/schema configuration, split manifest, training settings, model artifact hash and JSON metrics. Store test forecast traces with issue time, horizon, actual target time, observed value, each prediction and input-availability mask. Calculate MAE/RMSE on the same eligible target samples for every model. Report sample counts, error by activity where metadata supports it, PM range and limitations. Show actual-versus-forecast plots and residuals.

Report improvement over persistence as `100 * (MAE_persistence - MAE_model) / MAE_persistence` when the denominator is positive. This is forecast error improvement, not pollution reduction. Do not publish an accuracy percentage for regression without defining it.

Uncertainty intervals are optional before Round 1. If implemented, use a dedicated calibration partition and evaluate coverage; do not invent confidence values or style standard residual bands as calibrated probabilities. Training loss, feature importance and a trend explanation are not proof of an individual prediction's correctness.

## Event warnings

Use a named demo operating threshold chosen without test tuning. Define an event as a threshold crossing with a stated persistence duration and cooldown. Match warnings to events using a fixed forecast window. Report recall, precision/false alerts and first-warning lead time with event counts. If too few independent crossings exist, report descriptively rather than claiming stable event accuracy.

Show “already exceeded” for current exceedance, a finite ETA only for a predicted future crossing, and “no crossing within H” otherwise. A single endpoint forecast supports concentration at that endpoint; it does not determine exact within-horizon crossing time. Exact ETA requires an explicit predicted trajectory and must name its method.

## Separate control simulation experiment

Use one shared environment runner for no control, continuous, reactive and predictive control. Freeze geometry, event timeline, weather, sensor observation model, pump capacity, nozzle response and initial state. Give all controllers the same information availability and actuator timing constraints, except for the predictor available to predictive control.

Evaluate low risk, an eastward plume, diagonal exposure, a wind shift and a data-loss case. Save seeds/configs and generate all chart values from traces. Report mean/peak boundary PM, sampled exceedance duration, integrated exposure proxy, litres, zone duty and switching. Define whether aggregation is maximum across boundaries, mean across boundaries or per-boundary; use the same rule for all controllers.

For a one-second simulation, litres are the sum of each active interval's configured litres/minute multiplied by interval seconds/60. Keep ambient PM separate from the source contribution. Treat humidity effects, nozzle effectiveness and transport parameters as assumptions until calibrated. Simulated suppression values cannot establish causal effects in the recorded experiment, which contains no matched intervention trial.

## Required checks

- Feature timestamps and forecast targets enforce the selected horizon and partition boundaries.
- A gap/sensor change does not silently become a continuous training window.
- The saved artifact reloads and reproduces a small fixed prediction fixture.
- API and offline replay agree on the same input snapshot and artifact.
- No-control water is zero; pause freezes simulation time/water; flow and durations determine litres.
- Every controller uses the same environment assumptions; every threshold-risk boundary is handled or explicitly capacity-limited.
- Results-page numbers equal saved evaluation/experiment outputs and use consistent units.

Run focused tests for these risks when implementing. Documentation-only planning does not require placeholder implementation tests.
