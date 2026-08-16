# HealthCheck Hypertension Risk — Methodology (v1)

**What this is:** a complete breakdown of how HealthCheck now assesses hypertension risk — one assessment, dietary-led, tuned for Nigerian users, output as a Low / Moderate / High band.

**In one line:** the validated **Nigerian Diet Risk Score (NiDRS)** does the heavy lifting (it's the accurate, local, food-based core), and a transparent overlay folds in the recognised non-dietary risk factors to give a single overall band.

---

## 1. Why this design

Research is clear on two things:

1. **Western risk equations (Framingham, FINDRISC) are miscalibrated for African populations.** They *rank* people acceptably (AUC 0.75–0.92) but the absolute % risk they output is wrong for Africans — the RODAM study and multiple validations say recalibration is needed before use. So we do **not** show a false-precision percentage.
2. **A Nigeria-specific tool exists.** The NiDRS was derived and validated *in Nigeria, on Nigerian diets* (Rivers State University Teaching Hospital), with internal AUC **0.92**. For our users, a local tool beats a ported Western one.

So the honest, most-accurate design for a phone app is: **use the validated Nigerian diet score, present risk as a band, and be transparent about what's validated vs. what's clinical overlay.**

---

## 2. The core: Nigerian Diet Risk Score (NiDRS)

The user answers, for 11 food groups, roughly how often they eat them. Each food scores its points **only if** intake crosses that food's threshold; otherwise 0.

| Food group | Scores when eaten… | Points |
|---|---|---|
| Fried foods (akara, puff-puff, chips, fried fish/chicken) | 3–5×/week or more | 4 |
| Eggs | 1–2×/week or more | 3 |
| Red meat (beef, goat, pork, bush meat) | 3–5×/week or more | 3 |
| Processed meat (suya, kilishi, sausages, gala, corned beef) | 1–2×/week or more | 3 |
| Desserts & sweets (ice cream, biscuits, cakes, chocolate) | 1–2×/week or more | 3 |
| Soft & sweet drinks (Coke, Fanta, Malt, sweet zobo/kunu, energy drinks) | 3–5×/week or more | 3 |
| Alcohol | 1–2×/week or more | 3 |
| Salt & seasonings (salt, Maggi/Knorr cubes, sauces) | Daily or more | 3 |
| Fast foods (mama put, shawarma, jollof, small chops, burgers) | 3–5×/week or more | 2 |
| Fats & oils (palm/vegetable oil, butter, margarine, mayonnaise) | Daily or more | 2 |
| Soups & stews (egusi, banga, efo-riro, ogbono, oily stews) | Daily or more | 1 |

**Total: 0–30. Cut-off: score above 11.3 = high dietary risk.**

Reported performance (internal validation): AUC 0.92, sensitivity 85%, specificity 94%. Crucially, the NiDRS weights were **already adjusted for age, BMI, physical activity and sex** — so it is specifically the *dietary* layer, cleanly separable from those factors.

---

## 3. The overlay: non-dietary risk factors

Because NiDRS was adjusted for them, those factors are independent drivers it doesn't include. To be most accurate, one assessment must fold them back in. Each recognised factor the person has is counted (and shown in the breakdown):

- **Age 45 or older**
- **Obesity** (BMI ≥ 30)
- **Family history** — a parent or sibling with high blood pressure
- **Current smoking**
- **Low physical activity** (fewer than 3 exercise days a week)
- **Short sleep** (under 6 hours a night)

*(Alcohol is deliberately **not** counted here — it already sits inside the NiDRS diet score, so counting it twice would over-weight it.)*

**The strongest signal of all:** if the person **already has** a high blood-pressure reading (systolic ≥ 140), is **on BP medication**, or has been **told they have high blood pressure**, that dominates — they may already be hypertensive, so the band is **High** regardless of diet.

---

## 4. How the single band is decided

```
IF already has / treats high blood pressure  → HIGH
ELSE IF diet is high-risk (NiDRS > 11.3):
        2 or more non-dietary factors         → HIGH
        0–1 non-dietary factors               → MODERATE
ELSE (diet is lower-risk):
        3 or more non-dietary factors         → MODERATE
        0–2 non-dietary factors               → LOW
```

The result is shown as the band plus a **breakdown** of exactly what contributed (the diet score and each risk factor), so nothing is a black box. **No percentage is shown** — the number would be false precision.

---

## 5. Worked examples

**A — 52-year-old, eats fried food daily, red meat + salt daily, soft drinks 3–5×/wk, processed meat weekly; BMI 32; parent has hypertension.**
- Diet: 4+3+3+3+3 = 16 → high (>11.3).
- Non-dietary: age (1) + obesity (1) + family history (1) = 3.
- Diet high + ≥2 factors → **HIGH**.

**B — 30-year-old, mostly rarely/weekly on the unhealthy foods; BMI 24; no family history; active.**
- Diet: ~0–4 → low.
- Non-dietary: 0.
- Diet low + 0–2 factors → **LOW**.

**C — 40-year-old already told they have high blood pressure.**
- Already elevated → **HIGH** (regardless of the rest).

---

## 6. Sources

- Batubo NP, Auma CI, Moore JB, Zulyniak MA. *Evaluating modifiable hypertension risk in Nigerian adults — the Nigerian diet risk score.* Tropical Medicine & International Health, 2025. (PMC11965004; full scoring in the author's University of Leeds thesis, White Rose eTheses 35192.)
- RODAM study — cardiovascular & diabetes risk algorithms in sub-Saharan Africans (miscalibration of Western tools).
- WHO / AHA guidance on hypertension thresholds and modifiable risk factors.

---

## 7. Confidence & honest caveats (v1)

- **Validated:** the NiDRS itself — its food weights, cut-off, and internal performance (AUC 0.92) are from the peer-reviewed study, transcribed exactly from the source Table 5.5.
- **Not yet validated externally:** the NiDRS was derived on a single-hospital sample (n = 151) and has **not been externally validated** in other Nigerian populations — the authors flag this. Treat it as the best *available* local tool, not a settled gold standard.
- **Clinical overlay, not a proven formula:** the rule that merges NiDRS with the non-dietary factors into one band (Section 4) is transparent clinical reasoning that *we* designed. It is **not** a validated equation, and it is labelled as a screening estimate — never dressed up as a precise, proven number.
- **Bands, not percentages, on purpose:** because absolute-risk calibration is the weak point for African populations, we show Low / Moderate / High, which rides on the part that holds up (ranking), not the part that doesn't (exact %).
- **Always:** a HealthCheck result is a screening estimate, not a diagnosis, and the app says so.
