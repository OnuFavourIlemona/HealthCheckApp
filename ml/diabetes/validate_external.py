"""
Checks the "core" model (age, gender, bmi, glucose, hypertension — the 5
features every dataset here actually has) against two real populations it
never trained on:

  - Nigeria: ~50 patients extracted from Appendix A of Evwiekpaefe &
    Abdulkadir (2023), a Kaduna hospital study. Glucose there was recorded
    in mmol/L and is converted to mg/dL for comparability. Hypertension is
    derived from blood pressure (>=140 systolic or >=90 diastolic), matching
    the paper's own "140/90 = High Blood Pressure" threshold.
  - Pima: the classic Pima Indians Diabetes dataset. All patients are
    female, so gender is fixed accordingly. Rows with 0-valued Glucose,
    BMI or BloodPressure are dropped — those zeros are a well-known
    missing-data sentinel in this dataset, not real measurements.

This is deliberately NOT folded into training. With ~50 Nigerian rows
against ~80,000 training rows, blending them in would barely move the
model while creating a false impression that it was "tuned for Nigeria."
Using them as held-out validation is the honest way to check the model
still works on a population it's never seen.

Run: python validate_external.py (after train.py)
"""

import json
import os

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
MODEL_DIR = os.path.join(HERE, "model")

MMOL_TO_MGDL = 18.0182


def load_core_model():
    model = xgb.XGBClassifier()
    model.load_model(os.path.join(MODEL_DIR, "core_model.json"))
    with open(os.path.join(MODEL_DIR, "feature_maps.json")) as f:
        maps = json.load(f)
    return model, maps["core_features"]


def prep_nigeria():
    df = pd.read_csv(os.path.join(DATA, "nigeria_validation.csv"))
    df["gender_code"] = df["sex"].map({"MALE": 1, "FEMALE": 0})
    df["blood_glucose_level"] = df["glucose_mmol"] * MMOL_TO_MGDL
    df["hypertension"] = (
        (df["bp_systolic"] >= 140) | (df["bp_diastolic"] >= 90)
    ).astype(int)
    df["bmi"] = df["bmi"]
    df["age"] = df["age"]
    y = df["outcome"]
    return df, y


def prep_pima():
    df = pd.read_csv(os.path.join(DATA, "pima_validation.csv"))
    before = len(df)
    df = df[(df["Glucose"] > 0) & (df["BMI"] > 0) & (df["BloodPressure"] > 0)].copy()
    dropped = before - len(df)
    print(f"Pima: dropped {dropped}/{before} rows with missing-data sentinels (0-values)")

    df["gender_code"] = 0  # Pima cohort is all female
    df["blood_glucose_level"] = df["Glucose"]
    df["hypertension"] = (df["BloodPressure"] >= 90).astype(int)
    df["bmi"] = df["BMI"]
    df["age"] = df["Age"]
    y = df["Outcome"]
    return df, y


def evaluate(name, df, y, model, features):
    X = df[features]
    proba = model.predict_proba(X)[:, 1]
    preds = (proba >= 0.5).astype(int)

    metrics = {
        "n": int(len(df)),
        "positive_rate": float(y.mean()),
        "accuracy": float(accuracy_score(y, preds)),
        "precision": float(precision_score(y, preds, zero_division=0)),
        "recall": float(recall_score(y, preds, zero_division=0)),
        "f1": float(f1_score(y, preds, zero_division=0)),
        "roc_auc": float(roc_auc_score(y, proba)) if len(set(y)) > 1 else None,
        "confusion_matrix": confusion_matrix(y, preds).tolist(),
    }
    print(f"\n=== External validation: {name} ({metrics['n']} rows) ===")
    for k, v in metrics.items():
        print(f"{k}: {v}")
    return metrics


def main():
    model, features = load_core_model()

    nigeria_df, nigeria_y = prep_nigeria()
    pima_df, pima_y = prep_pima()

    results = {
        "nigeria": evaluate("Nigeria (Kaduna hospital sample)", nigeria_df, nigeria_y, model, features),
        "pima": evaluate("Pima Indians Diabetes dataset", pima_df, pima_y, model, features),
    }

    with open(os.path.join(MODEL_DIR, "external_validation.json"), "w") as f:
        json.dump(results, f, indent=2)

    print("\nSaved to", os.path.join(MODEL_DIR, "external_validation.json"))


if __name__ == "__main__":
    main()
