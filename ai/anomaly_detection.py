"""
SightSync Isolation Forest anomaly detection with automatic safe-reading training.

The model learns from live sensor combinations only when the caller explicitly
confirms the sample passed independent fixed/adaptive warning checks. It never
uses anomaly output to relax or replace safety limits.
"""
from pathlib import Path
from typing import Optional
import json
import math

try:
    import joblib
    import numpy as np
    from sklearn.ensemble import IsolationForest
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    ML_DEPENDENCIES_AVAILABLE = True
except ImportError:
    joblib = None
    np = None
    IsolationForest = None
    make_pipeline = None
    StandardScaler = None
    ML_DEPENDENCIES_AVAILABLE = False

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"
MODEL_PATH = MODEL_DIR / "isolation_forest.joblib"
SAMPLES_PATH = MODEL_DIR / "normal_sensor_samples.json"
FEATURE_NAMES = ("uv", "gas", "light", "distance")
MIN_TRAINING_SAMPLES = 100
RETRAIN_EVERY_NEW_SAMPLES = 25
MAX_SAMPLES = 2000


class AnomalyDetector:
    def __init__(self, model_path: Path = MODEL_PATH, samples_path: Path = SAMPLES_PATH):
        self.model_path = Path(model_path)
        self.samples_path = Path(samples_path)
        self.model = None
        self.status = "model_unavailable"
        self.error = None
        self.training_rows = 0
        self._load_model()

    def _load_model(self) -> None:
        if not ML_DEPENDENCIES_AVAILABLE:
            self.model = None
            self.status = "dependencies_missing"
            self.error = "Install ai/requirements-ml.txt to enable anomaly model training/inference."
            return
        if not self.model_path.is_file():
            self.model = None
            self.status = "collecting_samples"
            return
        try:
            model = joblib.load(self.model_path)
            if not callable(getattr(model, "predict", None)) or not callable(getattr(model, "decision_function", None)):
                raise TypeError("Model does not provide predict() and decision_function().")
            self.model = model
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
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                return None
            values.append(float(value))
        return values

    def _read_samples(self) -> list[list[float]]:
        if not self.samples_path.is_file():
            return []
        try:
            raw = json.loads(self.samples_path.read_text(encoding="utf-8"))
            if not isinstance(raw, list):
                return []
            valid = []
            for row in raw:
                if isinstance(row, list) and len(row) == len(FEATURE_NAMES):
                    if all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in row):
                        valid.append([float(v) for v in row])
            return valid[-MAX_SAMPLES:]
        except (OSError, ValueError, TypeError):
            return []

    def observe_normal_reading(self, readings: dict, eligible_for_learning: bool) -> dict:
        """Collect only readings already cleared by independent warning checks."""
        values = self._validate_readings(readings)
        if not eligible_for_learning or values is None:
            # Keep model state accurate even when the current reading is unsafe.
            # An ineligible reading pauses collection; it does not untrain an existing model.
            existing_samples = len(self._read_samples())
            return {
                "trainingStatus": self.status,
                "trainingSamples": existing_samples,
                "sampleAccepted": False,
                "modelTrained": self.model is not None,
                "trainingRows": self.training_rows or (existing_samples if self.model is not None else 0),
            }
        samples = self._read_samples()
        samples.append(values)
        samples = samples[-MAX_SAMPLES:]
        try:
            self.samples_path.parent.mkdir(parents=True, exist_ok=True)
            self.samples_path.write_text(json.dumps(samples, allow_nan=False), encoding="utf-8")
        except OSError as exc:
            self.error = str(exc)
            return {"trainingStatus": "sample_save_error", "trainingSamples": len(samples), "sampleAccepted": False}

        if not ML_DEPENDENCIES_AVAILABLE:
            return {"trainingStatus": "dependencies_missing", "trainingSamples": len(samples), "sampleAccepted": True, "modelTrained": False}
        needs_first_model = self.model is None and len(samples) >= MIN_TRAINING_SAMPLES
        needs_retrain = self.model is not None and len(samples) >= MIN_TRAINING_SAMPLES and (
            (len(samples) - MIN_TRAINING_SAMPLES) % RETRAIN_EVERY_NEW_SAMPLES == 0
        )
        if needs_first_model or needs_retrain:
            try:
                # Isolation Forest is fit only on samples already cleared by fixed/adaptive checks.
                model = make_pipeline(
                    StandardScaler(),
                    IsolationForest(
                        n_estimators=200,
                        contamination=0.03,
                        random_state=42,
                        n_jobs=-1,
                    ),
                )
                model.fit(np.asarray(samples, dtype=float))
                self.model_path.parent.mkdir(parents=True, exist_ok=True)
                joblib.dump(model, self.model_path)
                self.model = model
                self.status = "model_loaded"
                self.training_rows = len(samples)
                self.error = None
            except Exception as exc:
                self.error = str(exc)
                self.status = "training_error"
        return {
            "trainingStatus": self.status,
            "trainingSamples": len(samples),
            "sampleAccepted": True,
            "modelTrained": self.model is not None,
            "trainingRows": len(samples) if self.model is not None else 0,
        }

    def predict(self, readings: dict) -> dict:
        values = self._validate_readings(readings)
        if values is None:
            return {
                "status": "invalid_input", "anomaly": None, "score": None,
                "message": "Provide finite numeric values for uv, gas, light and distance.",
                "validatedForRealWorldUse": False,
            }
        if self.model is None:
            samples = len(self._read_samples())
            return {
                "status": self.status, "anomaly": None, "score": None,
                "trainingSamples": samples,
                "trainingSamplesRequired": MIN_TRAINING_SAMPLES,
                "message": f"Model not trained yet. Collecting readings that pass fixed/adaptive safety checks ({samples}/{MIN_TRAINING_SAMPLES} eligible samples); predictions start after training.",
                "validatedForRealWorldUse": False,
            }
        try:
            if not ML_DEPENDENCIES_AVAILABLE:
                raise RuntimeError("Install ai/requirements-ml.txt to enable anomaly inference.")
            features = np.asarray([values], dtype=float)
            prediction = int(self.model.predict(features)[0])
            score = float(self.model.decision_function(features)[0])
            if prediction not in (-1, 1) or not math.isfinite(score):
                raise ValueError("Model returned an invalid prediction.")
            return {
                "status": "prediction_available",
                "anomaly": prediction == -1,
                "score": round(score, 6),
                "trainingRows": self.training_rows or len(self._read_samples()),
                "message": "Anomaly candidate detected." if prediction == -1 else "No anomaly flagged by the model.",
                "validatedForRealWorldUse": False,
                "note": "An anomaly is not automatically a hazard; fixed safety checks remain authoritative.",
            }
        except Exception as exc:
            return {
                "status": "inference_error", "anomaly": None, "score": None,
                "message": str(exc), "validatedForRealWorldUse": False,
            }


detector = AnomalyDetector()


def detect_anomaly(readings: dict) -> dict:
    return detector.predict(readings)


def observe_normal_reading(readings: dict, eligible_for_learning: bool) -> dict:
    return detector.observe_normal_reading(readings, eligible_for_learning)


if __name__ == "__main__":
    example = {"uv": 2800, "gas": 1800, "light": 850, "distance": 35}
    print("Model status:", detector.status)
    print("Example:", detect_anomaly(example))
    print("No Firebase data is changed by this check.")
