"""
Smoke-test the saved Smart Spectacles risk model using distinct sensor readings.

This is not independent model evaluation: the examples are taken from the
training CSV and may be synthetic.
"""
from pathlib import Path

import joblib
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "risk_classifier.joblib"
DATA_PATH = BASE_DIR / "data" / "smart_spectacles_augmented_risk_training_100.csv"


def main() -> None:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Trained model not found: {MODEL_PATH}\n"
            "Run: python ai/train_risk_model.py"
        )
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Training CSV not found: {DATA_PATH}")

    artifact = joblib.load(MODEL_PATH)
    pipeline = artifact["pipeline"]
    features = artifact["features"]

    df = pd.read_csv(DATA_PATH, sep=None, engine="python")
    missing = [name for name in features if name not in df.columns]
    if missing:
        raise ValueError(
            "CSV columns do not match the model. Missing: " + ", ".join(missing)
        )

    feature_data = df[features].apply(pd.to_numeric, errors="coerce")
    unique_data = feature_data.drop_duplicates().dropna(how="all")
    duplicate_count = len(feature_data) - len(unique_data)
    sample = unique_data.head(10)

    if sample.empty:
        raise ValueError("The CSV has no usable sensor feature rows.")

    predictions = pipeline.predict(sample)
    probabilities = pipeline.predict_proba(sample)
    classes = list(pipeline.named_steps["classifier"].classes_)

    print("Smart Spectacles risk model smoke test")
    print("=" * 42)
    print(f"Loaded model: {MODEL_PATH}")
    print(f"Rows in CSV: {len(df)}")
    print(f"Distinct sensor feature rows: {len(unique_data)}")
    print(f"Duplicate feature rows: {duplicate_count}")
    print(f"Distinct rows tested: {len(sample)}")

    if len(sample) < 10:
        print(
            "\nWARNING: Fewer than 10 distinct sensor readings are available. "
            "Your dataset contains many repeated feature combinations."
        )

    print("\nPredictions (distinct feature rows from the training CSV):")
    for index, (row_index, prediction, probability_row) in enumerate(
        zip(sample.index, predictions, probabilities), start=1
    ):
        confidence = max(probability_row) * 100
        probability_text = ", ".join(
            f"{label}={probability * 100:.1f}%"
            for label, probability in zip(classes, probability_row)
        )
        print(
            f"Sample {index:02d} (CSV row {row_index + 2}): "
            f"predicted={prediction} | model score={confidence:.1f}% | "
            f"{probability_text}"
        )

    print(
        "\nNOTE: This verifies inference only. Samples come from the training "
        "CSV, so results are not independent validation and are not a safety guarantee."
    )


if __name__ == "__main__":
    main()
