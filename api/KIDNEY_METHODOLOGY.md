# HealthCheck Kidney Health Risk — Methodology (v1)

**What this is:** a plain breakdown of how HealthCheck checks kidney (chronic kidney disease) risk. One assessment, no lab needed, shown as a Low / Moderate / High band with the reasons behind it.

**In one line:** kidney failure is rising fast in Nigeria and is mostly driven by lifestyle and diet. This check adds up the risk factors that Nigeria's own national kidney screening and kidney doctors point to, and turns them into an early warning to get a proper test.

---

## 1. Why this matters, and why we built it this way

- Kidney disease is a **silent killer**. Half to two thirds of the kidney can be damaged before a person feels anything, and in Nigeria over 95% of patients reach a kidney doctor only when it is already very late.
- It is **common and rising**: Nigeria's 2022 national screening found about **1 in 7 adults** already had reduced kidney function, and it now hits **young, working-age people (20 to 50)**, not just the elderly.
- Treatment is **out of reach for most**: dialysis runs to hundreds of thousands of naira a month, and a transplant runs into millions. So catching risk early and preventing it is the only realistic path for most families.
- There is **no single no-lab kidney score built and proven for Nigeria yet**. So, the honest way to build this is to use the risk factors that are actually proven to matter here, show a band (not a made-up percentage), and always say clearly that **only a blood test (eGFR) and a urine test (for protein) can confirm** how the kidneys are doing.

---

## 2. What the check looks at, and how much each counts

Each factor a person has adds points. Strongest first:

| Factor | Points | Why it is here |
|---|---|---|
| Diabetes / high blood sugar | 3 | A leading cause of kidney failure. National screening: about twice the risk. |
| High blood pressure | 3 | The other leading cause. Quietly damages the kidney's tiny filters. |
| Age 60+ (50s = 2, 40s = 1) | up to 3 | Risk climbs steeply with age (about 2% under 20, a third over 60). |
| Family history of kidney disease | 2 | A close relative with kidney disease or on dialysis. |
| Frequent painkillers | 2 | Regular ibuprofen, diclofenac, APC, or tramadol is hard on the kidneys. |
| Herbal mixtures (agbo / paraga) | 2 | A well-known cause of kidney damage in Nigeria; you cannot know what is inside. |
| Long-term infection | 2 | Hepatitis B or C, HIV, or repeated urinary infections can scar the kidneys. |
| Female sex | 1 | Women showed higher rates of kidney changes in the national screening. |
| Obesity (BMI 30+) | 1 | Adds strain over time. |
| Heavy salt / seasoning cubes | 1 | Pushes up blood pressure and load on the kidneys. |
| Low water intake (under 5 cups) | 1 | Too little water, especially in the heat, overworks the kidneys. |
| Smoking | 1 | Harms the blood vessels feeding the kidneys. |
| Past heart disease or stroke | 1 | Comes with the same blood-vessel damage. |

**The band:**

- If the person has **both diabetes and high blood pressure**, or scores **7 or more**, the band is **High**.
- **4 to 6 points** is **Moderate**.
- **0 to 3 points** is **Low**.

A young person is never assumed to be safe just for being young: enough lifestyle factors (painkillers, herbal mixtures, salt, low water) can reach Moderate or High on their own. That matches what Nigerian kidney doctors are seeing.

---

## 3. Where each answer comes from

Most answers are already in Health Info; a few are new questions:

- **Already collected:** age, sex, weight (BMI), high blood pressure, blood-sugar readings, heart disease, smoking, and salt intake (from the diet questions).
- **New questions:** family kidney disease, frequent painkillers, herbal mixtures (agbo / paraga), long-term infection (hepatitis / HIV / repeated urine infections), and cups of water a day.

If an answer is missing, it simply adds nothing, and the check still gives a usable band. More answers means a more accurate result.

---

## 4. Worked examples

**A — 34-year-old man.** Takes painkillers most days for body pain (2), drinks agbo regularly (2), eats heavy salt (1), drinks little water (2 cups, so 1). Total 6 → **Moderate**. He feels fine, but he is quietly stacking up kidney risk. The result tells him to cut the painkillers and agbo and get a test. This is exactly the young, silent case the doctors are worried about.

**B — 63-year-old woman with high blood pressure and diabetes.** Age 3, female 1, high blood pressure 3, diabetes 3. Both leading causes present → **High**, "please get your kidneys tested."

**C — 29-year-old woman, healthy weight, no medicines, drinks enough water, no family history.** Female 1 only → **Low**.

---

## 5. The Nigerian evidence behind it

Nigeria's **World Kidney Day 2022 national screening** (Nigerian Association of Nephrology; 4,313 adults across all six geopolitical zones, African Journal of Nephrology 2024) found:

- About **13.7%** of adults already had reduced kidney function, rising from under 2% in the young to about **34% over age 60**.
- The factors independently linked to kidney damage were **age** (risk rising each year), **high blood sugar** (about 2x), **high blood pressure** (about 1.4x), and **female sex** (about 1.8x).
- The leading risk factors named overall were **high blood pressure, diabetes, and obesity**.

Nigerian nephrologists also consistently flag **painkiller (NSAID) overuse**, **herbal concoctions**, **dehydration in hot regions**, and **untreated infections (hepatitis, HIV, urinary infections)** as major local drivers. Every one of these is in the check above.

---

## 6. Sources

- Raji YR, Okoye O, Ekrikpo U, et al. *Kidney disease and its risk factors among Nigerians: Report of the World Kidney Day 2022 National Screening Programme.* African Journal of Nephrology, 2024; 27(1):9-20.
- Bang H, et al. *SCREED (SCORED): a patient-based screening tool for chronic kidney disease.* Arch Intern Med, 2007 — the precedent for a no-lab, risk-factor kidney screen.
- Nigerian Association of Nephrology / African Association of Nephrology public advisories on rising CKD, painkiller and herbal-remedy harm, and late presentation.

---

## 7. Confidence and honest caveats (v1)

- **Grounded in real Nigerian data:** the factors and their order follow Nigeria's national screening and what kidney doctors report here.
- **The band rule is a clear clinical judgement, not one proven equation:** how the factors add into Low / Moderate / High is a transparent rule we wrote and can show, not a single validated formula. That is why we show a band, never a false percentage.
- **Only a test confirms it:** kidney disease is silent, so a Low band does not rule it out. A blood test (eGFR) and a urine test (for protein) are the only way to be sure, and everyone at Moderate or High is told to get one.
- **It works for the young too:** the check can flag a healthy-feeling young person on lifestyle factors alone, on purpose, because that is who the crisis is now hitting.
- **Always:** a HealthCheck result is a screening estimate, not a diagnosis, and the app says so.
