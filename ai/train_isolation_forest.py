"""Train the experimental Isolation Forest on curated normal sensor readings."""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

FEATURE_NAMES = ["uv", "gas", "light", "distance"]
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "models" / "isolation_forest.joblib"


def train(csv_path: str, output_path: str = str(DEFAULT_OUTPUT),
          contamination: float = 0.03) -> dict:
    if not 0.001 <= contamination <= 0.2:
        raise ValueError("contamination must be between 0.001 and 0.2")
    frame = pd.read_csv(csv_path)
    missing = sorted(set(FEATURE_NAMES) - set(frame.columns))
    if missing:
        raise ValueError("CSV is missing columns: " + ", ".join(missing))
    frame = frame[FEATURE_NAMES].dropna().astype(float)
    if len(frame) < 50:
        raise ValueError("At least 50 valid normal/accepted rows are required.")
    if not all(math.isfinite(float(value)) for value in frame.to_numpy().ravel()):
        raise ValueError("All feature values must be finite numeric readings.")

    train_data, test_data = train_test_split(frame, test_size=0.2, random_state=42)
    model = make_pipeline(
        StandardScaler(),
        IsolationForest(
            n_estimators=200,
            contamination=contamination,
            random_state=42,
            n_jobs=-1,
        ),
    )
    model.fit(train_data)
    predictions = model.predict(test_data)
    scores = model.decision_function(test_data)
    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, destination)
    return {
        "model_path": str(destination),
        "training_rows": len(train_data),
        "test_rows": len(test_data),
        "test_anomaly_candidates": int((predictions == -1).sum()),
        "mean_test_score": float(sum(scores) / len(scores)),
        "note": "Unsupervised outputs are anomaly candidates, not validated hazard labels. Review against independently labelled events.",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", required=True, help="CSV of curated normal/accepted readings")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    parser.add_argument("--contamination", type=float, default=0.03)
    args = parser.parse_args()
    print(json.dumps(train(args.csv, args.output, args.contamination), indent=2))
