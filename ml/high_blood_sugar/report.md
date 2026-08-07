# HealthCheck "High Blood Sugar" Risk Model — v0 Training Report

> **Decision (enacted):** the shared-model approach below was approved. The app's
> `high_blood_sugar` assessment type now reuses the diabetes score with its own,
> earlier risk-level thresholds — see `levelForScore()` in `AssessScreen.tsx` and
> `/v1/predict/high_blood_sugar` in `api/main.py`. The models trained here remain
> unused, kept only as a documented record of why.
>
> **Known limitation, found by testing the live API (2026-08-05):** for an
> otherwise low-risk profile (young, healthy BMI, no hypertension), the shared
> diabetes model barely responds to glucose at all, and the score is even
> non-monotonic at the high end — a healthy 30-year-old scored 10/100 at
> 126 mg/dL glucose but only 5/100 at 160 mg/dL, clearly the wrong direction.
> Root cause: the diabetes model predicts *diagnosed T2DM*, a high bar, and a
> healthy person with isolated elevated glucose is a rare, atypical combination
> in the training data — the model hasn't learned glucose's effect reliably in
> that sparse region of feature space. It still works well for people who are
> already trending toward several risk factors at once (the common real case),
> just not for "otherwise perfectly healthy except one glucose reading." Worth
> revisiting with isotonic calibration or a proper prediabetes-labeled dataset
> if this case turns out to matter in practice — not fixed here.

## The idea

Reuse the same primary dataset as the diabetes model (they're closely related conditions), but flip what's being predicted: instead of predicting diagnosed diabetes *using* glucose/HbA1c as inputs, predict whether glucose/HbA1c is *itself* likely to be elevated (HbA1c ≥ 5.7% OR fasting glucose ≥ 100 mg/dL — the standard ADA "prediabetes-or-worse" threshold), using only lifestyle/demographic factors (age, gender, BMI, hypertension, smoking, heart disease) as inputs. This is meant for someone who doesn't have a glucose reading yet — the diabetes model's `full` tier already handles the case where they do.

## Result: this doesn't work, and here's the honest reason why

| Model | ROC-AUC (internal) | ROC-AUC (Nigeria, real sample) |
|---|---|---|
| full (6 features) | 0.524 | — |
| core (4 features) | 0.522 | **0.484** |

**Both are statistically indistinguishable from a coin flip (0.50).** This was checked for a bug the same way the stroke external-validation failure was — it isn't one. Direct correlation checks confirm it:

| Feature vs. HbA1c/glucose | Correlation |
|---|---|
| age ↔ HbA1c | 0.101 |
| age ↔ glucose | 0.111 |
| BMI ↔ HbA1c | 0.083 |
| BMI ↔ glucose | 0.091 |
| hypertension ↔ glucose | 0.084 |

These are real but very weak — far weaker than the relationship real epidemiology would predict (age and BMI are well-established, substantial drivers of blood glucose in actual clinical literature). Contrast this with the diabetes model, where HbA1c and glucose were the *dominant* predictors of the diabetes label (SHAP importance 3.25 and 2.48, see `ml/diabetes/report.md`) — that relationship (glucose/HbA1c → diabetes diagnosis) is strong and real in this dataset. But the reverse relationship this model needed (age/BMI/lifestyle → glucose/HbA1c) apparently is not — most likely because whoever generated this dataset built the diabetes label as a realistic function of glucose/HbA1c, but sampled the glucose/HbA1c values themselves largely independently of the demographic columns, rather than modeling the full real-world causal chain (age/BMI → glucose → diabetes).

## Recommendation: don't ship this as a separate model

Given lifestyle/demographic factors alone carry essentially no signal for predicting elevated glucose in the data available, training a dedicated "High Blood Sugar" classifier isn't defensible right now — it would just be noise dressed up as a prediction. Two honest paths forward, in order of preference:

1. **Share the diabetes model.** This is actually the more coherent design anyway, and matches the original framing that these two conditions are closely related: use the diabetes model's predicted probability for the "High Blood Sugar" assessment type too, just interpreted against an earlier/lower threshold (e.g. flag "elevated risk" at a lower probability cutoff than the diabetes flag uses). One well-validated model (ROC-AUC 0.98 internally, ~0.76 externally) serving two related, differently-thresholded purposes, instead of two models where one doesn't actually work.
2. **Find a dataset that actually links demographics to glucose.** If a genuinely distinct "High Blood Sugar" model is wanted later, it needs a dataset where fasting glucose/HbA1c is the target and has a real, non-trivial relationship to age/BMI/lifestyle — which is not what's available in this folder today.

The trained `full`/`core` models here are kept as artifacts for transparency, but are **not recommended for use** given the above.

## Limitations

- The primary dataset's glucose distribution is itself case-enriched (median 140 mg/dL vs. a realistic ~90-95 mg/dL general-population median), which independently makes this dataset a poor fit for a general-population screening target, on top of the weak-correlation issue above.
- Only 50 real Nigerian data points were available to confirm the negative finding externally — small, but the internal 80,000-row result already shows the same near-random pattern, so this isn't a small-sample fluke.

## Artifacts

- `model/full_model.json`, `model/core_model.json` — trained but not recommended for use.
- `model/full_metrics.json`, `model/core_metrics.json`, `model/external_validation.json` — the results above.
