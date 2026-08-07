"""
Trains the HealthCheck stroke risk model on the classic Kaggle "healthcare
stroke" dataset (5,110 rows, ~4.9% positive — a realistic, heavily
imbalanced base rate for stroke, unlike diabetes/hypertension's more
balanced sources).

Every feature used here is a genuine pre-diagnosis risk factor (age,
gender, hypertension, heart disease, glucose, BMI, smoking) — none of them
restate the target, so there's no leakage concern like the hypertension
dataset's BP_History had.

201 rows (3.9%) have a missing BMI ("N/A") — imputed with the training
split's median BMI rather than dropped, since 3.9% is small enough that
dropping would just waste data.

Two models are trained:
  - "full"  — all 7 features (gender, age, hypertension, heart_disease,
    avg_glucose_level, bmi, smoking_status). Needs the glucose input the
    diabetes model also needs.
  - "core"  — only what HealthCheck's Health Info form already collects
    today: age, gender, hypertension, bmi, smoking_status (no glucose, no
    heart-disease question exists yet).

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
    "avg_glucose_level",
    "bmi",
    "smoking_code",
]
CORE_FEATURES = ["age", "gender_code", "hypertension", "bmi", "smoking_code"]

GENDER_MAP = {"Female": 0, "Male": 1, "Other": 2}
SMOKING_MAP = {"Unknown": 0, "never smoked": 1, "formerly smoked": 2, "smokes": 3}


def load_primary():
    df = pd.read_csv(os.path.join(DATA, "primary.csv"))
    df["bmi"] = pd.to_numeric(df["bmi"], errors="coerce")
    df["gender_code"] = df["gender"].map(GENDER_MAP)
    df["smoking_code"] = df["smoking_status"].map(SMOKING_MAP)
    return df


def train_one(df, features, name, median_bmi=None):
    X = df[features].copy()
    y = df["stroke"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
    )

    # Impute missing BMI with the TRAINING split's median only, to avoid
    # leaking test-set information into the imputation value.
    if "bmi" in X_train.columns:
        fill_value = X_train["bmi"].median()
        X_train["bmi"] = X_train["bmi"].fillna(fill_value)
        X_test["bmi"] = X_test["bmi"].fillna(fill_value)
    else:
        fill_value = None

    neg, pos = np.bincount(y_train)
    scale_pos_weight = neg / pos

    model = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.06,
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
        "precision": float(precision_score(y_test, preds, zero_division=0)),
        "recall": float(recall_score(y_test, preds, zero_division=0)),
        "f1": float(f1_score(y_test, preds, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_test, proba)),
        "pr_auc": float(average_precision_score(y_test, proba)),
        "confusion_matrix": confusion_matrix(y_test, preds).tolist(),
        "bmi_fill_value": float(fill_value) if fill_value is not None else None,
    }

    print(f"\n=== {name} model ({len(features)} features) ===")
    for k, v in metrics.items():
        print(f"{k}: {v}")

    model.save_model(os.path.join(MODEL_DIR, f"{name}_model.json"))

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_test)
    mean_abs_shap = np.abs(shap_values).mean(axis=0)
    importance = sorted(zip(features, mean_abs_shap.tolist()), key=lambda t: -t[1])
    print("Mean |SHAP| feature importance:")
    for feat, val in importance:
        print(f"  {feat}: {val:.4f}")

    with open(os.path.join(MODEL_DIR, f"{name}_metrics.json"), "w") as f:
        json.dump(
            {
                "metrics": metrics,
                "shap_importance": importance,
                "features": features,
                "bmi_fill_value": metrics["bmi_fill_value"],
            },
            f,
            indent=2,
        )

    return model, metrics, importance


def main():
    df = load_primary()
    print(f"Loaded {len(df)} rows, {df['stroke'].sum()} positive "
          f"({df['stroke'].mean() * 100:.2f}%)")
    print(f"Missing BMI: {df['bmi'].isna().sum()} rows")

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
