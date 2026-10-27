"""Automated SightSync Random Forest data collection and training readiness.

Records every poll with readings, baselines, and safety eligibility. Risk labels
are accepted only from explicitly reviewed Firebase entries; this module never
creates labels from the fixed thresholds.
"""
from __future__ import annotations

import hashlib
import json
import math
import time
import urllib.error
import urllib.request
import uuid
from collections import Counter
from pathlib import Path
from typing import Any

try:
    import joblib
    import numpy as np
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import balanced_accuracy_score, classification_report, f1_score
    from sklearn.model_selection import train_test_split
    ML_AVAILABLE = True
except ImportError:
    joblib = np = RandomForestClassifier = balanced_accuracy_score = None
    classification_report = f1_score = train_test_split = None
    ML_AVAILABLE = False

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "models"
RECORDS_PATH = DATA_DIR / "risk_training_records.jsonl"
ATTEMPT_PATH = DATA_DIR / "risk_training_last_attempt.json"
MODEL_PATH = BASE_DIR / "risk_random_forest.joblib"
FIREBASE_BASE = "https://smart-spectacle-47402-default-rtdb.firebaseio.com/devices/Prachi-spectacles-001/"
LABELS_URL = FIREBASE_BASE + "risk_training/reviewed_labels.json"
SAMPLES_URL = FIREBASE_BASE + "risk_training/samples/"
STATUS_URL = FIREBASE_BASE + "risk_training/status.json"
SENSORS = ("uv", "gas", "light", "distance")
FEATURE_ORDER = list(SENSORS) + [f"{key}_baseline" for key in SENSORS]
LABELS = {"low", "moderate", "elevated"}
MIN_ROWS, MIN_PER_CLASS = 30, 8
MIN_MACRO_F1, MIN_BALANCED_ACCURACY = 0.65, 0.65
MAX_RECORDS = 10000


def number(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    result = float(value)
    return result if math.isfinite(result) else None


def firebase_get(url: str) -> Any:
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=8) as response:
        return json.loads(response.read().decode("utf-8"))


def firebase_put(url: str, value: dict) -> None:
    request = urllib.request.Request(
        url, data=json.dumps(value, allow_nan=False).encode("utf-8"),
        headers={"Content-Type": "application/json"}, method="PUT",
    )
    with urllib.request.urlopen(request, timeout=8) as response:
        response.read()


def read_records() -> list[dict]:
    if not RECORDS_PATH.is_file():
        return []
    result = []
    try:
        with RECORDS_PATH.open(encoding="utf-8") as stream:
            for line in stream:
                try:
                    item = json.loads(line)
                    if isinstance(item, dict) and isinstance(item.get("sampleId"), str):
                        result.append(item)
                except (json.JSONDecodeError, TypeError):
                    continue
    except OSError:
        return []
    return result[-MAX_RECORDS:]


def collect_record(readings: dict, baselines: dict, eligible: bool,
                   exclusion_reasons: list[str]) -> dict:
    values = {key: number(readings.get(key)) for key in SENSORS}
    base = {key: number(baselines.get(key)) for key in SENSORS}
    valid_readings = all(values[key] is not None for key in SENSORS)
    valid_baselines = all(base[key] is not None for key in SENSORS)
    reasons = list(dict.fromkeys(exclusion_reasons))
    if not valid_readings:
        reasons.append("one_or_more_sensor_readings_invalid")
    if not valid_baselines:
        reasons.append("one_or_more_baselines_not_established")
    if not eligible and not reasons:
        reasons.append("independent_safety_checks_not_passed")
    record = {
        "sampleId": uuid.uuid4().hex,
        "timestamp": int(time.time() * 1000),
        "readings": values,
        "baselines": base,
        "features": ({**values, **{f"{key}_baseline": base[key] for key in SENSORS}}
                     if valid_readings and valid_baselines else None),
        "eligibleForRiskTraining": bool(eligible and valid_readings and valid_baselines),
        "eligibilityReasons": reasons,
        "riskLabel": None,
        "labelReviewed": False,
        "labelSource": None,
    }
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with RECORDS_PATH.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(record, allow_nan=False) + "\n")
        rows = read_records()
        if len(rows) >= MAX_RECORDS:
            RECORDS_PATH.write_text(
                "".join(json.dumps(row, allow_nan=False) + "\n" for row in rows),
                encoding="utf-8",
            )
    except (OSError, ValueError) as error:
        record["collectionError"] = str(error)
    return record


def reviewed_labels() -> dict[str, str]:
    """Only accept labels explicitly marked reviewed in Firebase."""
    try:
        payload = firebase_get(LABELS_URL)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return {}
    if not isinstance(payload, dict):
        return {}
    result = {}
    for sample_id, item in payload.items():
        if isinstance(item, dict) and item.get("reviewed") is True:
            label = str(item.get("risk", "")).strip().lower()
            if label in LABELS:
                result[str(sample_id)] = label
    return result


def _features(record: dict) -> list[float] | None:
    values = record.get("features")
    if not isinstance(values, dict):
        return None
    row = [number(values.get(key)) for key in FEATURE_ORDER]
    return None if any(value is None for value in row) else [float(v) for v in row]


def training_status(records: list[dict], labels: dict[str, str]) -> dict:
    rows = []
    for record in records:
        sample_id = record.get("sampleId")
        if record.get("eligibleForRiskTraining") is True and sample_id in labels:
            features = _features(record)
            if features is not None:
                rows.append((features, labels[sample_id]))
    counts = Counter(label for _, label in rows)
    status = {
        "collectedRecords": len(records),
        "eligibleRecords": sum(row.get("eligibleForRiskTraining") is True for row in records),
        "reviewedLabelCount": len(labels),
        "eligibleReviewedLabelCount": len(rows),
        "classCounts": {label: counts.get(label, 0) for label in sorted(LABELS)},
        "trainingStatus": "collecting_reviewed_labels",
        "modelAvailable": MODEL_PATH.is_file(),
        "minimumLabelledRows": MIN_ROWS,
        "minimumPerClass": MIN_PER_CLASS,
        "updatedAt": int(time.time() * 1000),
        "validatedForRealWorldUse": False,
        "note": "Experimental classifier. Fixed safety checks remain authoritative.",
    }
    if not ML_AVAILABLE:
        status.update(trainingStatus="dependencies_missing",
                      message="Install ai/requirements-ml.txt for model training.")
        return status
    if len(rows) < MIN_ROWS or any(counts.get(label, 0) < MIN_PER_CLASS for label in LABELS):
        status["message"] = "Waiting for at least 30 eligible reviewed examples, including 8 examples in each of low, moderate, and elevated classes."
        return status

    fingerprint_payload = [
        {"sampleId": records_by_id, "risk": label}
        for records_by_id, label in sorted(
            (record.get("sampleId"), labels.get(record.get("sampleId")))
            for record in records
            if record.get("eligibleForRiskTraining") is True
            and record.get("sampleId") in labels
            and _features(record) is not None
        )
    ]
    training_fingerprint = hashlib.sha256(
        json.dumps(fingerprint_payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    if MODEL_PATH.is_file():
        try:
            previous = joblib.load(MODEL_PATH)
            if isinstance(previous, dict) and previous.get("training_fingerprint") == training_fingerprint:
                status.update(
                    trainingStatus="trained_and_evaluated",
                    modelAvailable=True,
                    message="The current reviewed dataset has already been trained and evaluated. Fixed safety checks remain authoritative.",
                    evaluation=previous.get("evaluation", {}),
                    trainingRows=previous.get("training_rows"),
                    testRows=previous.get("test_rows"),
                )
                return status
        except Exception:
            pass

    try:
        if ATTEMPT_PATH.is_file():
            previous_attempt = json.loads(ATTEMPT_PATH.read_text(encoding="utf-8"))
            if (previous_attempt.get("training_fingerprint") == training_fingerprint
                    and previous_attempt.get("trainingStatus") == "evaluation_failed"):
                status.update(previous_attempt.get("status", {}))
                status["message"] = "This reviewed dataset already failed held-out evaluation; add new reviewed examples before another attempt. Fixed safety checks remain authoritative."
                return status
    except (OSError, ValueError, AttributeError):
        pass

    X = np.asarray([row[0] for row in rows], dtype=float)
    y = np.asarray([row[1] for row in rows], dtype=str)
    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.25, random_state=42, stratify=y
        )
        candidate = RandomForestClassifier(
            n_estimators=200, max_depth=8, min_samples_leaf=2,
            class_weight="balanced", random_state=42, n_jobs=-1,
        )
        candidate.fit(X_train, y_train)
        predictions = candidate.predict(X_test)
        macro_f1 = float(f1_score(y_test, predictions, average="macro", zero_division=0))
        balanced = float(balanced_accuracy_score(y_test, predictions))
        status["evaluation"] = {
            "macroF1": round(macro_f1, 4),
            "balancedAccuracy": round(balanced, 4),
            "testRows": int(len(y_test)),
            "report": classification_report(y_test, predictions, output_dict=True, zero_division=0),
        }
        status["trainingRows"] = int(len(y_train))
        status["testRows"] = int(len(y_test))
        if macro_f1 < MIN_MACRO_F1 or balanced < MIN_BALANCED_ACCURACY:
            status.update(trainingStatus="evaluation_failed",
                          message="Candidate failed held-out evaluation; no new model was promoted. Fixed safety checks remain authoritative.")
            try:
                DATA_DIR.mkdir(parents=True, exist_ok=True)
                ATTEMPT_PATH.write_text(json.dumps({
                    "training_fingerprint": training_fingerprint,
                    "trainingStatus": "evaluation_failed",
                    "status": {key: value for key, value in status.items() if key != "updatedAt"},
                }, allow_nan=False), encoding="utf-8")
            except (OSError, ValueError):
                pass
            return status

        temporary = MODEL_PATH.with_suffix(".candidate.joblib")
        joblib.dump({
            "model": candidate,
            "feature_order": FEATURE_ORDER,
            "training_rows": int(len(y_train)),
            "test_rows": int(len(y_test)),
            "classes": sorted(str(value) for value in candidate.classes_),
            "evaluation": {"macroF1": round(macro_f1, 4), "balancedAccuracy": round(balanced, 4),
                           "macro_f1": macro_f1, "balanced_accuracy": balanced},
            "training_fingerprint": training_fingerprint,
            "note": "Experimental; not validated for real-world safety use.",
        }, temporary)
        temporary.replace(MODEL_PATH)
        status.update(
            trainingStatus="trained_and_evaluated",
            modelAvailable=True,
            modelTrainedAt=int(time.time() * 1000),
            message="Candidate passed configured held-out checks. Fixed safety checks remain authoritative.",
        )
    except Exception as error:
        status.update(trainingStatus="training_error", message=str(error))
    return status


def update_pipeline(readings: dict, baselines: dict, eligible: bool,
                    exclusion_reasons: list[str]) -> dict:
    latest = collect_record(readings, baselines, eligible, exclusion_reasons)
    # Publish only eligible samples to the review queue; the full local log retains exclusions.
    if latest.get("eligibleForRiskTraining") is True:
        try:
            firebase_put(SAMPLES_URL + str(latest["sampleId"]) + ".json", latest)
            latest["samplePublished"] = True
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as error:
            latest["samplePublished"] = False
            latest["samplePublishError"] = str(error)
    records = read_records()
    labels = reviewed_labels()
    # Persist reviewed annotations only when a new label arrives.
    labels_changed = False
    for record in records:
        label = labels.get(record.get("sampleId"))
        if label and (record.get("riskLabel") != label or record.get("labelReviewed") is not True):
            record.update(riskLabel=label, labelReviewed=True, labelSource="firebase_reviewed_labels")
            labels_changed = True
    if labels_changed:
        try:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            RECORDS_PATH.write_text(
                "".join(json.dumps(record, allow_nan=False) + "\n" for record in records),
                encoding="utf-8",
            )
        except (OSError, ValueError):
            pass
    status = training_status(records, labels)
    status.update(
        latestSampleId=latest.get("sampleId"),
        latestSampleEligible=latest.get("eligibleForRiskTraining", False),
        latestEligibilityReasons=latest.get("eligibilityReasons", []),
    )
    try:
        firebase_put(STATUS_URL, status)
        status["statusPublished"] = True
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as error:
        status.update(statusPublished=False, statusPublishError=str(error))
    return status


if __name__ == "__main__":
    print(json.dumps(training_status(read_records(), reviewed_labels()), indent=2))
