# Initial training run

Protocol frozen in commit `5050bb2` before fitting, 1 October 2026 (Asia/Dhaka). M1 is complete. [Actual validation results](../reports/training/validation-selection.json), [model metadata](../models/model-metadata.json) and [prediction fixture](../reports/training/prediction-fixture.json) record the run.

Use [training.json](../configs/training.json) and [features.json](../configs/features.json) without additional searches. Fit three StandardScaler → Ridge pipelines (alpha 0.1, 1, 10), and four histogram gradient-boosting regressors (depth 2/3 × 50/100 iterations). All use the same sixteen causal features and unchanged group split. No event clock, duration labels, PM rolling means or test labels enter fitting/selection. Equal window weighting makes longer recordings contribute more samples; overlapping windows remain dependent.

Fit the scaler using training only. Disable the tree model's automatic early stopping: its default can use an internal validation split with more than 10,000 samples ([official API](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.HistGradientBoostingRegressor.html)). Fix all parameters, seed and a four-thread maximum in the configuration. Save estimator parameters actually used, dependency versions, host information, training commit and wall-clock fit times. Timings are observed on this Mac, not a promise for other machines.

Clip negative learned predictions to zero consistently during selection, evaluation and inference; report how many were clipped. No upper clipping. Select by pooled validation MAE, then RMSE, then candidate order. Preserve both baseline results even if better. Do not refit with validation or test. The selected learned artifact remains separately identifiable from a stronger operational baseline if it loses.

Save the fitted pipeline/estimator under ignored `models/artifacts/`, plus public metadata, hashes and a fixed validation fixture. Reload in a fresh process and compare the fixture. Load only the locally generated, hash-verified artifact; serialized Python model files require a trusted source and matching library versions ([official persistence guidance](https://scikit-learn.org/stable/model_persistence.html)). `requirements-model.txt` pins this environment.

Before inspecting test performance, [demo-events.json](../configs/demo-events.json) freezes an illustrative 500 µg/m³ operating threshold, five-snapshot persistence, 60-second cooldown and 30-second warning matching. This is not a regulatory limit. Report descriptive event counts and failed warnings with the limited recording count. An endpoint prediction cannot give an exact crossing ETA.

## Observed validation comparison

| Forecast | MAE (µg/m³) | RMSE (µg/m³) | Fit seconds |
|---|---:|---:|---:|
| Persistence | 150.493 | 392.608 | — |
| Trailing mean | 132.725 | 407.965 | — |
| Ridge α 0.1 | 129.266 | 331.859 | 0.0105 |
| Ridge α 1 | 129.197 | 331.710 | 0.0055 |
| Ridge α 10 | 128.954 | 331.191 | 0.0059 |
| Boosted trees depth 2, 50 iterations | 125.513 | 315.468 | 0.0516 |
| Boosted trees depth 2, 100 iterations | 120.660 | 307.739 | 0.0479 |
| Boosted trees depth 3, 50 iterations | 119.185 | 306.970 | 0.0369 |
| **Selected: depth 3, 100 iterations** | **117.186** | **305.217** | **0.0550** |

The selected learned model reduces validation MAE by 22.13% relative to persistence. This is validation forecast error improvement only. Its mean signed validation error is −21.75 µg/m³, and performance differs by recording; see the full JSON. No negative validation predictions required clipping. The final test was unscored at the M1 checkpoint; subsequent M2 results are reported separately in [the model card](../models/model-card.md).

On this Apple M4, seven fits took 0.2133 seconds in total. The preparation-loading/fit/validation/artifact run took 0.3163 seconds **excluding imports**. Dependency installation and first library startup are outside those timings. No GPU or Kaggle was used. The selected compressed artifact is 54,679 bytes with SHA-256 `d78f1b37269f72af45933e01722968fb13ed82178f6d8b3e4c5584d46cec09c7`.

```sh
.venv/bin/python -m pip install -r requirements-model.txt
.venv/bin/python scripts/train_models.py
.venv/bin/python scripts/verify_model.py
.venv/bin/python -m unittest discover -s tests -v
```

The initial fit's parent commit and exact source hashes are recorded. Its new training/loader files were not yet committed during execution; they are published with this verified milestone, rather than pretending the fit used an earlier committed implementation. The fresh-process reload reproduced five fixed validation predictions within 1e-8, both from features and from 121-point histories. Training-only scaler and disabled early-stopping checks passed during fitting. After final evaluation, do not change this grid/artifact to improve test results; declare a new task for any later experiment.
