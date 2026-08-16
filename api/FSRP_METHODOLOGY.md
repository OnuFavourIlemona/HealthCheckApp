# HealthCheck Stroke Risk — Methodology (v1)

**What this document is:** a complete, plain-language breakdown of how HealthCheck now calculates a person's stroke risk, so you can review every step, every number, and every assumption.

**One-line summary:** we replaced the machine-learning stroke model with the **Revised Framingham Stroke Risk Profile (FSRP)** — a published, peer-reviewed clinical equation that doctors use. It adds up points for a person's risk factors and converts the total into a **10-year probability of stroke (%)**.

---

## 1. Why an equation instead of an ML model

| | ML model (old) | FSRP equation (new) |
|---|---|---|
| Where the numbers come from | Learned from a generic Kaggle dataset | Peer-reviewed clinical study, fixed coefficients |
| Transparency | Hard to explain a score | Every point is visible and traceable |
| Runs offline / instantly | No — needs the server awake | Yes — runs on the phone |
| Defensible to a doctor | Difficult | Yes — it's what clinicians use |

The FSRP is deterministic: the same inputs always give the same score, and you can hand-check any result with the tables below.

---

## 2. The inputs we use

| Factor | Where it comes from in the app |
|---|---|
| Age | Calculated from date of birth |
| Sex | Gender field |
| Systolic blood pressure | "Do you know your latest blood pressure?" (systolic value) |
| On blood pressure medication? | New Yes/No question |
| Diabetes | Derived: fasting glucose ≥ 126 mg/dL counts as diabetic (diagnostic threshold). Otherwise "no". |
| Smoking | Existing smoking question |
| Heart disease (cardiovascular disease) | Existing "heart attack or heart disease" question |
| Atrial fibrillation (AFib) | New Yes/No question |

**Not used:** Left-ventricular hypertrophy (LVH) is part of the original FSRP but requires an ECG the app can't collect, so we omit that term. This is a standard "reduced model" adaptation and it makes the score slightly conservative (it can't add LVH points), never falsely high.

---

## 3. The point tables

Each answer earns points. **Add them all up**, then look the total up in the conversion table (Section 4).

### 3a. Age (points)

| Age | Men | Women |
|---|---|---|
| ≤ 56 | 0 | 0 |
| 57–59 | 1 | 1 |
| 60–62 | 2 | 2 |
| 63–65 (men) / 63–64 (women) | 3 | 3 |
| 66–68 (men) / 65–67 (women) | 4 | 4 |
| 69–72 (men) / 68–70 (women) | 5 | 5 |
| 73–75 (men) / 71–73 (women) | 6 | 6 |
| 76–78 (men) / 74–76 (women) | 7 | 7 |
| 79–81 (men) / 77–78 (women) | 8 | 8 |
| 82–84 (men) / 79–81 (women) | 9 | 9 |
| ≥ 85 (men) / 82–84 (women) | 10 | 10 |

### 3b. Systolic blood pressure (points) — **use the correct column for whether they take BP medication**

**Men — not on medication:** 97–105 → 0, 106–115 → 1, 116–125 → 2, 126–135 → 3, 136–145 → 4, 146–155 → 5, 156–165 → 6, 166–175 → 7, 176–185 → 8, 186–195 → 9, 196+ → 10

**Men — on medication:** 97–105 → 0, 106–112 → 1, 113–117 → 2, 118–123 → 3, 124–129 → 4, 130–135 → 5, 136–142 → 6, 143–150 → 7, 151–161 → 8, 162–176 → 9, 177+ → 10

**Women — not on medication:** 95–106 → 0, 107–118 → 1, 119–130 → 2, 131–143 → 3, 144–155 → 4, 156–167 → 5, 168–180 → 6, 181–192 → 7, 193–204 → 8, 205–216 → 9, 217+ → 10

**Women — on medication:** 95–106 → 0, 107–113 → 1, 114–119 → 2, 120–125 → 3, 126–131 → 4, 132–139 → 5, 140–148 → 6, 149–160 → 7, 161–204 → 8, 205–216 → 9, 217+ → 10

### 3c. Yes/No factors (points, same for both sexes)

| Factor | Yes | No |
|---|---|---|
| Diabetes | +2 | 0 |
| Smoking | +3 | 0 |
| Heart disease (CVD) | +4 | 0 |
| Atrial fibrillation | +5 | 0 |

---

## 4. Converting total points → 10-year stroke risk (%)

**Men:**

| Points | 0 | 5 | 10 | 15 | 20 | 25 | 30 |
|---|---|---|---|---|---|---|---|
| Risk % | 2 | 5 | 10 | 20 | 37 | 63 | 88 |

(Full men's scale, points 0→30: 2, 3, 3, 4, 4, 5, 5, 6, 7, 8, **10**, 11, 13, 15, 17, **20**, 22, 26, 29, 33, **37**, 42, 47, 52, 57, **63**, 68, 74, 79, 84, **88**)

**Women:**

| Points | 0 | 5 | 10 | 15 | 20 | 25 | 27 |
|---|---|---|---|---|---|---|---|
| Risk % | 1 | 2 | 6 | 16 | 37 | 71 | 84 |

(Full women's scale, points 0→27: 1, 1, 1, 2, 2, 2, 3, 4, 4, 5, **6**, 8, 9, 11, 13, **16**, 19, 23, 27, 32, **37**, 43, 50, 57, 64, **71**, 78, 84)

### Risk bands the app shows
- **Low:** under 10%
- **Moderate:** 10% – under 20%
- **High:** 20% and above

---

## 5. Worked examples (you can hand-check these)

**Example A — 62-year-old man, BP 150 (no meds), non-diabetic, smoker, no heart disease, no AFib:**
- Age 62 → 2
- BP 150 untreated → 5
- Smoker → 3
- **Total = 10 points → 10% → Moderate**

**Example B — 75-year-old man, BP 180 (no meds), diabetic, smoker, heart disease, AFib:**
- Age 75 → 6, BP 180 → 8, diabetes → 2, smoker → 3, CVD → 4, AFib → 5
- **Total = 28 points → 79% → High**

**Example C — 45-year-old man, BP 118, everything else no:**
- Age 45 → 0, BP 118 → 1
- **Total = 1 point → 3% → Low**

---

## 6. What happens when a person doesn't provide something (graceful fallback)

The whole calculation still runs; we substitute the population-typical value so the result stays close to accurate, and the app marks it as an estimate.

| Missing input | What we assume | Why |
|---|---|---|
| Sex | Average the men's and women's results | Neutral, no guess |
| Blood pressure | 130 mmHg, untreated | Near the adult population average |
| Diabetes | No | Most people are not diabetic |
| Smoking | No | Most are non-smokers |
| Heart disease | No | Uncommon in the general population |
| Atrial fibrillation | No | AFib prevalence is low |

Age is always available (from date of birth), so the backbone of the score is always real.

---

## 7. Sources

- Framingham Heart Study — Stroke risk function: https://www.framinghamheartstudy.org/fhs-risk-functions/stroke/
- Wolf PA, D'Agostino RB, Belanger AJ, Kannel WB. *Probability of stroke: a risk profile from the Framingham Study.* Stroke, 1991.
- D'Agostino RB, et al. *Stroke risk profile: adjustment for antihypertensive medication.* / Revised FSRP, Circulation, 2017: https://www.ahajournals.org/doi/10.1161/circulationaha.115.021275
- Revised FSRP supplementary point tables (Frontiers, open access).

---

## 8. Confidence and the one thing to confirm before real-user launch (v1 caveat)

- **Verified:** the score → risk% conversion tables (Section 4) match the official Framingham anchor values exactly.
- **Reconstructed, to double-check:** the per-factor point values (Section 3) come from the open-access Revised FSRP supplementary tables plus a second source. They are internally consistent, but the source PDF had some column-layout ambiguity — the **women's blood-pressure bands** are the least certain cell. Before this drives scores for real patients, each number in Section 3 should be confirmed against the primary D'Agostino (Circulation 2017) paper.
- **Always true:** every HealthCheck score is a **screening estimate, not a diagnosis**, and the app says so.
