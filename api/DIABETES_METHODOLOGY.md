# HealthCheck Diabetes Risk — Methodology (v1)

**What this is:** a complete breakdown of how HealthCheck now assesses type 2 diabetes risk — one assessment, no blood test required, output as a Low / Moderate / High band with the tool's own five-level label alongside.

**In one line:** two tracks. If the patient **knows a blood-sugar number** (fasting/random glucose or HbA1c), we interpret that number **directly against clinical thresholds** — because a real reading beats any questionnaire. If they **don't**, we use **FINDRISC** (the exact 0–26 IDF form) to estimate their **10-year risk of developing type 2 diabetes** with no lab — which matters because most Nigerians don't know their blood sugar.

---

## 1. Why this design

Two facts shaped the choice:

1. **Most Nigerians can't give a blood-sugar reading.** A diabetes assessment that *requires* a fasting glucose only serves the minority who've been tested. FINDRISC was built precisely as a **no-blood, questionnaire-only** screen, so it reaches everyone.
2. **We use a tool that is actually validated in African / Nigerian populations, not a black box.** FINDRISC is the International Diabetes Federation's recommended screening tool for resource-limited settings. In an African validation (Omech et al., Botswana) it scored **AUC 0.86, 77% sensitivity, 89% specificity** for detecting diabetes, and it has been used in Nigerian studies (Busari et al., Ondo State doctors; Ambakederemo et al., Southern Nigeria).

A native Nigerian instrument (the proposed *NGDRAS*) is still in development and has **no published scoring yet**, so it can't be implemented faithfully. FINDRISC is the best **validated + reproducible** option today. As with our stroke and hypertension work, we present a **band, not a false-precision percentage**, because absolute-risk calibration is the weak point of ported Western tools in African populations — what holds up is the *ranking*.

---

## 1b. Track A — the patient knows a number (this leads when present)

A known blood-sugar result is a direct measurement, so it **overrides** the future-risk questionnaire. We read it against the standard ADA / WHO thresholds and take **whichever value is most abnormal** (so a normal fasting glucose can never mask a high HbA1c):

| Test | Normal | Pre-diabetes | Diabetes range |
|---|---|---|---|
| **Fasting glucose** | <100 mg/dL | 100–125 | ≥126 |
| **Random glucose** (after eating) | <140 mg/dL | 140–199 | ≥200 |
| **HbA1c** | <5.7% | 5.7–6.4% | ≥6.5% |

- **Diabetes range → HIGH band**, headlined *"in the diabetes range — please see a doctor to confirm with a repeat test."* Never softened into "moderate future risk," and never phrased as a diagnosis (a diagnosis needs a doctor + confirmation).
- **Pre-diabetes → MODERATE band**, framed as a reversible warning zone.
- **Normal → the reading is shown as reassuring context, and FINDRISC (Track B) leads** — because one normal reading does not erase future risk.

**Fasting vs random matters and we ask.** Nigerians most often get a random pharmacy finger-prick, which has different thresholds than a fasting lab test. The app asks "was this fasting?" If the user leaves it unanswered, we default to the **fasting (lower, more sensitive) cut-off**, so an unlabelled reading errs toward getting them checked rather than missing a real case. **HbA1c** is offered because it is the most reliable single number and needs no fasting — it sidesteps the ambiguity entirely.

---

## 2. Track B — the score: FINDRISC (0–26)

The user answers eight simple questions. Each is worth weighted points:

| Question | Answer → points |
|---|---|
| **Age** | <45 → 0 · 45–54 → 2 · 55–64 → 3 · ≥65 → 4 |
| **Body mass index** | <25 → 0 · 25–29.9 → 1 · ≥30 → 3 |
| **Waist circumference** (measured at the belly) | **Men:** <94 cm → 0 · 94–102 → 3 · >102 → 4  ·  **Women:** <80 cm → 0 · 80–88 → 3 · >88 → 4 |
| **Physically active ≥30 min most days?** | Yes → 0 · No → 2 |
| **Eat fruits/vegetables every day?** | Yes → 0 · No → 1 |
| **Ever taken blood-pressure medication regularly?** | No → 0 · Yes → 2 |
| **Ever found to have high blood glucose?** | No → 0 · Yes → 5 |
| **Family history of diabetes** | None → 0 · grandparent/aunt/uncle/cousin (2nd-degree) → 3 · parent/sibling/own child (1st-degree) → 5 |

**Total: 0–26.** The tool's own risk bands (the 10-year risk of developing type 2 diabetes):

| Score | FINDRISC category | HealthCheck band |
|---|---|---|
| <7 | Low | **LOW** |
| 7–11 | Slightly elevated | **MODERATE** |
| 12–14 | Moderate | **MODERATE** |
| 15–20 | High | **HIGH** |
| >20 | Very high | **HIGH** |

The result shows the band, the finer FINDRISC label, and a **breakdown** of exactly which factors added points — nothing is a black box.

---

## 3. How each answer is sourced in the app

Most inputs come straight from Health Info; two are new, one is proxied:

- **Age, BMI, sex** — already collected (date of birth → age; height + weight → BMI).
- **Waist circumference** — a new optional field ("measure around your belly button, midway between lowest rib and hip").
- **Physical activity** — proxied from "how many days a week do you exercise?": **5 or more days** counts as active (0 pts); fewer counts as inactive (2 pts).
- **Fruit/veg every day** — a new Yes/No question.
- **Blood-pressure medication** — the existing "are you on BP medication?" question.
- **Ever high blood glucose** — a new Yes/No question; it is also set to *yes* automatically if the user entered a fasting glucose at or above the pre-diabetes threshold (100 mg/dL).
- **Family history** — the app's existing "family history of diabetes?" Yes/No. A *yes* is scored as **first-degree (5 points)**, the more common and higher-weight interpretation. (Family history is the single strongest predictor in Nigerians — see §5 — so we deliberately do not under-weight it.)

**Graceful fallback:** if an answer is missing, that item simply contributes 0 and the app records how many of the eight were answered. The score still computes and gives a usable band; more answers means more confidence.

---

## 4. Worked examples

**A — 58-year-old man, BMI 31, waist 104 cm, exercises 2 days/week, doesn't eat fruit/veg daily, no BP meds, no prior high sugar, a sibling has diabetes.**
Age 3 + BMI 3 + waist 4 + inactive 2 + diet 1 + BP 0 + glucose 0 + family 5 = **18 → High**.

**B — 32-year-old woman, BMI 23, waist 74 cm, active 5 days/week, eats fruit/veg daily, no BP meds, no prior high sugar, no family history.**
0 across the board = **0 → Low**.

**C — 47-year-old, BMI 27, waist 96 cm (male), active, eats fruit/veg daily, no BP meds, had a high sugar reading once, a parent has diabetes.**
Age 2 + BMI 1 + waist 3 + glucose 5 + family 5 = **16 → High** — driven almost entirely by the prior reading and family history, exactly the signals FINDRISC weights hardest.

---

## 5. Why these factors — the Nigerian evidence

A Nigerian study of 192 doctors in Ondo State (Busari et al., 2021) applied this exact form and found the strongest independent predictors of increased 10-year diabetes risk were:

- **Family history of diabetes** — adjusted odds ratio ≈ **9.9**
- **BMI ≥ 25** — AOR ≈ **11.4**
- **Age ≥ 45** — AOR ≈ **9.1**
- **Abdominal (waist) obesity** — AOR ≈ **6.7**
- **Infrequent fruit/vegetable intake** — AOR ≈ **3.1**

Every one of these is a FINDRISC item, so the score's weights line up with what actually predicts diabetes in Nigerians. Uloko et al.'s national systematic review likewise names obesity and family history as established Nigerian risk factors.

---

## 6. Sources

- **FINDRISC form & weights:** Lindström J, Tuomilehto J. *The Diabetes Risk Score.* Diabetes Care 2003 (the original 0–26 instrument); International Diabetes Federation, *Global Guideline for Type 2 Diabetes* (recommends FINDRISC for resource-limited settings).
- **African validation:** Omech B, et al. *Validity of the Finnish Diabetes Risk Score for detecting undiagnosed type 2 diabetes among general medical outpatients in Botswana.* J Diabetes Res 2016 — AUC 0.86, 77% sensitivity, 89% specificity.
- **Nigerian use & effect sizes:** Busari OA, et al. *Type 2 diabetes mellitus risk assessment among doctors in Ondo State.* Malawi Med J 2021;33(2):114–120. Ambakederemo TE, Chikezie EU. *Assessment of some traditional cardiovascular risk factors in medical doctors in Southern Nigeria.* Vasc Health Risk Manag 2018.
- **Nigerian prevalence context:** Uloko AE, et al. *Prevalence and Risk Factors for Diabetes Mellitus in Nigeria: A Systematic Review and Meta-Analysis.* Diabetes Ther 2018.

---

## 7. Confidence & honest caveats (v1)

- **Validated tool, faithfully implemented:** the FINDRISC weights and bands here are the published 0–26 instrument, transcribed exactly. The African validation (AUC 0.86) is real and cited.
- **It predicts *future* diabetes, not current diabetes:** FINDRISC estimates 10-year *risk of developing* type 2 diabetes. A high band is a reason to get a proper blood test, not a diagnosis.
- **Bands, not percentages, on purpose:** FINDRISC's original percentage bands were derived in a Finnish cohort; absolute risk is miscalibrated for Africans, so we surface Low / Moderate / High (the ranking that holds up), not a Finnish percentage.
- **Waist-based scores can miss lean diabetes:** a meaningful share of diabetes in Africans occurs in people who are *not* centrally obese (β-cell-failure / lean type 2). FINDRISC will under-flag them. Family history and a prior high reading partly compensate, but this is a known limitation — a normal band never rules diabetes out.
- **A couple of inputs are proxied/assumed:** physical activity is inferred from weekly exercise days, and a positive family history is scored as first-degree. Both are reasonable, documented choices, not measurements.
- **Always:** a HealthCheck result is a screening estimate, not a diagnosis, and the app says so.
