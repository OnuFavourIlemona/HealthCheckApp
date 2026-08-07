# HealthCheck Stroke Risk Model — v0 Training Report

## Data

**`primary.csv`** (the classic Kaggle "healthcare-dataset-stroke-data", 5,110 rows) — gender, age, hypertension, heart_disease, ever_married, work_type, Residence_type, avg_glucose_level, bmi, smoking_status → stroke. **4.87% positive** — a realistic, heavily imbalanced base rate for stroke (unlike the diabetes/hypertension sources, which were closer to balanced). 201 rows (3.9%) had a missing BMI value, imputed with the training split's median (28.0) rather than dropped.

Every feature used here is a genuine pre-diagnosis risk factor — no leakage concern like hypertension's `BP_History` had.

## Two models trained

- **`full`** (7 features: gender, age, hypertension, heart_disease, avg_glucose_level, bmi, smoking) — needs the same glucose input the diabetes model needs, plus a heart-disease question the app doesn't ask today.
- **`core`** (5 features: age, gender, hypertension, bmi, smoking) — only what HealthCheck's Health Info form collects today (it already asks about existing hypertension, which is a real, non-circular input here since the target is stroke, not hypertension).

## Results (held-out 20% of primary.csv)

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC | PR-AUC |
|---|---|---|---|---|---|---|
| full | 87.3% | 0.177 | 0.440 | 0.253 | **0.813** | 0.209 |
| core | 84.6% | 0.168 | 0.540 | 0.256 | 0.812 | 0.167 |

Precision looks low in absolute terms, but that's expected and correct on a ~5%-positive dataset — PR-AUC (0.21) is the more honest read of precision/recall tradeoff here than the raw numbers at a flat 0.5 threshold, and both are far above the 4.87% baseline a random/no-skill classifier would get. As with the other two conditions, the threshold should be tuned for recall before this goes anywhere near production, since missing a real stroke risk is far worse than a false alarm.

**SHAP feature importance (full model):** age (2.93) ≫ BMI (1.07) > avg_glucose_level (0.64) > smoking (0.18) > hypertension (0.13) > gender (0.11) > heart_disease (0.04). Age dominates by a wide margin — consistent with real stroke epidemiology (stroke risk rises sharply with age).

## External validation — a genuine negative result, reported honestly

`stroke_prediction_dataset.csv` (15,000 rows, a second Kaggle dataset, self-described as "synthetically generated") was tried as an external validation set, the same way Pima and the Nigerian paper validated the diabetes model. **Result: ROC-AUC 0.50 — exactly random. The model has no signal on this dataset at all.**

This was checked for a bug in the validation code first — it isn't one. A direct correlation check shows why: in that dataset, mean age is **54.08 for non-stroke vs. 53.99 for stroke** (correlation ≈ 0.00), and BMI/glucose show the same near-zero pattern. Age is the single most universally-established stroke risk factor in real medicine; a dataset where age has no relationship to its own stroke label doesn't reflect real epidemiology, regardless of how it's labeled. Its `Diagnosis` column appears to have been generated independently of the clinical features included in it (possibly driven by other columns not used here, like free-text `Symptoms`, or just generated without a real feature→label model at all).

**Conclusion:** this second dataset isn't a valid benchmark and was excluded from the model's credibility case. Confidence in the stroke model instead rests on (a) strong internal performance on the well-established primary dataset, and (b) its SHAP ranking matching real clinical knowledge (age dominant, BMI/glucose/smoking meaningful, consistent with published stroke risk literature) — not on this failed external check.

## Limitations

- No real Nigerian stroke data was available in this folder (the two PDFs — `aakag023.1316.pdf` and the Nigerian acute-stroke pattern paper — weren't yet reviewed in this pass; worth reading before treating this as final, the same way the diabetes paper shaped that model's validation).
- `stroke_risk_dataset.csv` (70,001 rows, symptom-checklist based) and `stroke_risk_prediction_dataset.csv` (50,001 rows, very rich synthetic clinical features) exist in the source folder but weren't used — the former is a different paradigm (acute symptom triage, not longitudinal risk screening) and the latter shows the same "AI_Health_Recommendation baked into raw data" tell as a fully synthetic dataset, so it was treated with the same skepticism that turned out to be warranted for `stroke_prediction_dataset.csv`.
- Precision at a flat 0.5 threshold is low in absolute terms — expected for a 4.87%-prevalence condition, but means threshold tuning is not optional before any real use, more so than for diabetes/hypertension.

## Artifacts

- `model/full_model.json`, `model/core_model.json` — trained XGBoost boosters.
- `model/full_metrics.json`, `model/core_metrics.json` — metrics + SHAP importance.
- `model/external_validation.json` — the negative validation result above.
- `model/feature_maps.json` — category encodings.
