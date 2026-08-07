"""
Trains the HealthCheck hypertension risk model on hypertension_dataset.csv
(1,985 rows, roughly balanced: 52% Has_Hypertension=Yes).

Two features from the source dataset were deliberately EXCLUDED:
  - BP_History (Normal/Prehypertension/Hypertension) — this is a near-direct
    restatement of the target. A model that "predicts" hypertension from a
    feature that already says "Hypertension" isn't a screening tool, it's
    leakage. Someone who already knows their BP_History category doesn't
    need a risk screener.
  - Medication — checked empirically (see notebook output below): it's
    ~50/50 across both classes in this dataset, i.e. carries no real signal
    here, so dropping it costs nothing.

As with diabetes, two models are trained:
  - "full" — every remaining lifestyle/demographic feature (age, salt
    intake, stress score, sleep duration, BMI, family history, exercise
    level, smoking). Assumes the app eventually asks about salt intake and
    stress, which it doesn't today.
  - "core" — only what HealthCheck's Health Info form already collects
    today: age, BMI, sleep hours, smoking status. No hypertension-specific
    family-history question exists in the app yet either (only a
    diabetes-specific one), so it's excluded from "core" too.

There is no clean per-patient external validation set available for
hypertension (unlike diabetes, which had the Nigerian paper's appendix and
Pima) — the Nigeria DHS 2024 sociodemographic study in this project's
sibling folder is cited in report.md as context instead, since its raw
data requires DHS registration and isn't included here.

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
    "Age",
    "Salt_Intake",
    "Stress_Score",
    "Sleep_Duration",
    "BMI",
    "Family_History_code",
    "Exercise_Level_code",
    "Smoking_Status_code",
]
CORE_FEATURES = ["Age", "BMI", "Sleep_Duration", "Smoking_Status_code"]

EXERCISE_MAP = {"Low": 0, "Moderate": 1, "High": 2}
YES_NO_MAP = {"No": 0, "Yes": 1}
SMOKING_MAP = {"Non-Smoker": 0, "Smoker": 1}


def load_primary():
    df = pd.read_csv(os.path.join(DATA, "hypertension_dataset.csv"))
    df["Family_History_code"] = df["Family_History"].map(YES_NO_MAP)
    df["Exercise_Level_code"] = df["Exercise_Level"].map(EXERCISE_MAP)
    df["Smoking_Status_code"] = df["Smoking_Status"].map(SMOKING_MAP)
    df["target"] = df["Has_Hypertension"].map(YES_NO_MAP)
    return df


def train_one(df, features, name):
    X = df[features]
    y = df["target"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
    )

    neg, pos = np.bincount(y_train)
    scale_pos_weight = neg / pos

    model = xgb.XGBClassifier(
        n_estimators=250,
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

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_test)
    mean_abs_shap = np.abs(shap_values).mean(axis=0)
    importance = sorted(zip(features, mean_abs_shap.tolist()), key=lambda t: -t[1])
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
    print(f"Loaded {len(df)} rows, {df['target'].sum()} positive "
          f"({df['target'].mean() * 100:.2f}%)")

    train_one(df, FULL_FEATURES, "full")
    train_one(df, CORE_FEATURES, "core")

    with open(os.path.join(MODEL_DIR, "feature_maps.json"), "w") as f:
        json.dump(
            {
                "exercise_map": EXERCISE_MAP,
                "yes_no_map": YES_NO_MAP,
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
