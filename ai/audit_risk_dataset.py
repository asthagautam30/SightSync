"""
Audit the Smart Spectacles risk CSV before model training.

Reports repeated sensor feature combinations, combinations carrying conflicting
risk labels, and risk class counts. This does not change the dataset.
"""
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "smart_spectacles_augmented_risk_training_100.csv"
FEATURES = [
    "uv", "gas", "light", "distance",
    "uv_baseline", "gas_baseline", "light_baseline", "distance_baseline",
]
TARGET = "risk"


def main() -> None:
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"CSV not found: {DATA_PATH}\n"
            "Place the training CSV in ai/data/ before running this audit."
        )

    df = pd.read_csv(DATA_PATH, sep=None, engine="python")
    missing = [column for column in FEATURES + [TARGET] if column not in df.columns]
    if missing:
        raise ValueError("Missing required columns: " + ", ".join(missing))

    df = df[FEATURES + [TARGET]].copy()
    for column in FEATURES:
        df[column] = pd.to_numeric(df[column], errors="coerce")
    df[TARGET] = df[TARGET].astype("string").str.strip().str.title()

    invalid = df[FEATURES].isna().any(axis=1) | df[TARGET].isna()
    print("Smart Spectacles dataset audit")
    print("=" * 38)
    print(f"Rows in file: {len(df)}")
    print(f"Rows with missing/invalid feature or risk: {int(invalid.sum())}")

    valid = df.loc[~invalid].copy()
    print(f"Valid rows: {len(valid)}")
    print(f"Distinct sensor feature combinations: {len(valid[FEATURES].drop_duplicates())}")
    print(f"Repeated rows beyond first occurrence: {len(valid) - len(valid[FEATURES].drop_duplicates())}")

    print("\nRisk label counts:")
    print(valid[TARGET].value_counts(dropna=False).to_string())

    label_counts = valid.groupby(FEATURES, dropna=False)[TARGET].nunique()
    conflicting_keys = label_counts[label_counts > 1].index
    conflicting = valid.set_index(FEATURES).loc[
        valid.set_index(FEATURES).index.isin(conflicting_keys)
    ].reset_index()

    print(f"\nSensor combinations with conflicting labels: {len(conflicting_keys)}")
    if len(conflicting_keys):
        print("\nConflicting examples (up to 20 rows):")
        print(conflicting.head(20).to_string(index=False))
    else:
        print("No exact feature combinations have conflicting risk labels.")

    print(
        "\nNEXT STEP: Review conflicting combinations and confirm labels against "
        "real sensor observations. Synthetic variants do not count as independent "
        "real-world samples. This audit only reports issues; it does not modify data."
    )


if __name__ == "__main__":
    main()
