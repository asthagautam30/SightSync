"""
Test the saved Smart Spectacles risk model using rows from the training CSV.

This is a smoke test, not an independent accuracy evaluation: these examples
come from the same CSV used to train the model and may be synthetic.
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

    # Use a small sample to confirm the saved model can load and make predictions.
    sample = df[features].head(10).apply(pd.to_numeric, errors="coerce")
    predictions = pipeline.predict(sample)
    probabilities = pipeline.predict_proba(sample)
    classes = list(pipeline.named_steps["classifier"].classes_)

    print("Smart Spectacles risk model smoke test")
    print("=" * 42)
    print(f"Loaded model: {MODEL_PATH}")
    print(f"Test rows: {len(sample)}")
    print("\nPredictions (sample rows from the training CSV):")
    for index, (prediction, probability_row) in enumerate(
        zip(predictions, probabilities), start=1
    ):
        confidence = max(probability_row) * 100
        probability_text = ", ".join(
            f"{label}={probability * 100:.1f}%"
            for label, probability in zip(classes, probability_row)
        )
        print(
            f"Row {index:02d}: predicted={prediction} | "
            f"model score={confidence:.1f}% | {probability_text}"
        )

    print(
        "\nNOTE: This only verifies that inference works. These rows are from "
        "the training dataset, so this output is not independent validation "
        "and must not be interpreted as real-world accuracy or a safety guarantee."
    )


if __name__ == "__main__":
    main()
