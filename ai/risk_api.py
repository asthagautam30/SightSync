from pathlib import Path
from typing import Literal

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "risk_classifier.joblib"

app = FastAPI(
    title="Smart Spectacles Risk Classifier",
    version="1.0.0",
    description="Development API for classifying sensor readings. Predictions are not validated for real-world safety use.",
)

class SensorReading(BaseModel):
    uv: float = Field(ge=0)
    gas: float = Field(ge=0)
    light: float = Field(ge=0)
    distance: float = Field(ge=0)
    uv_baseline: float = Field(ge=0)
    gas_baseline: float = Field(ge=0)
    light_baseline: float = Field(ge=0)
    distance_baseline: float = Field(ge=0)

def load_bundle():
    if not MODEL_PATH.exists():
        raise RuntimeError(
            f"Model not found at {MODEL_PATH}. Run: python ai/train_risk_model.py"
        )
    bundle = joblib.load(MODEL_PATH)
    if not isinstance(bundle, dict) or "pipeline" not in bundle or "features" not in bundle:
        raise RuntimeError("Model bundle is missing required pipeline/features.")
    return bundle

@app.get("/health")
def health():
    return {"status": "ok", "model_available": MODEL_PATH.exists()}

@app.post("/predict")
def predict(reading: SensorReading):
    try:
        bundle = load_bundle()
        row = {feature: getattr(reading, feature) for feature in bundle["features"]}
        frame = pd.DataFrame([row], columns=bundle["features"])
        pipeline = bundle["pipeline"]
        prediction = str(pipeline.predict(frame)[0])
        probabilities = {}
        if hasattr(pipeline, "predict_proba"):
            probs = pipeline.predict_proba(frame)[0]
            probabilities = {
                str(label): round(float(prob), 4)
                for label, prob in zip(pipeline.classes_, probs)
            }
        return {
            "risk": prediction,
            "probabilities": probabilities,
            "development_only": bool(bundle.get("development_only", True)),
            "warning": "Development-only prediction; validate with independently collected sensor readings.",
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
