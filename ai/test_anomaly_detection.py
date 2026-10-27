"""Regression tests for Isolation Forest inference status and input validation."""
import tempfile
import unittest
from pathlib import Path

from ai.anomaly_detection import AnomalyDetector


class IsolationForestTests(unittest.TestCase):
    def test_missing_model_is_explicitly_unavailable(self):
        with tempfile.TemporaryDirectory() as directory:
            detector = AnomalyDetector(Path(directory) / "missing.joblib")
            result = detector.predict({"uv": 100, "gas": 100, "light": 100, "distance": 100})
        self.assertIsNone(result["anomaly"])
        self.assertIn(result["status"], {"model_unavailable", "model_load_error"})

    def test_invalid_sensor_values_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            detector = AnomalyDetector(Path(directory) / "missing.joblib")
            result = detector.predict({"uv": float("nan"), "gas": 100, "light": 100, "distance": 100})
        self.assertEqual(result["status"], "invalid_input")
        self.assertIsNone(result["anomaly"])

    def test_all_four_sensors_are_required(self):
        with tempfile.TemporaryDirectory() as directory:
            detector = AnomalyDetector(Path(directory) / "missing.joblib")
            result = detector.predict({"uv": 100, "gas": 100, "light": 100})
        self.assertEqual(result["status"], "invalid_input")


if __name__ == "__main__":
    unittest.main()
