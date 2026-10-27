"""Tests for transparent fallback behavior in the experimental risk module."""
import unittest
from unittest.mock import patch

from ai import risk_model


class RiskModelTests(unittest.TestCase):
    def test_fixed_limit_warning_is_detected(self):
        result = risk_model.rule_based_assessment(
            {"uv": 3100, "gas": 1000, "light": 900, "distance": 50}
        )
        self.assertEqual(result["risk"], "elevated")
        self.assertIn("uv", result["triggeredSensors"])
        self.assertFalse(result["modelAvailable"])

    def test_missing_data_is_not_called_safe(self):
        result = risk_model.rule_based_assessment({})
        self.assertEqual(result["risk"], "insufficient_data")

    def test_no_fixed_trigger_does_not_claim_safe(self):
        result = risk_model.rule_based_assessment(
            {"uv": 1000, "gas": 1000, "light": 900, "distance": 50}
        )
        self.assertEqual(result["risk"], "no_fixed_limit_trigger")
        self.assertTrue(any("does not certify" in item for item in result["recommendations"]))

    def test_model_unavailable_uses_fallback(self):
        with patch.object(risk_model, "_load_model", return_value=None):
            result = risk_model.assess_risk(
                {"uv": 3200, "gas": 1000, "light": 900, "distance": 50}
            )
        self.assertEqual(result["risk"], "elevated")
        self.assertEqual(result["riskSource"], "fixed_limit_fallback")

    def test_model_cannot_override_fixed_limit_trigger(self):
        class FakeModel:
            def predict(self, rows):
                return ["low"]

        with patch.object(risk_model, "_load_model", return_value=FakeModel()):
            result = risk_model.assess_risk(
                {"uv": 3200, "gas": 1000, "light": 900, "distance": 50},
                {"uv": 1000, "gas": 1000, "light": 900, "distance": 50},
            )
        self.assertEqual(result["modelPrediction"], "low")
        self.assertEqual(result["risk"], "elevated")
        self.assertIn("uv", result["triggeredSensors"])


if __name__ == "__main__":
    unittest.main()
