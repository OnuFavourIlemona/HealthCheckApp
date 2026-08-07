"""
HealthCheck risk-prediction API.

Endpoints:
  GET  /v1/health
  GET  /v1/models
  POST /v1/predict/diabetes
  POST /v1/predict/hypertension
  POST /v1/predict/stroke
  POST /v1/predict/high_blood_sugar

Every predict endpoint accepts a JSON body with optional fields — whichever
optional fields are supplied determine whether the "full" or "core" model
tier is used (see each condition's ml/<condition>/report.md for what the
tiers mean and why). Missing required core fields return HTTP 422 with a
clear message, not a guess.

high_blood_sugar deliberately has no dedicated model — see
ml/high_blood_sugar/report.md for why that was tried and rejected — it
reuses the diabetes model's probability with its own (earlier, lower) risk
thresholds, exactly as implemented client-side in AssessScreen.tsx today.
Both need a real fasting_glucose value; there is no glucose-free tier for
either, because the diabetes models were never trained or validated without
it.
"""

from __future__ import annotations

import json
import os
import secrets
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from inference import ConditionModel, MODEL_DIR, risk_level

app = FastAPI(title="HealthCheck Risk Prediction API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# A shared secret the app sends on every predict call, so this service isn't
# a free, unauthenticated model endpoint anyone on the internet can hit and
# run up Cloud Run costs against. Unset in local dev (no env var) disables
# the check entirely, since there's no secret to leak on localhost.
API_KEY = os.environ.get("PREDICTION_API_KEY")


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    if API_KEY and not (x_api_key and secrets.compare_digest(x_api_key, API_KEY)):
        raise HTTPException(401, "Missing or invalid API key.")


def load_feature_map(condition: str) -> dict:
    with open(MODEL_DIR / condition / "feature_maps.json") as f:
        return json.load(f)


DIABETES_MAPS = load_feature_map("diabetes")
HYPERTENSION_MAPS = load_feature_map("hypertension")
STROKE_MAPS = load_feature_map("stroke")

diabetes_model = ConditionModel(
    "diabetes", DIABETES_MAPS["full_features"], DIABETES_MAPS["core_features"]
)
hypertension_model = ConditionModel(
    "hypertension", HYPERTENSION_MAPS["full_features"], HYPERTENSION_MAPS["core_features"]
)
stroke_model = ConditionModel(
    "stroke", STROKE_MAPS["full_features"], STROKE_MAPS["core_features"]
)

MODELS = {
    "diabetes": diabetes_model,
    "hypertension": hypertension_model,
    "stroke": stroke_model,
}

# LOW/MODERATE/HIGH cutoffs — identical to AssessScreen.tsx's levelForScore(),
# so a user sees the same risk band whether it came from the heuristic or
# this API. high_blood_sugar's lower cutoffs are the enacted "same signal,
# earlier warning" decision from ml/high_blood_sugar/report.md.
THRESHOLDS = {
    "diabetes": (34, 67),
    "hypertension": (34, 67),
    "stroke": (34, 67),
    "high_blood_sugar": (20, 45),
}


def factors_response(factors) -> list[dict]:
    return [
        {
            "feature": f.feature,
            "raw_value": f.raw_value,
            "impact_points": f.impact_points,
            "direction": f.direction,
        }
        for f in factors
    ]


# ---------------------------------------------------------------------------
# Diabetes / High Blood Sugar
# ---------------------------------------------------------------------------


class DiabetesRequest(BaseModel):
    age: float = Field(..., ge=0, le=120)
    gender: Literal["Female", "Male", "Other"]
    bmi: float = Field(..., ge=10, le=80)
    hypertension: bool
    blood_glucose_mgdl: float = Field(..., ge=40, le=600)
    heart_disease: bool | None = None
    smoking_history: (
        Literal["No Info", "never", "former", "not current", "ever", "current"] | None
    ) = None
    hba1c: float | None = Field(None, ge=3, le=15)


def encode_diabetes(req: DiabetesRequest) -> tuple[dict[str, float], set[str]]:
    encoded = {
        "age": req.age,
        "gender_code": DIABETES_MAPS["gender_map"][req.gender],
        "hypertension": int(req.hypertension),
        "bmi": req.bmi,
        "blood_glucose_level": req.blood_glucose_mgdl,
    }
    present = {"age", "gender_code", "hypertension", "bmi", "blood_glucose_level"}
    if req.heart_disease is not None:
        encoded["heart_disease"] = int(req.heart_disease)
        present.add("heart_disease")
    if req.smoking_history is not None:
        encoded["smoking_code"] = DIABETES_MAPS["smoking_map"][req.smoking_history]
        present.add("smoking_code")
    if req.hba1c is not None:
        encoded["HbA1c_level"] = req.hba1c
        present.add("HbA1c_level")
    return encoded, present


def run_diabetes(req: DiabetesRequest, condition_key: str) -> dict:
    encoded, present = encode_diabetes(req)
    tier = diabetes_model.pick_tier(present)
    missing = set(diabetes_model.core_features) - present
    if missing:
        raise HTTPException(
            422,
            f"Missing required field(s) for a diabetes-based prediction: {sorted(missing)}. "
            "blood_glucose_mgdl is always required — there is no glucose-free tier for this model.",
        )
    result = diabetes_model.predict(encoded, tier)
    low_max, moderate_max = THRESHOLDS[condition_key]
    return {
        "condition": condition_key,
        "model_tier": result.model_tier,
        "probability": round(result.probability, 4),
        "score": result.score,
        "risk_level": risk_level(result.score, low_max, moderate_max),
        "base_probability": round(result.base_probability, 4),
        "factors": factors_response(result.factors),
    }


@app.post("/v1/predict/diabetes", dependencies=[Depends(require_api_key)])
def predict_diabetes(req: DiabetesRequest):
    return run_diabetes(req, "diabetes")


@app.post("/v1/predict/high_blood_sugar", dependencies=[Depends(require_api_key)])
def predict_high_blood_sugar(req: DiabetesRequest):
    """Shares the diabetes model; only the risk-level thresholds differ. See module docstring."""
    return run_diabetes(req, "high_blood_sugar")


# ---------------------------------------------------------------------------
# Hypertension
# ---------------------------------------------------------------------------


class HypertensionRequest(BaseModel):
    age: float = Field(..., ge=0, le=120)
    bmi: float = Field(..., ge=10, le=80)
    sleep_duration_hours: float = Field(..., ge=0, le=16)
    smoking_status: Literal["Non-Smoker", "Smoker"]
    salt_intake: float | None = Field(None, ge=0, le=30, description="grams/day")
    stress_score: float | None = Field(None, ge=0, le=10)
    family_history: bool | None = None


@app.post("/v1/predict/hypertension", dependencies=[Depends(require_api_key)])
def predict_hypertension(req: HypertensionRequest):
    encoded = {
        "Age": req.age,
        "BMI": req.bmi,
        "Sleep_Duration": req.sleep_duration_hours,
        "Smoking_Status_code": HYPERTENSION_MAPS["smoking_map"][req.smoking_status],
    }
    present = {"Age", "BMI", "Sleep_Duration", "Smoking_Status_code"}
    if req.salt_intake is not None:
        encoded["Salt_Intake"] = req.salt_intake
        present.add("Salt_Intake")
    if req.stress_score is not None:
        encoded["Stress_Score"] = req.stress_score
        present.add("Stress_Score")
    if req.family_history is not None:
        encoded["Family_History_code"] = int(req.family_history)
        present.add("Family_History_code")

    tier = hypertension_model.pick_tier(present)
    result = hypertension_model.predict(encoded, tier)
    low_max, moderate_max = THRESHOLDS["hypertension"]
    return {
        "condition": "hypertension",
        "model_tier": result.model_tier,
        "probability": round(result.probability, 4),
        "score": result.score,
        "risk_level": risk_level(result.score, low_max, moderate_max),
        "base_probability": round(result.base_probability, 4),
        "factors": factors_response(result.factors),
    }


# ---------------------------------------------------------------------------
# Stroke
# ---------------------------------------------------------------------------


class StrokeRequest(BaseModel):
    age: float = Field(..., ge=0, le=120)
    gender: Literal["Female", "Male", "Other"]
    bmi: float = Field(..., ge=10, le=80)
    hypertension: bool
    smoking_status: Literal["Unknown", "never smoked", "formerly smoked", "smokes"]
    heart_disease: bool | None = None
    avg_glucose_level_mgdl: float | None = Field(None, ge=40, le=600)


@app.post("/v1/predict/stroke", dependencies=[Depends(require_api_key)])
def predict_stroke(req: StrokeRequest):
    encoded = {
        "age": req.age,
        "gender_code": STROKE_MAPS["gender_map"][req.gender],
        "hypertension": int(req.hypertension),
        "bmi": req.bmi,
        "smoking_code": STROKE_MAPS["smoking_map"][req.smoking_status],
    }
    present = {"age", "gender_code", "hypertension", "bmi", "smoking_code"}
    if req.heart_disease is not None:
        encoded["heart_disease"] = int(req.heart_disease)
        present.add("heart_disease")
    if req.avg_glucose_level_mgdl is not None:
        encoded["avg_glucose_level"] = req.avg_glucose_level_mgdl
        present.add("avg_glucose_level")

    tier = stroke_model.pick_tier(present)
    result = stroke_model.predict(encoded, tier)
    low_max, moderate_max = THRESHOLDS["stroke"]
    return {
        "condition": "stroke",
        "model_tier": result.model_tier,
        "probability": round(result.probability, 4),
        "score": result.score,
        "risk_level": risk_level(result.score, low_max, moderate_max),
        "base_probability": round(result.base_probability, 4),
        "factors": factors_response(result.factors),
    }


# ---------------------------------------------------------------------------
# Ops endpoints
# ---------------------------------------------------------------------------


@app.get("/v1/health")
def health():
    return {"status": "ok"}


@app.get("/v1/models")
def models_info():
    return {
        name: {
            "full_features": model.full_features,
            "core_features": model.core_features,
        }
        for name, model in MODELS.items()
    } | {
        "high_blood_sugar": {
            "shares_model_with": "diabetes",
            "note": "Same model as diabetes, different risk-level thresholds only.",
        }
    }
