/**
 * Direct interpretation of a KNOWN blood-sugar result against the standard
 * clinical (ADA / WHO) thresholds. This is used when the patient already has a
 * number — a fasting or random glucose, or an HbA1c — in which case the number
 * itself is a far stronger, more direct signal than the FINDRISC future-risk
 * questionnaire, and must lead the assessment rather than being buried in it.
 *
 * IMPORTANT: a single reading is a SCREENING signal, not a diagnosis. Diabetes
 * is confirmed by a doctor with a repeat test (or one test plus symptoms). The
 * copy here always says "in the diabetes range, please confirm with a doctor",
 * never "you have diabetes".
 */

export type GlucoseTiming = 'fasting' | 'random';

export type ReadingCategory = 'normal' | 'prediabetes' | 'diabetes_range';

export type ReadingInterpretation = {
  category: ReadingCategory;
  /** Which measurement drove the category. */
  source: 'fasting_glucose' | 'random_glucose' | 'hba1c';
  /** Short factor name for the breakdown. */
  name: string;
  /** Human detail, e.g. "180 mg/dL fasting — in the diabetes range". */
  detail: string;
  /** Actionable tip shown to the user. */
  tip: string;
};

export type KnownReadingInput = {
  /** Blood glucose in mg/dL (already unit-converted upstream). */
  glucoseMgdl: number | null;
  /** Whether that glucose was a fasting test. Null => assume fasting (the more
   * sensitive interpretation), so we never under-refer an unlabelled reading. */
  glucoseFasting: boolean | null;
  /** HbA1c as a percentage (e.g. 6.8). */
  hba1cPercent: number | null;
};

const CATEGORY_RANK: Record<ReadingCategory, number> = {
  normal: 0,
  prediabetes: 1,
  diabetes_range: 2,
};

/** Fasting: <100 normal, 100–125 prediabetes, ≥126 diabetes range. */
function interpretFasting(mgdl: number): ReadingInterpretation {
  if (mgdl >= 126) {
    return {
      category: 'diabetes_range',
      source: 'fasting_glucose',
      name: 'Your blood sugar reading',
      detail: `${round(mgdl)} mg/dL fasting, which is in the diabetes range (126 and above)`,
      tip: 'This is at or above the diabetes level. One reading does not confirm it on its own, so please see a doctor for a repeat test. No need to panic, but do not ignore it either.',
    };
  }
  if (mgdl >= 100) {
    return {
      category: 'prediabetes',
      source: 'fasting_glucose',
      name: 'Your blood sugar reading',
      detail: `${round(mgdl)} mg/dL fasting, which is in the pre-diabetes range (100 to 125)`,
      tip: 'This is a warning sign, not diabetes yet. Eating better, losing a little weight, and staying active can bring it back down. A doctor can check you again.',
    };
  }
  return {
    category: 'normal',
    source: 'fasting_glucose',
    name: 'Your blood sugar reading',
    detail: `${round(mgdl)} mg/dL fasting, which is in the normal range (under 100)`,
    tip: 'A normal reading is good news, but it does not remove your future risk. Have a look at the risk factors below.',
  };
}

/** Random/casual: <140 normal, 140–199 elevated, ≥200 diabetes range. */
function interpretRandom(mgdl: number): ReadingInterpretation {
  if (mgdl >= 200) {
    return {
      category: 'diabetes_range',
      source: 'random_glucose',
      name: 'Your blood sugar reading',
      detail: `${round(mgdl)} mg/dL after eating, which is in the diabetes range (200 and above)`,
      tip: 'A reading this high after food needs a proper fasting or HbA1c test with a doctor to be sure. Please go and get checked.',
    };
  }
  if (mgdl >= 140) {
    return {
      category: 'prediabetes',
      source: 'random_glucose',
      name: 'Your blood sugar reading',
      detail: `${round(mgdl)} mg/dL after eating, which is higher than expected`,
      tip: 'This is above the normal range for after eating. A fasting test would tell you more, so it is worth checking with a doctor.',
    };
  }
  return {
    category: 'normal',
    source: 'random_glucose',
    name: 'Your blood sugar reading',
    detail: `${round(mgdl)} mg/dL after eating, which is within the normal range`,
    tip: 'This looks fine for a reading after food, but it does not remove your future risk. Have a look at the risk factors below.',
  };
}

/** HbA1c: <5.7 normal, 5.7–6.4 prediabetes, ≥6.5 diabetes range. */
function interpretHba1c(pct: number): ReadingInterpretation {
  if (pct >= 6.5) {
    return {
      category: 'diabetes_range',
      source: 'hba1c',
      name: 'Your HbA1c result',
      detail: `HbA1c ${pct.toFixed(1)}%, which is in the diabetes range (6.5% and above)`,
      tip: 'HbA1c shows your average blood sugar over the last 3 months or so. At this level, please see a doctor to confirm and start a plan.',
    };
  }
  if (pct >= 5.7) {
    return {
      category: 'prediabetes',
      source: 'hba1c',
      name: 'Your HbA1c result',
      detail: `HbA1c ${pct.toFixed(1)}%, which is in the pre-diabetes range (5.7% to 6.4%)`,
      tip: 'This is a warning sign, not diabetes yet. Small changes now can bring it down. A doctor can check you again.',
    };
  }
  return {
    category: 'normal',
    source: 'hba1c',
    name: 'Your HbA1c result',
    detail: `HbA1c ${pct.toFixed(1)}%, which is in the normal range (under 5.7%)`,
    tip: 'A normal HbA1c is good news, but it does not remove your future risk. Have a look at the risk factors below.',
  };
}

function round(n: number): number {
  return Math.round(n);
}

/**
 * Returns the interpretation of whichever known reading is MOST abnormal
 * (worst-case wins, so a normal fasting glucose can never mask a high HbA1c),
 * or null when the user has no numbers at all.
 */
export function interpretKnownReadings(input: KnownReadingInput): ReadingInterpretation | null {
  const results: ReadingInterpretation[] = [];

  if (input.glucoseMgdl != null) {
    // Null timing => assume fasting (the lower, more sensitive cut-off) so an
    // unlabelled reading errs toward getting the person checked, not missed.
    const fasting = input.glucoseFasting !== false;
    results.push(fasting ? interpretFasting(input.glucoseMgdl) : interpretRandom(input.glucoseMgdl));
  }
  if (input.hba1cPercent != null) {
    results.push(interpretHba1c(input.hba1cPercent));
  }

  if (results.length === 0) return null;

  // Most abnormal wins; among equals, keep the first (glucose before HbA1c).
  return results.reduce((worst, r) =>
    CATEGORY_RANK[r.category] > CATEGORY_RANK[worst.category] ? r : worst,
  );
}

/** Maps a reading category to the app's Low/Moderate/High band + ring score. */
export function bandForReading(category: ReadingCategory): {
  band: 'LOW' | 'MODERATE' | 'HIGH';
  score: number;
} {
  if (category === 'diabetes_range') return { band: 'HIGH', score: 90 };
  if (category === 'prediabetes') return { band: 'MODERATE', score: 60 };
  return { band: 'LOW', score: 20 };
}
