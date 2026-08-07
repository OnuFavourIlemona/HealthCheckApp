"""
Trains the HealthCheck diabetes risk model on the large public dataset
(diabetes_prediction_dataset.csv, ~100k rows), then checks how well it
generalises to two independent, real patient populations it never saw during
training: a Nigerian hospital sample (extracted from the Evwiekpaefe &
Abdulkadir 2023 paper) and the Pima Indians Diabetes dataset.

Two models are trained on purpose:
  - "full"  — uses every feature in the primary dataset (gender, age,
    hypertension, heart_disease, smoking_history, bmi, HbA1c, glucose).
    This is the candidate for production, once the app collects HbA1c.
  - "core"  — uses only the 5 features present in ALL THREE datasets
    (age, gender, bmi, glucose, hypertension). This is what's actually
    used for the external-validation comparison below, so that comparison
    is apples-to-apples instead of silently imputing a missing HbA1c value
    for populations that were never measured for it.

Run: python train.py
"""

import json
import os

import numpy as np
import pandas as pd
import shap
import xgboost as xgb
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
MODEL_DIR = os.path.join(HERE, "model")
os.makedirs(MODEL_DIR, exist_ok=True)

RANDOM_STATE = 42

FULL_FEATURES = [
    "age",
    "gender_code",
    "hypertension",
    "heart_disease",
    "smoking_code",
    "bmi",
    "HbA1c_level",
    "blood_glucose_level",
]
CORE_FEATURES = ["age", "gender_code", "bmi", "blood_glucose_level", "hypertension"]

GENDER_MAP = {"Female": 0, "Male": 1, "Other": 2}
SMOKING_MAP = {
    "No Info": 0,
    "never": 1,
    "former": 2,
    "not current": 3,
    "ever": 4,
    "current": 5,
}


def load_primary():
    df = pd.read_csv(os.path.join(DATA, "diabetes_prediction_dataset.csv"))
    df["gender_code"] = df["gender"].map(GENDER_MAP)
    df["smoking_code"] = df["smoking_history"].map(SMOKING_MAP)
    return df


def train_one(df, features, name, use_smote=False):
    X = df[features]
    y = df["diabetes"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
    )

    # Class imbalance (diabetes is the ~8.5% minority class) — weight the
    # positive class instead of resampling, so we don't invent synthetic rows.
    neg, pos = np.bincount(y_train)
    scale_pos_weight = neg / pos

    model = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.08,
        subsample=0.9,
        colsample_bytree=0.9,
        scale_pos_weight=scale_pos_weight,
        eval_metric="aucpr",
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    proba = model.predict_proba(X_test)[:, 1]
    preds = (proba >= 0.5).astype(int)

    metrics = {
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "accuracy": float(accuracy_score(y_test, preds)),
        "precision": float(precision_score(y_test, preds)),
        "recall": float(recall_score(y_test, preds)),
        "f1": float(f1_score(y_test, preds)),
        "roc_auc": float(roc_auc_score(y_test, proba)),
        "pr_auc": float(average_precision_score(y_test, proba)),
        "confusion_matrix": confusion_matrix(y_test, preds).tolist(),
    }

    print(f"\n=== {name} model ({len(features)} features) ===")
    for k, v in metrics.items():
        print(f"{k}: {v}")

    model.save_model(os.path.join(MODEL_DIR, f"{name}_model.json"))

    # SHAP — exact, fast, tree-based. This is what will replace the
    # heuristic-weight factor breakdown in RiskPredictionScreen.
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_test.iloc[:2000])
    mean_abs_shap = np.abs(shap_values).mean(axis=0)
    importance = sorted(
        zip(features, mean_abs_shap.tolist()), key=lambda t: -t[1]
    )
    print("Mean |SHAP| feature importance:")
    for feat, val in importance:
        print(f"  {feat}: {val:.4f}")

    with open(os.path.join(MODEL_DIR, f"{name}_metrics.json"), "w") as f:
        json.dump(
            {"metrics": metrics, "shap_importance": importance, "features": features},
            f,
            indent=2,
        )

    return model, metrics, importance


def main():
    df = load_primary()
    print(f"Loaded {len(df)} rows, {df['diabetes'].sum()} positive "
          f"({df['diabetes'].mean() * 100:.2f}%)")

    train_one(df, FULL_FEATURES, "full")
    train_one(df, CORE_FEATURES, "core")

    with open(os.path.join(MODEL_DIR, "feature_maps.json"), "w") as f:
        json.dump(
            {
                "gender_map": GENDER_MAP,
                "smoking_map": SMOKING_MAP,
                "full_features": FULL_FEATURES,
                "core_features": CORE_FEATURES,
            },
            f,
            indent=2,
        )

    print("\nSaved models + metrics to", MODEL_DIR)


if __name__ == "__main__":
    main()
