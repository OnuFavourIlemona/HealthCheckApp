# HealthCheck Hypertension Risk Model — v0 Training Report

## Data

**`hypertension_dataset.csv`** — 1,985 rows, 52.0% positive (well balanced, unlike diabetes/stroke). Features: Age, Salt_Intake, Stress_Score, BP_History, Sleep_Duration, BMI, Medication, Family_History, Exercise_Level, Smoking_Status → Has_Hypertension.

**Two features were deliberately excluded from training:**
- **`BP_History`** (Normal / Prehypertension / Hypertension) — checked empirically: when BP_History = "Hypertension", 92.8% of rows are already labeled Has_Hypertension = Yes. That's not a risk factor, that's a restatement of the answer. A screening tool exists for people who *don't* already know this about themselves — including it would make the model circular.
- **`Medication`** — checked empirically: near-50/50 split across both classes in every medication category, i.e. no real signal in this dataset. Dropping it costs nothing.

No clean per-patient external validation set was available for hypertension (unlike diabetes, which had a real Nigerian paper's appendix data and Pima). See "Nigerian context" below instead.

## Two models trained

- **`full`** (8 features: age, salt intake, stress score, sleep duration, BMI, family history, exercise level, smoking) — needs salt intake and a stress-score question the app doesn't ask today.
- **`core`** (4 features: age, BMI, sleep duration, smoking) — only what HealthCheck's Health Info form collects today. Note: the app's existing "family history" question is specific to *diabetes* (`family_diabetes`), so it can't honestly be reused here without a separate hypertension-specific family-history question — that's excluded from `core` for that reason, not because it isn't predictive.

## Results (held-out 20%)

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC | PR-AUC |
|---|---|---|---|---|---|---|
| full | 76.6% | 0.776 | 0.772 | 0.774 | **0.865** | 0.903 |
| core | 67.8% | 0.688 | 0.694 | 0.691 | 0.748 | 0.776 |

**SHAP feature importance (full model):** Age (0.98) ≈ Family History (0.92) > Smoking (0.80) > Stress Score (0.72) > BMI (0.68) > Sleep Duration (0.54) ≈ Salt Intake (0.53) ≫ Exercise Level (0.08). Family history and stress carry real weight here, which is exactly what's lost by dropping to the `core` feature set — that's the ~0.12 ROC-AUC gap between the two models.

## Nigerian context (cited, not retrained)

This project's sibling folder already contains a real prior analysis: **"Sociodemographic Predictors of Hypertension Risk Among Nigerian Adults"** (Anthony Okeibuno, using Nigeria DHS 2024 — 51,254 real respondents). Its raw survey files require DHS registration and aren't included here, so it wasn't retrained, but its published findings are directly relevant:

- Deliberately sociodemographic-only (no clinical measurements) → **AUC 0.67** (Gradient Boosting). Our lifestyle/clinical `full` model reaching 0.865 makes sense — it has access to genuinely clinical signal (BMI, salt, stress, sleep) that a pure sociodemographic survey doesn't.
- National screened-population hypertension rate: **13.7%**.
- Strong North-South gradient: North East 16.7% diagnosed vs. South East 10.4%.
- Age is the dominant predictor there too — consistent with our SHAP ranking.
- Their standout, policy-relevant finding: **geopolitical zone is the second-strongest predictor**, ahead of wealth or education — something HealthCheck doesn't currently ask about at all, and worth considering as a future onboarding field if regional risk stratification becomes a goal.

## Limitations

- `hypertension_dataset.csv`'s provenance isn't fully verifiable (no accompanying paper, unlike diabetes) — treat it as a reasonable synthetic/aggregated proxy, not a clinically validated source.
- No real per-patient Nigerian validation was possible here, unlike diabetes — the DHS citation above is context, not a benchmark run.
- `Exercise_Level` had negligible SHAP importance (0.08) in this dataset — surprising given its established role in real hypertension research, worth treating with some skepticism as another sign this dataset may not perfectly reflect real-world relationships.

## Artifacts

- `model/full_model.json`, `model/core_model.json` — trained XGBoost boosters.
- `model/full_metrics.json`, `model/core_metrics.json` — metrics + SHAP importance.
- `model/feature_maps.json` — category encodings.
