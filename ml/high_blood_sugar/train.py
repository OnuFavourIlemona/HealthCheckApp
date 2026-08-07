"""
Trains the HealthCheck "High Blood Sugar" risk model — deliberately reusing
the same primary dataset as the diabetes model, since the two conditions
are closely related (see ml/diabetes/). The difference: this model predicts
whether someone's fasting glucose/HbA1c is *currently elevated*
(hyperglycemia / prediabetes-or-worse) from lifestyle and demographic
factors ALONE — i.e. for someone who doesn't have a glucose reading yet,
unlike the diabetes model, which uses glucose/HbA1c as an input when
available. Glucose and HbA1c are therefore the TARGET here, not inputs —
using them as features too would be pure leakage.

Target definition: HbA1c >= 5.7% OR fasting glucose >= 100 mg/dL (the
standard ADA prediabetes-or-worse threshold — this also naturally includes
everyone already diagnosed diabetic, which is expected: diabetics do have
high blood sugar, this is meant to be a broader early-warning category, not
a mutually-exclusive one from the diabetes assessment).

IMPORTANT CAVEAT (see report.md for the full discussion): the primary
dataset's own glucose distribution is NOT representative of a general
population — its median fasting glucose is 140 mg/dL, versus ~90-95 mg/dL
in a real healthy population. That makes this dataset case-enriched, not
epidemiologically representative, which is why 91% of rows end up
"positive" under this threshold. Accuracy is therefore a meaningless metric
here (predicting "yes" for everyone already scores 91%) — ROC-AUC/PR-AUC
are what matter, and the Nigerian validation set (a real, if small, sample
with a far more plausible 48% positive rate) is the more meaningful sanity
check on real-world calibration.

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

FULL_FEATURES = ["age", "gender_code", "hypertension", "heart_disease", "smoking_code", "bmi"]
# Only the fields present in the Nigerian validation sample (no
# smoking_history or heart_disease there) — used for the external check.
CORE_FEATURES = ["age", "gender_code", "bmi", "hypertension"]

GENDER_MAP = {"Female": 0, "Male": 1, "Other": 2}
SMOKING_MAP = {
    "No Info": 0,
    "never": 1,
    "former": 2,
    "not current": 3,
    "ever": 4,
    "current": 5,
}

HBA1C_THRESHOLD = 5.7
GLUCOSE_THRESHOLD = 100


def load_primary():
    df = pd.read_csv(os.path.join(DATA, "diabetes_prediction_dataset.csv"))
    df["gender_code"] = df["gender"].map(GENDER_MAP)
    df["smoking_code"] = df["smoking_history"].map(SMOKING_MAP)
    df["target"] = (
        (df["HbA1c_level"] >= HBA1C_THRESHOLD) | (df["blood_glucose_level"] >= GLUCOSE_THRESHOLD)
    ).astype(int)
    return df


def train_one(df, features, name):
    X = df[features]
    y = df["target"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
    )

    neg, pos = np.bincount(y_train)
    scale_pos_weight = neg / pos  # here pos is the majority class, so this is < 1 — fine, XGBoost handles it symmetrically.

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

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_test.iloc[:2000])
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
          f"({df['target'].mean() * 100:.2f}%) under HbA1c>={HBA1C_THRESHOLD} OR "
          f"glucose>={GLUCOSE_THRESHOLD} mg/dL")

    train_one(df, FULL_FEATURES, "full")
    train_one(df, CORE_FEATURES, "core")

    with open(os.path.join(MODEL_DIR, "feature_maps.json"), "w") as f:
        json.dump(
            {
                "gender_map": GENDER_MAP,
                "smoking_map": SMOKING_MAP,
                "full_features": FULL_FEATURES,
                "core_features": CORE_FEATURES,
                "hba1c_threshold": HBA1C_THRESHOLD,
                "glucose_threshold": GLUCOSE_THRESHOLD,
            },
            f,
            indent=2,
        )
    print("\nSaved models + metrics to", MODEL_DIR)


if __name__ == "__main__":
    main()
