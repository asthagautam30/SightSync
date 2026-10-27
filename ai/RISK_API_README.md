# Smart Spectacles Risk API

Development-only HTTP API that loads the trained model bundle from `ai/models/risk_classifier.joblib`.

## Setup

From the repository root, activate your existing virtual environment and install dependencies:

```bash
pip install -r ai/requirements-api.txt
python ai/train_risk_model.py
uvicorn ai.risk_api:app --reload --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/docs` to try the API. Health check: `GET /health`.

## Prediction request

Send a `POST` request to `/predict` with all eight numeric fields:

```json
{
  "uv": 456,
  "gas": 843,
  "light": 1291,
  "distance": 46.43,
  "uv_baseline": 2000,
  "gas_baseline": 1239.55,
  "light_baseline": 1000,
  "distance_baseline": 50
}
```

The response contains a predicted risk label, model probabilities when available, and a development-only warning.

## Important

The model bundle is generated locally and is intentionally not committed to Git. Each machine must install `ai/requirements-risk.txt`, provide the training CSV at `ai/data/smart_spectacles_augmented_risk_training_100.csv`, and run `python ai/train_risk_model.py` before starting the API. The training data contains synthetic examples; do not use predictions as a validated safety or medical assessment.

This service binds to localhost by default. Do not expose it publicly without authentication, request limits, and deployment review.
