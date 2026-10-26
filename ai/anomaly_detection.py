"""
Smart Spectacles: Isolation Forest inference interface.

Expected model file:
    ai/models/isolation_forest.joblib

Expected feature order:
    uv, gas, light, distance

This module does not train a model. If a usable trained model is
unavailable, it returns an explicit unavailable status.
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
            self.model = joblib.load(self.model_path)

            if not callable(getattr(self.model, "predict", None)):
                raise TypeError("Model does not provide predict().")

            if not callable(
                getattr(self.model, "decision_function", None)
            ):
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
    def _validate_readings(
        readings: dict,
    ) -> Optional[list[float]]:
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
        values = self._validate_readings(readings)

        if values is None:
            return {
                "status": "invalid_input",
                "anomaly": None,
                "score": None,
                "message": (
                    "Provide finite numeric values for uv, gas, "
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
                    "No usable trained model is available. "
                    "Training and validation are required."
                ),
                "validatedForRealWorldUse": False,
            }

        try:
            features = np.asarray([values], dtype=float)

            prediction = int(self.model.predict(features)[0])
            score = float(
                self.model.decision_function(features)[0]
            )

            if prediction not in (-1, 1) or not math.isfinite(score):
                raise ValueError("Model returned an invalid prediction.")

            is_anomaly = prediction == -1

            return {
                "status": "prediction_available",
                "anomaly": is_anomaly,
                "score": round(score, 6),
                "message": (
                    "Anomaly candidate detected."
                    if is_anomaly
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


# Create one detector for later integration.
detector = AnomalyDetector()


def detect_anomaly(readings: dict) -> dict:
    """Public entry point for future sensor-data integration."""
    return detector.predict(readings)


if __name__ == "__main__":
    print("Smart Spectacles - Anomaly Detection Check")
    print("-" * 45)

    print(f"Model status: {detector.status}")

    if detector.error:
        print(f"Model loading error: {detector.error}")

    example_readings = {
        "uv": 2800,
        "gas": 1800,
        "light": 850,
        "distance": 35,
    }

    result = detect_anomaly(example_readings)

    print("Example input:", example_readings)
    print("Result:", result)
    print("\nCheck complete. No Firebase data was changed.")