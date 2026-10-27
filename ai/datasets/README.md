# SightSync risk dataset

## Goal

Train the experimental Random Forest once from a labelled CSV, so normal live sensor readings do not need to be labelled one by one.

## Important limitation

Do not use a random public dataset or rename its labels to `low`, `moderate`, and `elevated`. A valid training row must contain **all four readings from this project** (UV, gas, light, distance), the corresponding four baselines, and a defensible risk label. The UCI Gas Sensor Array Drift dataset, for example, labels gas categories and does not provide this project's four features or its three risk classes, so it cannot directly train this classifier.

Do not create labels by applying the same fixed thresholds that the model is meant to learn. That would only teach the model to imitate those rules. Use labels from a documented assessment protocol, domain-expert review, or a genuinely compatible labelled dataset. Until then, the dashboard's fixed-limit fallback remains active.

## CSV format

Copy `ai/datasets/risk_training_template.csv` to `ai/datasets/risk_training.csv`. Fill in real observations, one row per observation:

- `uv,gas,light,distance`: the four sensor readings.
- `uv_baseline,gas_baseline,light_baseline,distance_baseline`: the matching baselines at the time of the observation.
- `risk`: exactly `low`, `moderate`, or `elevated`.

Use at least 30 complete rows and at least 8 examples for each of the three classes. Use the same sensor units and calibration as the deployed setup. Do not include personal data.

## Train once

From the repository root, activate your project's Python environment and run:

```bash
python3 -m pip install -r ai/requirements-ml.txt
python3 -m ai.risk_model --train-csv ai/datasets/risk_training.csv
```

The trainer evaluates a held-out test split and only saves/promotes the model if macro F1 and balanced accuracy are both at least 0.65. It prints the evaluation summary. A failed evaluation means no new model is saved; improve the labelled dataset rather than lowering the requirement just to force a model.

## Then run the app

Start the Python Firebase runner as you normally do. If the validated experimental artifact is present, live readings can receive a Random Forest prediction automatically; fixed-limit warnings still override it. If no suitable labelled dataset is ready, no classifier is promoted and the fixed-limit fallback continues to work.

The model is a project prototype, not a validated medical, UV, air-quality, or life-safety instrument. Calibrate sensors and validate labels/model independently before making real-world safety claims.
