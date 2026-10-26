"""Serialize and restore adaptive learner state between runner restarts."""
import math

STATE_FIELDS = (
    "baseline", "threshold", "initial_samples", "batch_samples",
    "shift_direction", "consecutive_shift_batches", "validated",
    "batches_checked",
)


def export_engine_state(engine):
    """Return JSON-safe state, excluding immutable sensor policy."""
    state = {}
    for field in STATE_FIELDS:
        value = getattr(engine, field)
        if field in ("initial_samples", "batch_samples"):
            state[field] = [float(item) for item in value]
        elif field == "baseline":
            state[field] = float(value) if value is not None else None
        elif field == "threshold":
            state[field] = float(value)
        elif field in ("shift_direction", "consecutive_shift_batches", "batches_checked"):
            state[field] = int(value)
        elif field == "validated":
            state[field] = bool(value)
    return state


def restore_engine_state(engine, state):
    """Restore only a complete, type-checked state for the existing policy."""
    if not isinstance(state, dict) or any(field not in state for field in STATE_FIELDS):
        return False
    try:
        baseline = state["baseline"]
        if baseline is not None and (
            isinstance(baseline, bool) or not isinstance(baseline, (int, float))
            or not math.isfinite(baseline)
        ):
            return False
        threshold = state["threshold"]
        if isinstance(threshold, bool) or not isinstance(threshold, (int, float)) or not math.isfinite(threshold):
            return False
        if not engine.policy.min_threshold <= float(threshold) <= engine.policy.max_threshold:
            return False

        initial = state["initial_samples"]
        batch = state["batch_samples"]
        if not isinstance(initial, list) or len(initial) >= 60:
            return False
        if not isinstance(batch, list) or len(batch) >= 20:
            return False
        for values in (initial, batch):
            if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in values):
                return False

        direction = state["shift_direction"]
        consecutive = state["consecutive_shift_batches"]
        checked = state["batches_checked"]
        if direction not in (-1, 0, 1) or isinstance(direction, bool):
            return False
        if any(isinstance(v, bool) or not isinstance(v, int) or v < 0 for v in (consecutive, checked)):
            return False
        if consecutive > 2:
            return False
        if not isinstance(state["validated"], bool):
            return False
        if state["validated"] and baseline is None:
            return False

        engine.baseline = float(baseline) if baseline is not None else None
        engine.threshold = float(threshold)
        engine.initial_samples = [float(v) for v in initial]
        engine.batch_samples = [float(v) for v in batch]
        engine.shift_direction = int(direction)
        engine.consecutive_shift_batches = consecutive
        engine.validated = state["validated"]
        engine.batches_checked = checked
        return True
    except (TypeError, ValueError, OverflowError):
        return False
