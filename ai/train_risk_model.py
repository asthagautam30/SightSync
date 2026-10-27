"""
Train a baseline Smart Spectacles environmental risk classifier.

Expected CSV:
  ai/data/smart_spectacles_augmented_risk_training_100.csv

IMPORTANT: Synthetic rows are not independent real-world observations. This
pipeline removes exact feature combinations with conflicting labels and
deduplicates identical feature/label rows before splitting. Metrics remain
development-only until evaluated on independently collected, reviewed readings.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

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

    df = pd.read_csv(DATA_PATH, sep=None, engine="python")
    required = FEATURES + [TARGET]
    missing = [column for column in required if column not in df.columns]
    if missing:
        raise ValueError(f"CSV is missing required columns: {', '.join(missing)}")

    df = df[required].copy()
    df[TARGET] = df[TARGET].astype("string").str.strip().str.title()
    df = df[df[TARGET].isin(EXPECTED_LABELS)].copy()
    for column in FEATURES:
        df[column] = pd.to_numeric(df[column], errors="coerce")
    df = df.dropna(subset=FEATURES + [TARGET])

    original_rows = len(df)
    original_class_counts = df[TARGET].value_counts().to_dict()

    # Do not arbitrarily select a label when the exact same inputs have
    # conflicting labels. Exclude that feature combination from this training run.
    labels_per_features = df.groupby(FEATURES, dropna=False)[TARGET].nunique()
    conflicting_keys = labels_per_features[labels_per_features > 1].index
    conflict_mask = pd.MultiIndex.from_frame(df[FEATURES]).isin(conflicting_keys)
    conflicting_rows = int(conflict_mask.sum())
    df = df.loc[~conflict_mask].copy()

    # Repeated identical feature/label rows add weight without adding information.
    before_dedup = len(df)
    df = df.drop_duplicates(subset=FEATURES + [TARGET]).reset_index(drop=True)
    duplicates_removed = before_dedup - len(df)

    counts = df[TARGET].value_counts()
    print("Smart Spectacles risk model training")
    print("=" * 40)
    print(f"Valid rows before cleanup: {original_rows}")
    print(f"Original class counts: {original_class_counts}")
    print(f"Conflicting feature combinations excluded: {len(conflicting_keys)}")
    print(f"Rows excluded due to conflicting labels: {conflicting_rows}")
    print(f"Repeated identical feature/label rows removed: {duplicates_removed}")
    print(f"Unique consistent rows available: {len(df)}")
    print("\nClass counts after cleanup:")
    print(counts.to_string())

    if len(df) < 15:
        raise ValueError("Fewer than 15 unique consistent rows remain; collect/review more data.")
    if counts.size < 2 or counts.min() < 2:
        raise ValueError(
            "Each risk class needs at least two unique consistent rows for a stratified split."
        )

    X = df[FEATURES]
    y = df[TARGET]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
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
    labels = sorted(EXPECTED_LABELS.intersection(set(y)))
    report = classification_report(
        y_test, predictions, labels=labels, output_dict=True, zero_division=0
    )
    matrix = confusion_matrix(y_test, predictions, labels=labels).tolist()

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "pipeline": pipeline,
            "features": FEATURES,
            "labels": labels,
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
            "training_rows": int(len(df)),
            "training_data_file": DATA_PATH.name,
            "development_only": True,
            "conflicting_feature_combinations_excluded": int(len(conflicting_keys)),
            "duplicate_rows_removed": int(duplicates_removed),
        },
        MODEL_PATH,
    )

    metrics = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "data_file": DATA_PATH.name,
        "valid_rows_before_cleanup": int(original_rows),
        "original_class_counts": {str(k): int(v) for k, v in original_class_counts.items()},
        "conflicting_feature_combinations_excluded": int(len(conflicting_keys)),
        "rows_excluded_due_to_conflicting_labels": conflicting_rows,
        "duplicate_rows_removed": int(duplicates_removed),
        "rows_used": int(len(df)),
        "class_counts_after_cleanup": {str(k): int(v) for k, v in counts.items()},
        "features": FEATURES,
        "labels_in_confusion_matrix_order": labels,
        "test_rows": int(len(y_test)),
        "test_accuracy": accuracy,
        "classification_report": report,
        "confusion_matrix": matrix,
        "warning": (
            "Development-only metrics. The dataset contains synthetic examples; "
            "deduplication does not make them real or independently sampled. Validate "
            "on separately collected and reviewed sensor readings."
        ),
    }
    METRICS_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    print(f"\nHold-out accuracy (development only): {accuracy:.3f}")
    print("\nClassification report:")
    print(classification_report(y_test, predictions, zero_division=0))
    print("Confusion matrix (labels", labels, "):")
    print(matrix)
    print(f"\nSaved model: {MODEL_PATH}")
    print(f"Saved metrics: {METRICS_PATH}")
    print(
        "\nIMPORTANT: These metrics are not evidence of real-world performance. "
        "Use independently collected, reviewed sensor data for evaluation."
    )


if __name__ == "__main__":
    main()
