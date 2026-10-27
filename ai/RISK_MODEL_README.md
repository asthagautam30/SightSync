# Smart Spectacles risk classifier (development)

This folder contains a baseline machine-learning training script for the
environmental risk classes **Low**, **Moderate**, and **Elevated**.

## 1. Add the dataset

Place the CSV at:

```text
ai/data/smart_spectacles_augmented_risk_training_100.csv
```

It must contain these columns:

```text
uv,gas,light,distance,uv_baseline,gas_baseline,light_baseline,distance_baseline,risk
```

The CSV is not committed by this change. Add the downloaded CSV locally at the
path above. Do not commit secrets, Firebase credentials, or private user data.

## 2. Create a Python environment

From the repository root on macOS/Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r ai/requirements-risk.txt
```

## 3. Train

```bash
python ai/train_risk_model.py
```

Outputs are saved under `ai/models/`:

- `risk_classifier.joblib` — fitted preprocessing pipeline and classifier
- `risk_model_metrics.json` — hold-out metrics and dataset counts

These generated model files should normally remain local and should not be
committed unless the team intentionally decides to version a model artifact.

## Important data-quality note

The current 100-row dataset contains generated examples. Synthetic rows and
near-duplicates can cause train/test leakage or make metrics appear better than
they would on unseen sensor readings. Treat this model as a software-development
baseline only. Review labels and evaluate against independently collected,
reviewed real readings before using predictions to drive real-world warnings.

The classifier's labels are learned from the CSV; this script does not establish
medical or environmental safety thresholds and does not diagnose eye conditions.
