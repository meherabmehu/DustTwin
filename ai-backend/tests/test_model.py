"""Artifact compatibility checks and the shared history inference path."""

import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from dusttwin.model import ForecastModel


@unittest.skipUnless((ROOT / "models/artifacts/pm10-initial.joblib").exists(), "Download or train the artifact first; verify_model.py requires it")
class SavedModelTests(unittest.TestCase):
    def test_history_and_features_reproduce_saved_predictions(self):
        model = ForecastModel(ROOT)
        fixture = json.loads((ROOT / "reports/training/prediction-fixture.json").read_text())
        for prediction in (model.predict_features(fixture["features"]), model.predict_history(fixture["history_pm10_ug_m3"])):
            np.testing.assert_allclose(prediction, fixture["expected_predictions_ug_m3"], rtol=0, atol=1e-8)

    def test_invalid_history_and_feature_inputs_fail(self):
        model = ForecastModel(ROOT)
        for bad in (np.zeros((1, 120)), np.full((1, 121), np.nan), -np.ones((1, 121))):
            with self.assertRaises(ValueError):
                model.predict_history(bad)
        for bad in (np.zeros((1, 15)), np.full((1, 16), np.inf)):
            with self.assertRaises(ValueError):
                model.predict_features(bad)

    def test_changed_config_and_corrupt_artifact_fail_before_loading(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ("models/model-metadata.json", "src/dusttwin/preparation.py",
                         "configs/forecast-task.json", "configs/features.json", "configs/training.json", "configs/demo-events.json"):
                destination = root / name
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / name, destination)
            path = root / "models/artifacts/pm10-initial.joblib"
            path.parent.mkdir(parents=True)
            path.write_bytes(b"corrupted serialized data must never be loaded")
            with self.assertRaisesRegex(ValueError, "checksum"):
                ForecastModel(root)
            (root / "configs/features.json").write_text("{}")
            with self.assertRaisesRegex(ValueError, "configuration differ"):
                ForecastModel(root)


if __name__ == "__main__":
    unittest.main()
