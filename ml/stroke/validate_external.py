"""
Checks the "core" stroke model against stroke_prediction_dataset.csv
(15,000 rows) — a synthetic dataset the model never trained on, with a
very different base rate (~49.8% positive vs. the primary set's ~4.9%).
That gap is exactly why this is a useful check: ROC-AUC is threshold- and
prevalence-independent, so if it holds up here it means the model learned
real feature relationships rather than just calibrating to one dataset's
class balance.

Column names/encodings differ from the primary dataset and are remapped
below (e.g. "Currently Smokes" -> "smokes").

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

GENDER_MAP = {"Female": 0, "Male": 1, "Other": 2}
SMOKING_MAP = {
    "Non-smoker": 1,       # -> never smoked
    "Formerly Smoked": 2,  # -> formerly smoked
    "Currently Smokes": 3, # -> smokes
}


def load_core_model():
    model = xgb.XGBClassifier()
    model.load_model(os.path.join(MODEL_DIR, "core_model.json"))
    with open(os.path.join(MODEL_DIR, "feature_maps.json")) as f:
        maps = json.load(f)
    with open(os.path.join(MODEL_DIR, "core_metrics.json")) as f:
        core_metrics = json.load(f)
    return model, maps["core_features"], core_metrics.get("bmi_fill_value")


def prep_external(bmi_fill_value):
    df = pd.read_csv(os.path.join(DATA, "stroke_prediction_dataset.csv"))
    df["gender_code"] = df["Gender"].map(GENDER_MAP)
    df["smoking_code"] = df["Smoking Status"].map(SMOKING_MAP)
    df["age"] = df["Age"]
    df["hypertension"] = df["Hypertension"]
    df["bmi"] = pd.to_numeric(df["Body Mass Index (BMI)"], errors="coerce")
    if bmi_fill_value is not None:
        df["bmi"] = df["bmi"].fillna(bmi_fill_value)
    y = (df["Diagnosis"] == "Stroke").astype(int)
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
        "roc_auc": float(roc_auc_score(y, proba)),
        "confusion_matrix": confusion_matrix(y, preds).tolist(),
    }
    print(f"\n=== External validation: {name} ({metrics['n']} rows) ===")
    for k, v in metrics.items():
        print(f"{k}: {v}")
    return metrics


def main():
    model, features, bmi_fill_value = load_core_model()
    df, y = prep_external(bmi_fill_value)

    results = {
        "stroke_prediction_dataset": evaluate(
            "stroke_prediction_dataset.csv (synthetic, ~50% positive)", df, y, model, features
        )
    }

    with open(os.path.join(MODEL_DIR, "external_validation.json"), "w") as f:
        json.dump(results, f, indent=2)
    print("\nSaved to", os.path.join(MODEL_DIR, "external_validation.json"))


if __name__ == "__main__":
    main()
