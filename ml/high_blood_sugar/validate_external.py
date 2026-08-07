"""
Checks the "core" high-blood-sugar model against the real Nigerian sample
(same 50 rows extracted from Evwiekpaefe & Abdulkadir 2023, reused from
ml/diabetes/). This is the more meaningful check than the primary
dataset's own held-out split, precisely because the primary dataset is
case-enriched (see train.py) and Nigeria's 48% positive rate looks far more
like a real population.

Run: python validate_external.py (after train.py)
"""

import json
import os

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
HBA1C_THRESHOLD = 5.7  # unused here — Nigeria data has no HbA1c
GLUCOSE_THRESHOLD = 100


def load_core_model():
    model = xgb.XGBClassifier()
    model.load_model(os.path.join(MODEL_DIR, "core_model.json"))
    with open(os.path.join(MODEL_DIR, "feature_maps.json")) as f:
        maps = json.load(f)
    return model, maps["core_features"]


def prep_nigeria():
    df = pd.read_csv(os.path.join(DATA, "nigeria_validation.csv"))
    df["gender_code"] = df["sex"].map({"MALE": 1, "FEMALE": 0})
    df["glucose_mgdl"] = df["glucose_mmol"] * MMOL_TO_MGDL
    df["hypertension"] = (
        (df["bp_systolic"] >= 140) | (df["bp_diastolic"] >= 90)
    ).astype(int)
    y = (df["glucose_mgdl"] >= GLUCOSE_THRESHOLD).astype(int)
    return df, y


def main():
    model, features = load_core_model()
    df, y = prep_nigeria()

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
    print(f"\n=== External validation: Nigeria (real sample, n={metrics['n']}) ===")
    for k, v in metrics.items():
        print(f"{k}: {v}")

    with open(os.path.join(MODEL_DIR, "external_validation.json"), "w") as f:
        json.dump({"nigeria": metrics}, f, indent=2)
    print("\nSaved to", os.path.join(MODEL_DIR, "external_validation.json"))


if __name__ == "__main__":
    main()
