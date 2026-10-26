"""
Smart Spectacles: bounded adaptive baseline engine.

This module does not read Firebase or change device thresholds yet.
It provides a conservative foundation for later integration.

IMPORTANT:
- Sensor values and bounds below are example project/test values.
- Configure these for your actual sensor units before deployment.
- Adaptive baselines never replace fixed critical safety limits.
"""

from dataclasses import dataclass
from typing import Optional
import math


@dataclass
class SensorPolicy:
    # Direction of the personalized warning:
    # "above" for UV/gas; "below" for low light/close distance.
    direction: str

    # Starting personalized warning reference (project test units).
    initial_threshold: float

    # Strict bounds for personalized adaptation.
    min_threshold: float
    max_threshold: float

    # Fixed critical limit. None means not configured.
    # Configure using validated, sensor-specific safety limits.
    critical_limit: Optional[float] = None

    # EWMA and stability settings.
    alpha: float = 0.10
    min_stable_samples: int = 10
    max_relative_step: float = 0.02


DEFAULT_POLICIES = {
    # These are Wokwi/project starting values, not real-world
    # calibrated safety limits.
    "uv": SensorPolicy(
        direction="above",
        initial_threshold=3000,
        min_threshold=2000,
        max_threshold=3500,
        critical_limit=None,
    ),
    "gas": SensorPolicy(
        direction="above",
        initial_threshold=2000,
        min_threshold=1200,
        max_threshold=2300,
        critical_limit=None,
    ),
    "light": SensorPolicy(
        direction="below",
        initial_threshold=800,
        min_threshold=400,
        max_threshold=1000,
        critical_limit=None,
    ),
    "distance": SensorPolicy(
        direction="below",
        initial_threshold=30,
        min_threshold=15,
        max_threshold=50,
        critical_limit=None,
    ),
}


class AdaptiveThreshold:
    def __init__(self, policy: SensorPolicy):
        if policy.direction not in {"above", "below"}:
            raise ValueError("direction must be 'above' or 'below'")
        if not 0 < policy.alpha <= 1:
            raise ValueError("alpha must be in (0, 1]")
        if policy.min_threshold > policy.max_threshold:
            raise ValueError("Invalid threshold bounds")

        self.policy = policy
        self.baseline = policy.initial_threshold
        self.threshold = policy.initial_threshold
        self.stable_samples = 0

    def is_critical(self, reading: float) -> bool:
        limit = self.policy.critical_limit
        if limit is None:
            return False

        if self.policy.direction == "above":
            return reading >= limit

        return reading <= limit

    def is_warning(self, reading: float) -> bool:
        if self.policy.direction == "above":
            return reading > self.threshold
        return reading < self.threshold

    def observe(
        self,
        reading: float,
        *,
        anomalous: bool = False,
        hazardous: bool = False,
        stable: bool = True,
    ) -> dict:
        """
        Process one reading.

        Learning pauses on invalid, anomalous, hazardous, critical,
        or unstable observations. Alerts are still evaluated while
        learning is paused.
        """
        if not isinstance(reading, (int, float)) or not math.isfinite(reading):
            return self._result(None, learning="invalid_reading")

        reading = float(reading)
        critical = self.is_critical(reading)
        warning = self.is_warning(reading)

        if anomalous:
            return self._result(
                reading, warning, critical, "paused_anomaly"
            )

        if hazardous or critical:
            return self._result(
                reading, warning, critical, "paused_hazard"
            )

        if not stable:
            self.stable_samples = 0
            return self._result(
                reading, warning, critical, "paused_unstable"
            )

        self.stable_samples += 1

        # Wait for sufficient stable observations before adapting.
        if self.stable_samples < self.policy.min_stable_samples:
            return self._result(
                reading, warning, critical, "collecting_baseline"
            )

        alpha = self.policy.alpha
        proposed = alpha * reading + (1 - alpha) * self.baseline

        # Limit each update so the baseline cannot jump abruptly.
        max_step = max(
            abs(self.baseline) * self.policy.max_relative_step,
            0.01,
        )
        delta = max(-max_step, min(max_step, proposed - self.baseline))
        proposed = self.baseline + delta

        self.baseline = proposed
        self.threshold = min(
            self.policy.max_threshold,
            max(self.policy.min_threshold, proposed),
        )

        return self._result(
            reading, warning, critical, "adapted"
        )

    def _result(
        self,
        reading,
        warning=False,
        critical=False,
        learning="paused",
    ):
        return {
            "reading": reading,
            "baseline": round(self.baseline, 3),
            "adaptiveThreshold": round(self.threshold, 3),
            "warning": bool(warning),
            "critical": bool(critical),
            "learningStatus": learning,
            "validatedForRealWorldUse": False,
        }


def create_engines():
    """Create one independent adaptive engine per sensor."""
    return {
        sensor: AdaptiveThreshold(policy)
        for sensor, policy in DEFAULT_POLICIES.items()
    }

if __name__ == "__main__":
    engines = create_engines()

    print("Smart Spectacles - Adaptive Threshold Demo")
    print("-" * 45)

    # Example readings for demonstration only.
    demo_readings = {
        "uv": [2800] * 12,
        "gas": [1800] * 12,
        "light": [850] * 12,
        "distance": [35] * 12,
    }

    for sensor, readings in demo_readings.items():
        engine = engines[sensor]

        print(f"\nSensor: {sensor}")

        for index, reading in enumerate(readings, start=1):
            result = engine.observe(reading)

            if index in (1, 9, 10, 12):
                print(
                    f"Reading {index}: {reading} | "
                    f"Threshold: {result['adaptiveThreshold']} | "
                    f"Status: {result['learningStatus']}"
                )

    print("\nDemo complete. No Firebase values were changed.")