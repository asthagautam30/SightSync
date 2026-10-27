"""Automatic collection and gated training for the experimental Random Forest.

Sensor records are collected automatically, but risk labels must be reviewed and
set explicitly in Firebase before they can be used for supervised training.
This module never creates risk labels from the fixed thresholds.
"""
from __future__ import annotations

import json
import math
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

try:
    from risk_model import FEATURE_ORDER, MODEL_PATH
except ModuleNotFoundError:
    from ai.risk_model import FEATURE_ORDER, MODEL_PATH

FIREBASE_DEVICE_BASE = (
    "https://smart-spectacle-47402-default-rtdb.firebaseio.com/"
    "devices/Prachi-spectacles-001/"
)
DATASET_URL = FIREBASE_DEVICE_BASE + "risk_training_dataset.json"
STATUS_URL = FIREBASE_DEVICE_BASE + "risk_training_status.json"
MIN_LABELLED_ROWS = 30
MIN_CLASS_ROWS = 5
MIN_EVALUATION_ACCURACY = 0.70
MAX_RECORDS = 5000
VALID_RISKS = {"low", "moderate", "elevated"}
LOCAL_STATUS_PATH = Path(__file__).with_name("models") / "risk_training_status.json"


def _request_json(url: str, method: str = "GET", value: Any = None) -> Any:
    data = None if value is None else json.dumps(value, allow_nan=False).encode("utf-8")
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=10) as response:
        body = response.read().decode("utf-8")
        return json.loads(body) if body else None


def _valid_number(value: Any) -> bool:
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(float(value))
    )


def _features(readings: dict, baselines: dict) -> list[float] | None:
    values = []
    for key in ("uv", "gas", "light", "distance"):
        if not _valid_number(readings.get(key)):
            return None
        values.append(float(readings[key]))
    for key in ("uv", "gas", "light", "distance"):
        if not _valid_number(baselines.get(key)):
            return None
        values.append(float(baselines[key]))
    return values


def collect_record(readings: dict, baselines: dict, eligible_for_normal_training: bool,
                   eligibility_reasons: list[str] | None = None) -> dict:
    """Persist valid sensor+baseline features; risk label intentionally remains unassigned."""
    values = _features(readings, baselines)
    if values is None:
        return {"saved": False, "reason": "invalid_readings_or_baselines"}

    record = {
        "recordedAt": int(time.time() * 1000),
        "features": dict(zip(FEATURE_ORDER, values)),
        "risk": None,
        "reviewed": False,
        "eligibleForNormalTraining": bool(eligible_for_normal_training),
        "eligibilityReasons": list(eligibility_reasons or []),
        "labelGuidance": "Set risk to low, moderate, or elevated and reviewed=true only after independent review.",
    }
    try:
        # POST creates a unique record so existing reviewed labels are never overwritten.
        _request_json(DATASET_URL, "POST", record)
        return {"saved": True, "recordedAt": record["recordedAt"]}
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        return {"saved": False, "reason": "firebase_save_error", "error": str(exc)}


def _load_records() -> dict:
    result = _request_json(DATASET_URL)
    return result if isinstance(result, dict) else {}


def _reviewed_rows(records: dict) -> list[dict]:
    rows = []
    for record_id, record in records.items():
        if not isinstance(record, dict) or record.get("reviewed") is not True:
            continue
        risk = str(record.get("risk", "")).strip().lower()
        features = record.get("features")
        if risk not in VALID_RISKS or not isinstance(features, dict):
            continue
        if all(_valid_number(features.get(key)) for key in FEATURE_ORDER):
            rows.append({"id": record_id, "risk": risk, **{key: float(features[key]) for key in FEATURE_ORDER}})
    return rows


def _publish_status(status: dict) -> dict:
    status["updatedAt"] = int(time.time() * 1000)
    try:
        _request_json(STATUS_URL, "PUT", status)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        status["statusWriteError"] = str(exc)
    try:
        LOCAL_STATUS_PATH.parent.mkdir(parents=True, exist_ok=True)
        LOCAL_STATUS_PATH.write_text(json.dumps(status, indent=2), encoding="utf-8")
    except OSError:
        pass
    return status


def update_training_status_and_maybe_train() -> dict:
    """Count reviewed labels and train only if evaluation gates pass."""
    try:
        records = _load_records()
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        return _publish_status({
            "status": "dataset_unavailable", "totalRecords": 0,
            "reviewedLabelledRecords": 0, "classCounts": {},
            "modelActive": False, "message": f"Could not read training dataset: {exc}",
        })

    rows = _reviewed_rows(records)
    class_counts = {label: sum(row["risk"] == label for row in rows) for label in sorted(VALID_RISKS)}
    labelled_count = len(rows)
    status = {
        "totalRecords": len(records),
        "reviewedLabelledRecords": labelled_count,
        "classCounts": class_counts,
        "minimumLabelledRows": MIN_LABELLED_ROWS,
        "minimumRowsPerClass": MIN_CLASS_ROWS,
        "modelActive": False,
        "validatedForRealWorldUse": False,
    }

    if labelled_count < MIN_LABELLED_ROWS or sum(count > 0 for count in class_counts.values()) < 2:
        status.update({
            "status": "collecting_reviewed_labels",
            "message": "Collecting sensor records. Random Forest training waits for at least 30 independently reviewed labels across at least two risk classes.",
        })
        return _publish_status(status)
    if min(class_counts.values()) < MIN_CLASS_ROWS:
        # Every supported class must be represented; otherwise we risk an incomplete classifier.
        status.update({
            "status": "needs_more_class_examples",
            "message": "Add reviewed examples so low, moderate, and elevated each have at least five records before training.",
        })
        return _publish_status(status)

    try:
        import joblib
        import numpy as np
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.metrics import accuracy_score, classification_report
        from sklearn.model_selection import train_test_split
    except ImportError as exc:
        status.update({"status": "dependencies_missing", "message": str(exc)})
        return _publish_status(status)

    X = np.asarray([[row[key] for key in FEATURE_ORDER] for row in rows], dtype=float)
    y = np.asarray([row["risk"] for row in rows], dtype=str)
    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        model = RandomForestClassifier(
            n_estimators=200, max_depth=8, min_samples_leaf=2,
            class_weight="balanced", random_state=42, n_jobs=-1,
        )
        model.fit(X_train, y_train)
        predictions = model.predict(X_test)
        accuracy = float(accuracy_score(y_test, predictions))
        report = classification_report(y_test, predictions, output_dict=True, zero_division=0)
        recalls = [float(report.get(label, {}).get("recall", 0.0)) for label in VALID_RISKS]
        status.update({
            "evaluationAccuracy": round(accuracy, 4),
            "evaluationRows": int(len(y_test)),
            "classRecall": {label: round(float(report.get(label, {}).get("recall", 0.0)), 4) for label in sorted(VALID_RISKS)},
            "minimumEvaluationAccuracy": MIN_EVALUATION_ACCURACY,
        })
        if accuracy < MIN_EVALUATION_ACCURACY or min(recalls) < 0.5:
            status.update({
                "status": "evaluation_not_passed",
                "message": "Evaluation did not meet the accuracy and per-class recall gates. Fixed safety fallback remains active; add more reviewed examples.",
            })
            return _publish_status(status)

        destination = Path(MODEL_PATH)
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = destination.with_suffix(".candidate.joblib")
        joblib.dump({
            "model": model,
            "feature_order": FEATURE_ORDER,
            "training_rows": int(len(X_train)),
            "test_rows": int(len(X_test)),
            "classes": sorted(str(value) for value in model.classes_),
            "evaluation_accuracy": accuracy,
            "class_recall": status["classRecall"],
            "note": "Experimental; not validated for real-world safety use.",
        }, temporary_path)
        temporary_path.replace(destination)
        status.update({
            "status": "trained_evaluation_passed",
            "modelActive": True,
            "trainingRows": int(len(X_train)),
            "message": "Random Forest passed the configured offline evaluation gates. Fixed safety checks remain authoritative.",
        })
        return _publish_status(status)
    except Exception as exc:
        status.update({
            "status": "training_error",
            "message": f"Training/evaluation failed; fixed safety fallback remains active: {exc}",
        })
        return _publish_status(status)
