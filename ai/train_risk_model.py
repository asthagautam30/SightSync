"""
Train a baseline risk classifier for Smart Spectacles.

Expected CSV:
  ai/data/smart_spectacles_augmented_risk_training_100.csv

IMPORTANT:
Synthetic or duplicated samples can make evaluation metrics misleading.
Use this pipeline for development only until the labels and sensor data have
been reviewed and the model has been evaluated on independent real readings.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "smart_spectacles_augmented_risk_training_100.csv"
MODEL_DIR = BASE_DIR / "models"
MODEL_PATH = MODEL_DIR / "risk_classifier.joblib"
METRICS_PATH = MODEL_DIR / "risk_model_metrics.json"

FEATURES = [
    "uv", "gas", "light", "distance",
    "uv_baseline", "gas_baseline", "light_baseline", "distance_baseline",
]
TARGET = "risk"
EXPECTED_LABELS = {"Low", "Moderate", "Elevated"}


def main() -> None:
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Training CSV not found: {DATA_PATH}\n"
            "Place smart_spectacles_augmented_risk_training_100.csv in ai/data/."
        )

    df = pd.read_csv(DATA_PATH)
    required = FEATURES + [TARGET]
    missing = [column for column in required if column not in df.columns]
    if missing:
        raise ValueError(f"CSV is missing required columns: {', '.join(missing)}")

    df = df[required].copy()
    df[TARGET] = df[TARGET].astype("string").str.strip().str.title()
    df = df.dropna(subset=[TARGET])
    df = df[df[TARGET].isin(EXPECTED_LABELS)]

    for column in FEATURES:
        df[column] = pd.to_numeric(df[column], errors="coerce")

    df = df.dropna(subset=[TARGET])
    counts = df[TARGET].value_counts()
    print("\nRows available:", len(df))
    print("Class counts:")
    print(counts.to_string())

    if len(df) < 15:
        raise ValueError("At least 15 labelled rows are required for this development run.")
    if counts.size < 2 or counts.min() < 2:
        raise ValueError(
            "Each risk class needs at least two rows for a stratified split. "
            "Add reviewed examples before training."
        )

    X = df[FEATURES]
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.25,
        random_state=42,
        stratify=y,
    )

    pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("classifier", RandomForestClassifier(
                n_estimators=300,
                class_weight="balanced",
                random_state=42,
                min_samples_leaf=2,
            )),
        ]
    )
    pipeline.fit(X_train, y_train)
    predictions = pipeline.predict(X_test)

    accuracy = float(accuracy_score(y_test, predictions))
    report = classification_report(
        y_test,
        predictions,
        labels=sorted(EXPECTED_LABELS),
        output_dict=True,
        zero_division=0,
    )
    matrix_labels = sorted(EXPECTED_LABELS)
    matrix = confusion_matrix(y_test, predictions, labels=matrix_labels).tolist()

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "pipeline": pipeline,
            "features": FEATURES,
            "labels": matrix_labels,
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
            "training_rows": int(len(df)),
            "training_data_file": DATA_PATH.name,
            "development_only": True,
        },
        MODEL_PATH,
    )

    metrics = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "data_file": DATA_PATH.name,
        "rows_used": int(len(df)),
        "class_counts": {str(k): int(v) for k, v in counts.items()},
        "features": FEATURES,
        "labels_in_confusion_matrix_order": matrix_labels,
        "test_rows": int(len(y_test)),
        "test_accuracy": accuracy,
        "classification_report": report,
        "confusion_matrix": matrix,
        "warning": (
            "Development-only metrics. Synthetic, duplicated, or inconsistently "
            "labelled samples can inflate or distort results. Validate on independent "
            "real sensor readings before making real-world claims."
        ),
    }
    METRICS_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    print(f"\nHold-out accuracy (development only): {accuracy:.3f}")
    print("\nClassification report:")
    print(classification_report(y_test, predictions, zero_division=0))
    print("Confusion matrix (labels", matrix_labels, "):")
    print(matrix)
    print(f"\nSaved model: {MODEL_PATH}")
    print(f"Saved metrics: {METRICS_PATH}")
    print("\nIMPORTANT: These metrics are not evidence of real-world performance "
          "when training data contains synthetic or duplicated examples.")


if __name__ == "__main__":
    main()
