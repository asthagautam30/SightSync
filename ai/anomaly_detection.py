"""
Smart Spectacles: Isolation Forest inference interface.

Expected model file:
    ai/models/isolation_forest.joblib

Expected feature order:
    uv, gas, light, distance

No model is trained by this module. If a trained model is unavailable,
the module returns an explicit unavailable status rather than inventing
an anomaly prediction.
"""

from pathlib import Path
from typing import Optional
import math

import joblib
import numpy as np


BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "isolation_forest.joblib"

FEATURE_NAMES = ("uv", "gas", "light", "distance")


class AnomalyDetector:
    def __init__(self, model_path: Path = MODEL_PATH):
        self.model_path = Path(model_path)
        self.model = None
        self.status = "model_unavailable"
        self.error = None
        self._load_model()

    def _load_model(self) -> None:
        if not self.model_path.is_file():
            self.status = "model_unavailable"
            return

        try:
            # Only load model files from a trusted source.
            self.model = joblib.load(self.model_path)

            if not callable(getattr(self.model, "predict", None)):
                raise TypeError("Loaded model does not provide predict().")

            if not callable(getattr(self.model, "decision_function", None)):
                raise TypeError(
                    "Model does not provide decision_function()."
                )

            self.status = "model_loaded"
            self.error = None

        except Exception as exc:
            self.model = None
            self.status = "model_load_error"
            self.error = str(exc)

    @staticmethod
    def _validate_readings(readings: dict) -> Optional[list[float]]:
        if not isinstance(readings, dict):
            return None

        values = []

        for name in FEATURE_NAMES:
            value = readings.get(name)

            if (
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or not math.isfinite(value)
            ):
                return None

            values.append(float(value))

        return values

    def predict(self, readings: dict) -> dict:
        """
        Return a result for one complete sensor snapshot.

        `anomaly` is None when inference cannot be performed.
        A valid result is not a safety certification.
        """
        values = self._validate_readings(readings)

        if values is None:
            return {
                "status": "invalid_input",
                "anomaly": None,
                "score": None,
                "message": (
                    "Expected finite numeric values for uv, gas, "
                    "light and distance."
                ),
                "validatedForRealWorldUse": False,
            }

        if self.model is None:
            return {
                "status": self.status,
                "anomaly": None,
                "score": None,
                "message": (
                    "No usable trained Isolation Forest model is available. "
                    "Train and validate a model before enabling predictions."
                ),
                "validatedForRealWorldUse": False,
            }

        try:
            features = np.asarray([values], dtype=float)

            # IsolationForest: -1 = anomaly, 1 = inlier.
            prediction = int(self.model.predict(features)[0])
            decision_score = float(
                self.model.decision_function(features)[0]
            )

            if prediction not in (-1, 1) or not math.isfinite(decision_score):
                raise ValueError("Model returned an invalid prediction.")

            return {
                "status": "prediction_available",
                "anomaly": prediction == -1,
                "score": round(decision_score, 6),
                "scoreMeaning": (
                    "Lower decision_function scores indicate more unusual "
                    "samples relative to this model."
                ),
                "message": (
                    "Anomaly candidate detected."
                    if prediction == -1
                    else "No anomaly flagged by the model."
                ),
                "validatedForRealWorldUse": False,
            }

        except Exception as exc:
            return {
                "status": "inference_error",
                "anomaly": None,
                "score": None,
                "message": str(exc),
                "validatedForRealWorldUse": False,
            }


# Convenient module-level detector for later integration.
detector = AnomalyDetector()


def detect_anomaly(readings: dict) -> dict:
    """Public entry point for the future Firebase integration."""
    return detector.predict(readings)