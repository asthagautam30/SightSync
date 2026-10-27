"""
Random Forest risk assessment for SightSync sensor readings.

A trained model is used only when a validated model artifact is present.
Without one, conservative deterministic checks provide a transparent fallback.
The configured thresholds are project/simulator values, not calibrated safety limits.
"""
from __future__ import annotations

import math
from pathlib import Path
from typing import Any

SENSOR_KEYS = ("uv", "gas", "light", "distance")
MODEL_PATH = Path(__file__).with_name("risk_random_forest.joblib")
FEATURE_ORDER = [
    "uv", "gas", "light", "distance",
    "uv_baseline", "gas_baseline", "light_baseline", "distance_baseline",
]
FIXED_THRESHOLDS = {"uv": 3000.0, "gas": 2000.0, "light": 800.0, "distance": 30.0}


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    value = float(value)
    return value if math.isfinite(value) else None


def rule_based_assessment(readings: dict, baselines: dict | None = None) -> dict:
    """Transparent fallback; it is not a trained ML prediction."""
    baselines = baselines or {}
    flags = []
    for sensor in SENSOR_KEYS:
        value = _number(readings.get(sensor))
        if value is None:
            continue
        limit = FIXED_THRESHOLDS[sensor]
        triggered = value > limit if sensor in ("uv", "gas") else value < limit
        if triggered:
            flags.append(sensor)

    if flags:
        risk = "elevated"
    elif any(_number(readings.get(s)) is not None for s in SENSOR_KEYS):
        risk = "no_fixed_limit_trigger"
    else:
        risk = "insufficient_data"

    advice = []
    if "uv" in flags:
        advice.append("UV sensor reading is above the configured project limit; check the reading and consider shade and suitable sun protection outdoors.")
    if "gas" in flags:
        advice.append("Gas sensor reading is above the configured project limit; check for possible sources. If a dangerous release is suspected, leave the area and contact local emergency services.")
    if "light" in flags:
        advice.append("Light reading is below the configured project limit; check sensor placement and surrounding lighting.")
    if "distance" in flags:
        advice.append("Viewing distance is below the configured project limit; move the viewed object farther away if practical.")
    if not advice and risk == "no_fixed_limit_trigger":
        advice.append("No configured fixed-limit trigger was detected in the available readings. This does not certify that the environment is safe.")
    if risk == "insufficient_data":
        advice.append("Not enough valid sensor readings are available to assess risk.")

    return {
        "risk": risk,
        "riskSource": "fixed_limit_fallback",
        "triggeredSensors": flags,
        "recommendations": advice,
        "modelAvailable": False,
        "validatedForRealWorldUse": False,
    }


def _load_model():
    if not MODEL_PATH.exists():
        return None
    try:
        import joblib
        payload = joblib.load(MODEL_PATH)
        model = payload.get("model") if isinstance(payload, dict) else None
        feature_order = payload.get("feature_order") if isinstance(payload, dict) else None
        if model is None or feature_order != FEATURE_ORDER:
            return None
        return model
    except Exception as exc:
        print(f"Random Forest model unavailable; using fixed-limit fallback ({exc}).")
        return None


def assess_risk(readings: dict, baselines: dict | None = None) -> dict:
    """Use the trained model if available, but never suppress fixed-limit alerts."""
    baseline_values = baselines or {}
    fallback = rule_based_assessment(readings, baseline_values)
    model = _load_model()
    if model is None:
        return fallback

    values = []
    for key in SENSOR_KEYS:
        reading = _number(readings.get(key))
        if reading is None:
            return {**fallback, "riskSource": "fixed_limit_fallback_missing_features"}
        values.append(reading)
    for key in SENSOR_KEYS:
        baseline = _number(baseline_values.get(key))
        values.append(baseline if baseline is not None else 0.0)

    try:
        predicted = str(model.predict([values])[0]).lower()
        allowed = {"low", "moderate", "elevated"}
        if predicted not in allowed:
            raise ValueError(f"Unexpected risk class: {predicted}")
        risk = "elevated" if fallback["triggeredSensors"] else predicted
        return {
            **fallback,
            "risk": risk,
            "riskSource": "random_forest_with_fixed_safety_override",
            "modelAvailable": True,
            "modelPrediction": predicted,
            "validatedForRealWorldUse": False,
        }
    except Exception as exc:
        print(f"Random Forest inference failed; using fixed-limit fallback ({exc}).")
        return fallback


def train_from_csv(csv_path: str, output_path: str | None = None) -> dict:
    """
    Train from a CSV with feature columns plus a risk label column.
    Labels must be reviewed/grounded outcomes, not generated from the same
    threshold rules that the model is supposed to learn.
    """
    try:
        import pandas as pd
        import joblib
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import classification_report
    except ImportError as exc:
        raise RuntimeError(
            "Training requires pandas, scikit-learn, and joblib. "
            "Install them with: python -m pip install pandas scikit-learn joblib"
        ) from exc

    frame = pd.read_csv(csv_path)
    required = set(FEATURE_ORDER + ["risk"])
    missing = sorted(required - set(frame.columns))
    if missing:
        raise ValueError("CSV is missing required columns: " + ", ".join(missing))
    frame = frame[FEATURE_ORDER + ["risk"]].dropna()
    frame = frame[frame["risk"].astype(str).str.lower().isin(["low", "moderate", "elevated"])]
    if len(frame) < 30 or frame["risk"].nunique() < 2:
        raise ValueError("Need at least 30 labelled rows and at least two risk classes.")
    counts = frame["risk"].value_counts()
    if counts.min() < 2:
        raise ValueError("Each risk class needs at least two rows for a stratified split.")

    X = frame[FEATURE_ORDER].astype(float)
    y = frame["risk"].astype(str).str.lower()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    model = RandomForestClassifier(
        n_estimators=200, max_depth=8, min_samples_leaf=2,
        class_weight="balanced", random_state=42, n_jobs=-1,
    )
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)
    report = classification_report(y_test, predictions, output_dict=True, zero_division=0)
    destination = Path(output_path) if output_path else MODEL_PATH
    destination.parent.mkdir(parents=True, exist_ok=True)
    import joblib
    joblib.dump({
        "model": model,
        "feature_order": FEATURE_ORDER,
        "training_rows": int(len(frame)),
        "test_rows": int(len(X_test)),
        "classes": sorted(str(value) for value in model.classes_),
        "note": "Experimental; not validated for real-world safety use.",
    }, destination)
    return {"model_path": str(destination), "training_rows": len(frame),
            "test_rows": len(X_test), "report": report}


if __name__ == "__main__":
    import argparse
    import json
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--train-csv", help="CSV containing sensor features and reviewed risk labels")
    parser.add_argument("--output", help="Optional model output path")
    args = parser.parse_args()
    if not args.train_csv:
        parser.error("--train-csv is required for training")
    print(json.dumps(train_from_csv(args.train_csv, args.output), indent=2))
