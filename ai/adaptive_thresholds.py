"""
Adaptive baseline engine for Smart Spectacles.

Prototype rules:
- 60 valid, non-warning samples establish the initial baseline using the median.
- A possible new normal must persist across 3 consecutive batches of 20 samples.
- Baseline and adaptive threshold move gradually, never jump directly to a new median.
- Fixed safety thresholds are checked separately and remain authoritative.
- Values are raw project/simulator units, not calibrated real-world safety limits.
"""
from dataclasses import dataclass
from statistics import median
from typing import Optional
import math

INITIAL_BASELINE_SAMPLES = 60
BATCH_SIZE = 20
PERSISTENT_BATCHES_REQUIRED = 3
SHIFT_FRACTION = 0.05
MAX_BASELINE_STEP_FRACTION = 0.02
MAX_THRESHOLD_STEP_FRACTION = 0.01

@dataclass
class SensorPolicy:
    direction: str
    initial_threshold: float
    min_threshold: float
    max_threshold: float
    critical_limit: Optional[float] = None

DEFAULT_POLICIES = {
    "uv": SensorPolicy("above", 3000, 2000, 3500),
    "gas": SensorPolicy("above", 2000, 1200, 2300),
    "light": SensorPolicy("below", 800, 400, 1000),
    "distance": SensorPolicy("below", 30, 15, 50),
}

class AdaptiveThreshold:
    def __init__(self, policy: SensorPolicy):
        if policy.direction not in {"above", "below"}:
            raise ValueError("direction must be 'above' or 'below'")
        if policy.min_threshold > policy.max_threshold:
            raise ValueError("Invalid threshold bounds")
        self.policy = policy
        self.baseline: Optional[float] = None
        self.threshold = float(policy.initial_threshold)
        self.initial_samples = []
        self.batch_samples = []
        self.shift_direction = 0
        self.consecutive_shift_batches = 0
        self.validated = False
        self.batches_checked = 0

    def is_critical(self, reading: float) -> bool:
        limit = self.policy.critical_limit
        if limit is None:
            return False
        return reading >= limit if self.policy.direction == "above" else reading <= limit

    def is_warning(self, reading: float) -> bool:
        return reading > self.threshold if self.policy.direction == "above" else reading < self.threshold

    def _bounded(self, value: float) -> float:
        return min(self.policy.max_threshold, max(self.policy.min_threshold, value))

    def _gradual_step(self, current: float, target: float, fraction: float) -> float:
        max_step = max(abs(current) * fraction, 0.01)
        delta = max(-max_step, min(max_step, target - current))
        return self._bounded(current + delta)

    def observe(self, reading: float, *, anomalous: bool = False,
                hazardous: bool = False, stable: bool = True) -> dict:
        if (not isinstance(reading, (int, float)) or isinstance(reading, bool)
                or not math.isfinite(reading)):
            return self._result(None, "invalid_reading")
        reading = float(reading)
        critical = self.is_critical(reading)
        warning = self.is_warning(reading)

        if anomalous:
            return self._result(reading, "paused_anomaly", warning, critical)
        if hazardous or critical or warning:
            self.initial_samples.clear()
            self.batch_samples.clear()
            self.shift_direction = 0
            self.consecutive_shift_batches = 0
            return self._result(reading, "paused_hazard", warning, critical)
        if not stable:
            self.batch_samples.clear()
            self.shift_direction = 0
            self.consecutive_shift_batches = 0
            return self._result(reading, "paused_unstable", warning, critical)

        if not self.validated:
            self.initial_samples.append(reading)
            if len(self.initial_samples) < INITIAL_BASELINE_SAMPLES:
                return self._result(reading, "collecting_baseline", warning, critical)
            self.baseline = float(median(self.initial_samples))
            self.initial_samples.clear()
            self.validated = True
            self.batch_samples.clear()
            return self._result(reading, "baseline_established", warning, critical)

        self.batch_samples.append(reading)
        if len(self.batch_samples) < BATCH_SIZE:
            return self._result(reading, "monitoring_stability", warning, critical)

        batch_median = float(median(self.batch_samples))
        self.batch_samples.clear()
        self.batches_checked += 1
        assert self.baseline is not None
        difference = batch_median - self.baseline
        shift_limit = max(abs(self.baseline) * SHIFT_FRACTION, 1.0)
        direction = 1 if difference > shift_limit else -1 if difference < -shift_limit else 0
        if direction == 0:
            self.shift_direction = 0
            self.consecutive_shift_batches = 0
            return self._result(reading, "monitoring_stability", warning, critical)
        if direction == self.shift_direction:
            self.consecutive_shift_batches += 1
        else:
            self.shift_direction = direction
            self.consecutive_shift_batches = 1
        if self.consecutive_shift_batches < PERSISTENT_BATCHES_REQUIRED:
            return self._result(reading, "checking_new_normal", warning, critical)

        old_baseline = self.baseline
        self.baseline = self._gradual_step(self.baseline, batch_median, MAX_BASELINE_STEP_FRACTION)
        threshold_target = self.threshold + (self.baseline - old_baseline)
        proposed = self._gradual_step(self.threshold, threshold_target, MAX_THRESHOLD_STEP_FRACTION)
        # Adaptation may only add sensitivity, never relax the fixed-limit rule.
        if self.policy.direction == "above":
            self.threshold = min(self.threshold, proposed)
        else:
            self.threshold = max(self.threshold, proposed)
        self.threshold = self._bounded(self.threshold)
        self.consecutive_shift_batches = 0
        self.shift_direction = 0
        return self._result(reading, "adapting_gradually", warning, critical)

    def _result(self, reading, learning, warning=False, critical=False):
        return {
            "reading": reading,
            "baseline": round(self.baseline, 3) if self.baseline is not None else None,
            "adaptiveThreshold": round(self.threshold, 3),
            "warning": bool(warning),
            "critical": bool(critical),
            "learningStatus": learning,
            "initialSamplesCollected": len(self.initial_samples),
            "initialSamplesRequired": INITIAL_BASELINE_SAMPLES,
            "baselineEstablished": self.validated,
            "batchSamplesCollected": len(self.batch_samples),
            "batchSamplesRequired": BATCH_SIZE,
            "consecutiveShiftBatches": self.consecutive_shift_batches,
            "shiftBatchesRequired": PERSISTENT_BATCHES_REQUIRED,
            "batchesChecked": self.batches_checked,
            "validatedForRealWorldUse": False,
        }

def create_engines():
    return {sensor: AdaptiveThreshold(policy) for sensor, policy in DEFAULT_POLICIES.items()}

if __name__ == "__main__":
    engines = create_engines()
    demo_readings = {
        "uv": [2500] * 60 + [2400] * 60,
        "gas": [1500] * 60 + [1400] * 60,
        "light": [850] * 60 + [900] * 60,
        "distance": [40] * 60 + [42] * 60,
    }
    print("Adaptive Threshold Demo (simulated data only)")
    for sensor, readings in demo_readings.items():
        engine = engines[sensor]
        result = None
        for reading in readings:
            result = engine.observe(reading)
        print(f"{sensor}: baseline={result['baseline']}, adaptive={result['adaptiveThreshold']}, status={result['learningStatus']}")
    print("Demo complete. No Firebase values were changed.")
