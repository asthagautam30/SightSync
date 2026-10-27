"""Regression tests for automated Random Forest data collection and readiness."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ai import automatic_risk_training as pipeline


class AutomaticRiskTrainingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.records_path = Path(self.temp.name) / "records.jsonl"
        self.model_path = Path(self.temp.name) / "model.joblib"
        self.data_dir = Path(self.temp.name)
        self.records_patch = patch.object(pipeline, "RECORDS_PATH", self.records_path)
        self.model_patch = patch.object(pipeline, "MODEL_PATH", self.model_path)
        self.dir_patch = patch.object(pipeline, "DATA_DIR", self.data_dir)
        self.records_patch.start()
        self.model_patch.start()
        self.dir_patch.start()
        self.addCleanup(self.records_patch.stop)
        self.addCleanup(self.model_patch.stop)
        self.addCleanup(self.dir_patch.stop)

    def test_unsafe_sample_is_recorded_but_not_eligible(self):
        record = pipeline.collect_record(
            {"uv": 3200, "gas": 1000, "light": 900, "distance": 50},
            {"uv": 1000, "gas": 1000, "light": 900, "distance": 50},
            False,
            ["uv: fixed safety threshold crossed"],
        )
        self.assertFalse(record["eligibleForRiskTraining"])
        self.assertIsNone(record["riskLabel"])
        self.assertEqual(len(pipeline.read_records()), 1)

    def test_invalid_values_cannot_be_eligible(self):
        record = pipeline.collect_record(
            {"uv": float("nan"), "gas": 1000, "light": 900, "distance": 50},
            {"uv": 1000, "gas": 1000, "light": 900, "distance": 50},
            True,
            [],
        )
        self.assertFalse(record["eligibleForRiskTraining"])
        self.assertIn("one_or_more_sensor_readings_invalid", record["eligibilityReasons"])

    def test_no_reviewed_labels_means_no_classifier_training(self):
        record = pipeline.collect_record(
            {"uv": 1000, "gas": 1000, "light": 900, "distance": 50},
            {"uv": 900, "gas": 950, "light": 850, "distance": 55},
            True,
            [],
        )
        status = pipeline.training_status([record], {})
        self.assertEqual(status["eligibleReviewedLabelCount"], 0)
        self.assertNotEqual(status["trainingStatus"], "trained_and_evaluated")
        self.assertFalse(self.model_path.exists())


if __name__ == "__main__":
    unittest.main()
