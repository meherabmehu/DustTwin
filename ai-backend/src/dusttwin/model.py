"""Load the trusted fitted artifact and use the same features as training."""

import importlib.metadata
import json
from pathlib import Path
import sys

import joblib
import numpy as np
from threadpoolctl import threadpool_limits

from .preparation import feature_matrix, feature_names, file_sha256


def nonnegative_predictions(model, features: np.ndarray) -> tuple[np.ndarray, int]:
    raw = np.asarray(model.predict(features), dtype=np.float64)
    if not np.isfinite(raw).all():
        raise ValueError("Model produced nonfinite predictions")
    return np.maximum(raw, 0), int((raw < 0).sum())


class ForecastModel:
    def __init__(self, root: Path):
        self.metadata = json.loads((root / "models/model-metadata.json").read_text())
        for package, version in self.metadata["dependencies"].items():
            if importlib.metadata.version(package) != version:
                raise ValueError(f"Artifact requires {package}=={version}")
        if list(sys.version_info[:2]) != self.metadata["python_major_minor"]:
            raise ValueError("Use the artifact's Python major/minor version")
        for name, digest in self.metadata["config_sha256"].items():
            if file_sha256(root / f"configs/{name}.json") != digest:
                raise ValueError(f"Artifact and {name} configuration differ")
        if file_sha256(root / "src/dusttwin/preparation.py") != self.metadata["source_sha256"]["src/dusttwin/preparation.py"]:
            raise ValueError("Feature/preparation implementation differs from the trained artifact")
        artifact = root / self.metadata["artifact_file"]
        if file_sha256(artifact) != self.metadata["artifact_sha256"]:
            raise ValueError("Artifact checksum does not match the recorded trusted model")
        bundle = joblib.load(artifact)
        if bundle["model_id"] != self.metadata["model_id"] or bundle["feature_names"] != self.metadata["feature_names"]:
            raise ValueError("Model identity or feature order differs")
        self.estimator = bundle["estimator"]
        self.schema = bundle["feature_schema"]
        if feature_names(self.schema) != self.metadata["feature_names"]:
            raise ValueError("Feature schema differs")

    def predict_features(self, features: np.ndarray) -> np.ndarray:
        features = np.asarray(features, dtype=np.float64)
        if features.ndim != 2 or features.shape[1] != len(self.metadata["feature_names"]) or not np.isfinite(features).all():
            raise ValueError("Invalid feature matrix")
        with threadpool_limits(limits=self.metadata["maximum_native_threads"]):
            return nonnegative_predictions(self.estimator, features)[0]

    def predict_history(self, history: np.ndarray) -> np.ndarray:
        return self.predict_features(feature_matrix(history, self.schema))
