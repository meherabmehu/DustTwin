# DustTwin initial PM10 model

Date: 1 October 2026 (Asia/Dhaka). Model ID `hist_gb_depth3_iter100`; experiment `pm10_initial_group_holdout_v1`. Preliminary laboratory forecast, not a validated construction-site control system.

## Intended demonstration

Given 121 causal one-second snapshots of recorded OPC-N3 PM10 covering the preceding 120 seconds, predict the latest observed snapshot at grid time 30 seconds later, in µg/m³. Display the input history, the saved trained model's prediction and the subsequently revealed recorded value, with both simple baselines. There is no calibrated confidence probability or exact within-horizon crossing ETA.

The model is a histogram gradient-boosted regressor: 100 trees, maximum depth 3, squared-error loss, learning rate 0.1. Sixteen PM10 lag/mean/std/slope features are defined in [features.json](../configs/features.json). Negative outputs are clipped to zero without upper clipping. The model receives no episode clock, experiment identity, drilling label, future activity, wind or simulated hidden state.

## Data and separation

Komiljon Askarov and Jae-ho Choi (2024), [Mendeley Data V1](https://data.mendeley.com/datasets/7f22n9v7hp/1), DOI `10.17632/7f22n9v7hp.1`, CC BY 4.0. Derived from raw `PM10(ug/m3)` in twelve laboratory OPC-N3 recordings; rolling means, analysed summaries, outdoor files and other instruments are excluded. Attribution is also in the README. Contributors do not endorse this project.

Whole groups 1/2 train (24,818 windows), group 3 selects (12,113), group 4 tests (15,065). Group 4 is labelled temperature increased. The fitted artifact uses training only: no validation refit or test-driven parameter change. Stable duplicate handling removed 18 rows; grid snapshots hold only earlier observations, at most 1.5 seconds old. Target observation age on test is at most 1.135 seconds. Test targets span 0.47–5,368.87 µg/m³.

There are twelve file recordings from one instrument/setup and only three held-out recordings in one related group. Many windows overlap; 15,065 windows are not independent experiments. Missing calendar dates and overlapping dates prevent a strict globally chronological claim. See [audit](../docs/dataset-audit.md) and [preparation](../docs/preparation.md).

## Results

| Partition / forecast | MAE (µg/m³) | RMSE (µg/m³) |
|---|---:|---:|
| Validation persistence | 150.493 | 392.608 |
| Validation trailing mean | 132.725 | 407.965 |
| Validation selected model | 117.186 | 305.217 |
| Test persistence | 95.702 | 199.384 |
| **Test trailing mean** | **81.565** | 200.713 |
| **Test selected model** | 88.405 | **179.272** |

Test MAE is 7.62% lower than persistence, but 8.39% higher than trailing mean. The trained model has the lowest pooled RMSE of the three. Mean signed test error is +9.45 µg/m³. These are measured laboratory forecast errors, not an “accuracy percentage”, pollution reduction or water savings.

| Test recording | Persistence MAE | Trailing mean MAE | Model MAE | Model mean signed error |
|---|---:|---:|---:|---:|
| Group 4, 10-second drilling label | 56.538 | **43.615** | 81.588 | +55.884 |
| Group 4, 50-second label | 88.746 | 74.074 | **70.027** | +5.882 |
| Group 4, 90-second label | 146.298 | 131.457 | **116.954** | −36.952 |

All values above use µg/m³. The short-drilling recording is a clear failure: low concentrations are sometimes overpredicted late in the recording. Abrupt onset/large peaks remain difficult. Worst absolute model errors in the three recordings are 1,017.48, 1,841.71 and 3,619.17 µg/m³. Inputs limited to past PM cannot reliably anticipate an activity change with no observed precursor.

Full JSON, complete compressed traces and plots are in [reports/evaluation](../reports/evaluation/). [Full profiles](../reports/evaluation/test-full-profiles.png), [largest-error windows](../reports/evaluation/test-failure-windows.png) and [residuals](../reports/evaluation/test-residuals.png) include all three held-out recordings; failure plots are selected by largest absolute error, not strongest performance.

## Descriptive warning experiment

Rules were frozen before final testing in [demo-events.json](../configs/demo-events.json). The 500 µg/m³ setting is illustrative, not a health/regulatory limit. Events require five consecutive available above-setting snapshots, with onset cooldown. Warnings use an endpoint forecast above the setting while the current reading is below it; matching is one-to-one within the next 30 seconds, with a 60-second warning cooldown.

Across the three test recordings there are 18 qualified threshold runs, many recrossings within the same drilling/decay recording. These are not 18 independent activity events.

| Forecast | Matched runs / 18 | False alerts | Scored alerts | Mean matched lead |
|---|---:|---:|---:|---:|
| Persistence | 0 | 0 | 0 | Undefined |
| Trailing mean | 13 | 8 | 21 | 6.92 seconds |
| Trained model | 13 | 15 | 28 | 5.69 seconds |

The trained model's descriptive precision is 13/28 (46.4%) and recall 13/18 (72.2%). These small, correlated counts do not establish stable warning accuracy. The trailing mean warns with fewer false alerts. Persistence cannot issue an advance warning under the declared rule because its prediction equals the current reading. Of each recording's first qualified onset, the learned model warns in advance for only one of three (9 seconds lead in the 90-second-label recording). A nominal 30-second prediction horizon does not mean 30 seconds of useful warning.

## Artifact and reproduction

Artifact: `models/artifacts/pm10-initial.joblib`, 54,679 bytes; SHA-256 `d78f1b37269f72af45933e01722968fb13ed82178f6d8b3e4c5584d46cec09c7`. [Metadata](model-metadata.json) records dependency, configuration, source and prepared-data hashes, the fit's parent commit and the fact that newly added training code was uncommitted during the initial execution. Its exact source is committed with the verified M1 milestone. [The downloadable model release](https://github.com/arifshekhk8/DustTwin-AI/releases/tag/pm10-model-v1) preserves this fitted artifact outside ordinary Git.

Python 3.14.6, numpy 2.5.3, scikit-learn 1.9.1, scipy 1.18.1, joblib 1.6.0. [requirements-model.txt](../requirements-model.txt) pins the environment. The initial Apple M4 run took 0.2133 seconds for seven fits; selected fit 0.0550 seconds; total run 0.3163 seconds excluding library imports/startup. This is a measured small tabular run, with no GPU or Kaggle.

```sh
.venv/bin/python scripts/download_model.py
.venv/bin/python scripts/verify_model.py
.venv/bin/python scripts/verify_evaluation.py
```

For independent training reproduction, acquire and prepare data using the README, then run `scripts/train_models.py` with the unchanged frozen grid. Preserve the initial published evidence/artifact; do not tune against these revealed test results. Final-evaluation reruns verify saved hashes instead of choosing a different model. Fresh-process reload, shared history/features, corruption/configuration rejection, causal preparation and exported-trace metric checks passed. All twelve focused tests pass with the artifact present.

## Practical limits and next work

Keep the learned model and baselines separately visible in replay. Preserve the validation-selected model despite the test trailing-mean advantage; any later model research needs a new untouched group/site evaluation. Connect the actual artifact to an input-validated local service next.

Do not use this model as a field safety controller. It does not demonstrate calibrated reference accuracy, boundary prediction, multi-site reliability, emissions estimation, misting effectiveness or physical water savings. Site transport and strategy comparisons must remain identified as simulation. Round 1 is software only; hardware starts with the team's explicit Round 2 instruction.
