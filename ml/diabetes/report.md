# HealthCheck Diabetes Risk Model — v0 Training Report

## Data

| Source | Rows | Role |
|---|---|---|
| `diabetes_prediction_dataset.csv` (Kaggle, public) | 100,000 (8,500 positive, 8.5%) | Training + internal test split (80/20, stratified) |
| `nigeria_validation.csv` (extracted from Evwiekpaefe & Abdulkadir, 2023, Appendix A) | 50 (27 positive, 54%) | External validation only — never trained on |
| `pima_validation.csv` (classic Pima Indians Diabetes dataset) | 724 after dropping 44 rows with missing-data sentinels (0-valued Glucose/BMI/BloodPressure) | External validation only — never trained on |

The Nigerian paper's own 255-patient dataset was **not** available as a raw file, only as a paper — the 50 rows above are transcribed directly from its Appendix A validation table (age, sex, pregnancies, glucose in mmol/L, BMI, blood pressure, weight, height, exercise, outcome). Glucose was converted mmol/L → mg/dL (×18.0182) for comparability. Hypertension was derived from blood pressure (≥140 systolic or ≥90 diastolic), matching the paper's own threshold.

**Why not merge everything into one training set:** the Nigerian sample (50 rows) is ~0.06% the size of the primary dataset (80,000 training rows) — concatenating it in would have a negligible effect on the trained model while creating a false impression that the model was "tuned for Nigeria." Instead it's used purely as held-out validation: a check on whether the model's signal transfers to a population it never saw.

## Two models were trained

- **`full`** (8 features: gender, age, hypertension, heart_disease, smoking_history, BMI, HbA1c, blood glucose) — the production candidate, assuming the app collects HbA1c.
- **`core`** (5 features: age, gender, BMI, glucose, hypertension) — only the features present in *all three* datasets. This is the one actually used for external validation below, so that comparison is apples-to-apples instead of imputing a fabricated HbA1c value for populations that were never measured for it.

Algorithm: **XGBoost** (gradient-boosted trees), not the ANN the Nigerian paper used. Reasoning: trees get *exact* SHAP values via `TreeExplainer` in milliseconds — this is what actually restores the real, per-patient explainability the app's Risk Prediction screen needs, instead of the hand-written heuristic-weight approximation currently in `AssessScreen.tsx`/`RiskPredictionScreen.tsx`. Class imbalance (8.5% positive) was handled via `scale_pos_weight`, not synthetic oversampling.

## Internal results (held-out 20% of the primary dataset)

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC | PR-AUC |
|---|---|---|---|---|---|---|
| full | 90.9% | 0.481 | 0.919 | 0.632 | **0.980** | 0.887 |
| core | 81.8% | 0.304 | 0.880 | 0.451 | 0.933 | 0.703 |

Both models are recall-biased by design (missing a diabetic patient is worse than a false alarm for a screening tool) — precision is lower than a naive read of "90.9% accuracy" would suggest, which is expected and correct on an imbalanced dataset like this; accuracy alone would be misleading here (predicting "no diabetes" for everyone would already score 91.5%).

**SHAP feature importance (full model):** HbA1c (3.25) > blood glucose (2.48) > age (0.83) > BMI (0.43) > smoking (0.20) > gender (0.15) > hypertension (0.12) > heart disease (0.08). This matches the Nigerian paper's own finding that glucose is "the major predictor" for diabetes.

## External validation (core model, never trained on either set)

| Population | n | Positive rate | Accuracy | Precision | Recall | ROC-AUC |
|---|---|---|---|---|---|---|
| Nigeria (Kaduna) | 50 | 54% | 70.0% | **1.00** | 0.44 | 0.765 |
| Pima | 724 | 34.4% | 69.8% | 0.69 | 0.22 | 0.763 |

**Reading this honestly:** ROC-AUC (threshold-independent) lands around 0.76 on *both* external populations — meaningfully above the 0.50 random baseline, and a real signal that the model generalizes rather than having just memorized the training distribution. But recall drops hard at the default 0.5 threshold on both — the model is under-flagging positives it's never seen calibrated for.

The most likely cause isn't the model itself — it's that **glucose isn't measured the same way across these three sources**: the primary dataset's `blood_glucose_level` field doesn't specify fasting vs. random; the Nigerian data is self-reported fasting glucose in mmol/L (converted here); Pima's `Glucose` field is specifically a 2-hour oral glucose tolerance test value. Those are three different clinical protocols reported as one column. That's a real, disclosed limitation — not something to paper over.

## Recommendations

1. **Threshold, not architecture, is the first fix.** Before touching the model, recalibrate the decision threshold (currently a flat 0.5) — likely per-context, since a self-reported fasting reading and a lab OGTT value probably shouldn't share one cutoff.
2. **Collect a real glucose/HbA1c input in the app.** This is the single highest-leverage change available — HbA1c and glucose account for the overwhelming majority of the full model's predictive power, and HealthCheck's `HealthInfo` form doesn't collect either today. This ties naturally into the existing "Book Lab Test" flow (`BookLabTestScreen.tsx` already offers a "Blood Sugar (Fasting)" test).
3. **Treat this as v0, not final.** ~50 real Nigerian data points is not enough to be confident the model is well-calibrated for a Nigerian population specifically — it's a sanity check, not a guarantee. If HealthCheck accumulates its own labeled outcomes over time (patients who complete lab tests and get formally diagnosed), that's the real path to a Nigeria-calibrated model down the line.
4. **Serving:** not decided yet. Needs its own decision (Python microservice vs. edge function vs. on-device) — deferred pending your input.

## Artifacts

- `model/full_model.json`, `model/core_model.json` — trained XGBoost boosters (native JSON format, portable).
- `model/full_metrics.json`, `model/core_metrics.json` — full metrics + SHAP importance.
- `model/external_validation.json` — Nigeria/Pima validation results above.
- `model/feature_maps.json` — category encodings (gender, smoking history) needed to reproduce the exact input encoding at inference time.
