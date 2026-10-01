# Reproduce without changing the handoff

Using the fitted artifact needs no original bulk training data. The complete runtime, replay and evidence are tracked here. Start with `scripts/verify_handoff.py`, `scripts/verify_model.py` and the Python tests.

`docs/dataset-audit.md`, `preparation.md`, `training.md`, `evaluation.md` and `simulation.md` are unchanged historical documents from the upstream project. Their run dates, original commit IDs and checks refer to that source project. In particular, the original training document describes an ignored artifact directory; this handoff intentionally tracks the small published artifact. New handoff checks are recorded separately in `reports/integration/` and `following.md`.

For a source reproduction, use a separate scratch clone. Download originals using `scripts/download_data.py`; the dataset configuration and `data/manifest.json` record URLs, terms and exact checksums. Then run the audit, preparation and verification scripts from the historical documents before fitting. Do not overwrite the handed-off artifact or alter the already-revealed final-test task to obtain a better score. A new model research experiment needs an untouched evaluation set.

`train_models.py` uses only train/validation partitions but overwrites model/selection files when run. Its new training commit/timestamps will differ from the original run. The published model and results are pinned by `models/upstream-provenance.json`; file verification is expected to fail after intentionally changing those source/evidence assets. Declare and document such a new experiment separately.

The live platform verified for this handoff is Python 3.14.6 on Apple M4/macOS. The loader checks Python major/minor, exact model-package versions, artifact size/hash, preparation source and four frozen configuration hashes before executing a prediction. Other platforms need their own dependency/fixture/service checks; none are claimed as tested here.
