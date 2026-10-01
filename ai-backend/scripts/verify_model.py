"""Reload the saved artifact in a fresh process and verify its fixed fixture."""

import json
from pathlib import Path
import sys

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from dusttwin.model import ForecastModel


def main() -> None:
    model = ForecastModel(ROOT)
    fixture = json.loads((ROOT / "reports/training/prediction-fixture.json").read_text())
    expected = fixture["expected_predictions_ug_m3"]
    features = model.predict_features(fixture["features"])
    histories = model.predict_history(fixture["history_pm10_ug_m3"])
    np.testing.assert_allclose(features, expected, rtol=0, atol=fixture["absolute_tolerance"])
    np.testing.assert_allclose(histories, expected, rtol=0, atol=fixture["absolute_tolerance"])
    print(json.dumps({"model_id": model.metadata["model_id"], "fixture_predictions": len(features),
                      "reload_and_shared_history_features": "passed", "artifact_sha256": model.metadata["artifact_sha256"]}))


if __name__ == "__main__":
    main()
