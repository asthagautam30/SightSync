"""Regression tests for adaptive thresholds and persisted learner state.

Run from the repository root with: python -m unittest ai.test_adaptive_thresholds
"""
import unittest

from ai.adaptive_thresholds import (
    AdaptiveThreshold,
    DEFAULT_POLICIES,
    INITIAL_BASELINE_SAMPLES,
    create_engines,
)
from ai.adaptive_state import export_engine_state, restore_engine_state


class AdaptiveThresholdTests(unittest.TestCase):
    def test_fixed_direction_warning_rules(self):
        engines = create_engines()
        self.assertTrue(engines["uv"].is_warning(3001))
        self.assertFalse(engines["uv"].is_warning(3000))
        self.assertTrue(engines["gas"].is_warning(2001))
        self.assertTrue(engines["light"].is_warning(799))
        self.assertTrue(engines["distance"].is_warning(29))

    def test_baseline_requires_60_safe_samples(self):
        engine = create_engines()["uv"]
        for _ in range(INITIAL_BASELINE_SAMPLES - 1):
            result = engine.observe(1000)
        self.assertFalse(result["baselineEstablished"])
        result = engine.observe(1000)
        self.assertTrue(result["baselineEstablished"])
        self.assertEqual(result["baseline"], 1000.0)

    def test_hazard_does_not_enter_baseline(self):
        engine = create_engines()["gas"]
        result = engine.observe(2200, hazardous=True)
        self.assertEqual(result["learningStatus"], "paused_hazard")
        self.assertEqual(result["initialSamplesCollected"], 0)

    def test_adaptive_threshold_cannot_relax_fixed_direction(self):
        engines = create_engines()
        for _ in range(60):
            engines["uv"].observe(1000)
        original = engines["uv"].threshold
        for _ in range(200):
            engines["uv"].observe(1100)
        self.assertLessEqual(engines["uv"].threshold, original)

        for _ in range(60):
            engines["light"].observe(700)
        original_light = engines["light"].threshold
        for _ in range(200):
            engines["light"].observe(600)
        self.assertGreaterEqual(engines["light"].threshold, original_light)

    def test_state_round_trip(self):
        engine = create_engines()["uv"]
        engine.observe(1000)
        saved = export_engine_state(engine)
        restored = create_engines()["uv"]
        self.assertTrue(restore_engine_state(restored, saved))
        self.assertEqual(restored.initial_samples, [1000.0])

    def test_firebase_omitted_empty_fields_are_accepted(self):
        engine = create_engines()["gas"]
        saved = export_engine_state(engine)
        saved.pop("baseline")
        saved.pop("initial_samples")
        saved.pop("batch_samples")
        self.assertTrue(restore_engine_state(engine, saved))
        self.assertEqual(engine.initial_samples, [])
        self.assertEqual(engine.batch_samples, [])

    def test_invalid_threshold_is_rejected(self):
        engine = create_engines()["uv"]
        saved = export_engine_state(engine)
        saved["threshold"] = 999999
        self.assertFalse(restore_engine_state(engine, saved))


if __name__ == "__main__":
    unittest.main()
