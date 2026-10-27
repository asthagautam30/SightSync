"""Regression tests for Isolation Forest inference and automatic training."""
import tempfile
import unittest
from pathlib import Path

from ai.anomaly_detection import AnomalyDetector


class IsolationForestTests(unittest.TestCase):
    def test_missing_model_is_explicitly_unavailable(self):
        with tempfile.TemporaryDirectory() as directory:
            detector = AnomalyDetector(Path(directory) / "missing.joblib", Path(directory) / "samples.json")
            result = detector.predict({"uv": 100, "gas": 100, "light": 100, "distance": 100})
        self.assertIsNone(result["anomaly"])
        self.assertEqual(result["status"], "model_unavailable")
        self.assertEqual(result["trainingSamplesRequired"], 100)

    def test_invalid_sensor_values_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            detector = AnomalyDetector(Path(directory) / "missing.joblib", Path(directory) / "samples.json")
            result = detector.predict({"uv": float("nan"), "gas": 100, "light": 100, "distance": 100})
        self.assertEqual(result["status"], "invalid_input")
        self.assertIsNone(result["anomaly"])

    def test_all_four_sensors_are_required(self):
        with tempfile.TemporaryDirectory() as directory:
            detector = AnomalyDetector(Path(directory) / "missing.joblib", Path(directory) / "samples.json")
            result = detector.predict({"uv": 100, "gas": 100, "light": 100})
        self.assertEqual(result["status"], "invalid_input")

    def test_only_eligible_samples_are_used_and_model_trains_automatically(self):
        with tempfile.TemporaryDirectory() as directory:
            detector = AnomalyDetector(Path(directory) / "model.joblib", Path(directory) / "samples.json")
            readings = {"uv": 1000, "gas": 1000, "light": 1000, "distance": 50}
            rejected = detector.observe_normal_reading(readings, eligible_for_learning=False)
            self.assertFalse(rejected["sampleAccepted"])
            self.assertEqual(rejected["trainingSamples"], 0)

            for index in range(100):
                sample = {
                    "uv": 1000 + (index % 7),
                    "gas": 1000 + (index % 5),
                    "light": 1000 + (index % 11),
                    "distance": 50 + (index % 3),
                }
                result = detector.observe_normal_reading(sample, eligible_for_learning=True)

            self.assertTrue(result["modelTrained"])
            self.assertEqual(result["trainingSamples"], 100)
            prediction = detector.predict(readings)
            self.assertEqual(prediction["status"], "prediction_available")
            self.assertIn(prediction["anomaly"], (True, False))


if __name__ == "__main__":
    unittest.main()
