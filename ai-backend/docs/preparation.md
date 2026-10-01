# Causal preparation — completed D2

Date: 1 October 2026, Asia/Dhaka. Task `construction_pm10_30s_v1` and group assignments remain unchanged from D008. Feature definitions are frozen in [configs/features.json](../configs/features.json).

## What changed from the source

Raw files remain unchanged. Each recording starts its own elapsed one-second grid. Stable timestamp ordering keeps the last original row at a duplicate timestamp. Each grid snapshot uses the latest observation strictly at or before that time. No future interpolation, centered filtering or backfilling is used. A snapshot older than 1.5 seconds, nonfinite or negative is unavailable.

The audit found 18 duplicate rows, all in `lab_e4_drill90`; these are removed. The twelve laboratory files produce 53,796 grid snapshots from 53,717 native rows. Small native gaps do not produce stale snapshots at the integer grid times: the actual maximum ages remain within 1.5 seconds. This is a held observation, not a newly measured value.

Every forecast uses 121 snapshots from `[t - 120, t]`. Its target is the available snapshot at grid time `t + 30`. The contributing target observation can precede that grid time by up to 1.5 seconds. Histories and targets cannot cross recording boundaries. The first 120 and last 30 grid issue times of each recording are excluded for incomplete coverage: 1,800 times in total. All 51,996 remaining candidate windows meet the quality rule; none is rejected for stale/missing history or target in this particular source.

## Prepared split

| Partition | Whole groups | Recordings | Eligible windows |
|---|---|---:|---:|
| Training | 1, 2 | 6 | 24,818 |
| Validation | 3 | 3 | 12,113 |
| Final test | 4, temperature increased | 3 | 15,065 |

Windows overlap heavily. These counts are not independent-event counts. No strict calendar ordering, cross-site independence or field accuracy is established.

## Features and baselines

Sixteen PM10-only features: lags at 0, 1, 5, 10, 30, 60 and 120 seconds; then mean, population standard deviation and least-squares slope over the previous 30, 60 and 120 seconds. Each statistic includes both endpoints (31, 61 or 121 snapshots). Concentrations use µg/m³ and slope uses µg/m³/second. Issue time, group, recording identity and drilling labels are metadata only, never model features.

Persistence predicts the issue snapshot. Trailing mean averages the preceding 60 seconds including the issue snapshot (61 values). Both baselines use exactly the same eligible targets as learned models.

Validation-only baseline results:

| Forecast | MAE (µg/m³) | RMSE (µg/m³) |
|---|---:|---:|
| Persistence | 150.493 | 392.608 |
| Trailing mean, 60 seconds | 132.725 | 407.965 |

These are baseline errors, not trained-model accuracy or pollution reduction. Final test model errors have not been inspected in D2.

## Provenance and reproduction

[The split manifest](../reports/preparation/split-manifest.json) records source/member hashes, configuration hashes, feature order, per-file exclusions and semantic array hashes. Ignored `data/processed/construction_pm10_30s_v1/` holds partition arrays and per-recording grids. Grids retain original row indices, contributing observation times, ages and availability, allowing every 121-point history to be reconstructed. Partition arrays include exact issue/target grid times, target observation times and freshness.

```sh
.venv/bin/python scripts/prepare_data.py
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python scripts/verify_preparation.py
```

Six focused tests passed: future perturbation, irregular-time horizon, duplicate handling, stale history/target rejection, analytic features and group/recording separation. Verification against unchanged native files passed for all 51,996 windows, including hashes, complete eligibility, native provenance and strict causality. Test-label preparation/quality verification does not select or score a model.
