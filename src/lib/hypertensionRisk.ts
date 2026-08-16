import { computeNidrs, type DietFrequencies } from './nidrs';

/**
 * Single hypertension assessment. Combines the validated Nigerian Diet Risk
 * Score (the dietary layer) with the recognised non-dietary risk factors it
 * was adjusted for (age, BMI, family history, etc.), and folds in whether the
 * person ALREADY has a high or treated blood pressure.
 *
 * Output is a Low / Moderate / High BAND, never a fabricated percentage. The
 * NiDRS part is a validated equation; the rule that merges it with the other
 * factors is a transparent clinical overlay, clearly labelled as such — see
 * api/HYPERTENSION_METHODOLOGY.md.
 */

export type HypertensionInput = {
  age: number | null;
  bmi: number | null;
  smoking: boolean | null;
  exerciseDaysPerWeek: number | null;
  sleepHours: number | null;
  familyHypertension: boolean | null;
  /** "Have you been told you have high blood pressure?" */
  toldHypertension: boolean | null;
  systolicBp: number | null;
  onBpMedication: boolean | null;
  diet: DietFrequencies | null;
};

export type RiskFactor = {
  key: string;
  name: string;
  detail: string;
  category: 'increase' | 'protective';
  impact: number;
  icon: string;
  tip: string | null;
};

export type HypertensionResult = {
  band: 'LOW' | 'MODERATE' | 'HIGH';
  /** A 0-100 value representing the band, for the app's score ring. */
  score: number;
  nidrsScore: number;
  nidrsCategory: 'low' | 'high';
  /** True when the person already has/treats high BP, which dominates the band. */
  alreadyElevated: boolean;
  factors: RiskFactor[];
};

const BAND_SCORE = { LOW: 20, MODERATE: 55, HIGH: 85 } as const;

const FACTOR_ICON: Record<string, string> = {
  diet: 'food-fork-drink',
  bp: 'heart-pulse',
  age: 'calendar-account-outline',
  bmi: 'human',
  family: 'account-multiple-outline',
  smoking: 'smoking',
  activity: 'run',
  sleep: 'sleep',
};

export function computeHypertensionRisk(input: HypertensionInput): HypertensionResult {
  const nidrs = computeNidrs(input.diet);
  const factors: RiskFactor[] = [];

  // The strongest signal: the person already has or treats high blood pressure.
  const alreadyElevated =
    input.toldHypertension === true ||
    input.onBpMedication === true ||
    (input.systolicBp != null && input.systolicBp >= 140);

  // Diet factor (validated core).
  factors.push({
    key: 'diet',
    name: 'Diet',
    detail:
      nidrs.category === 'high'
        ? `High dietary risk (score ${nidrs.score}/30)`
        : `Lower dietary risk (score ${nidrs.score}/30)`,
    category: nidrs.category === 'high' ? 'increase' : 'protective',
    impact: nidrs.score,
    icon: FACTOR_ICON.diet,
    tip:
      nidrs.category === 'high'
        ? 'Cut back on the salty, fried, and processed foods driving your diet score.'
        : null,
  });

  // Count the recognised non-dietary risk factors (each also flagged for the
  // breakdown). Alcohol is deliberately NOT counted here — it already sits
  // inside the NiDRS diet score, so counting it again would double-weight it.
  let nonDietary = 0;
  const addFactor = (key: string, present: boolean, name: string, detail: string, tip: string | null) => {
    if (!present) return;
    nonDietary += 1;
    factors.push({ key, name, detail, category: 'increase', impact: 1, icon: FACTOR_ICON[key] ?? 'alert', tip });
  };

  addFactor('age', input.age != null && input.age >= 45, 'Age', 'Age 45 or older', null);
  addFactor('bmi', input.bmi != null && input.bmi >= 30, 'Weight', 'BMI in the obese range', 'Losing even a little weight lowers blood pressure.');
  addFactor('family', input.familyHypertension === true, 'Family history', 'A parent or sibling has high blood pressure', null);
  addFactor('smoking', input.smoking === true, 'Smoking', 'Current smoker', 'Quitting improves blood pressure within weeks.');
  addFactor(
    'activity',
    input.exerciseDaysPerWeek != null && input.exerciseDaysPerWeek < 3,
    'Low activity',
    'Exercises fewer than 3 days a week',
    'Aim for 150 minutes of moderate activity a week.',
  );
  addFactor('sleep', input.sleepHours != null && input.sleepHours < 6, 'Short sleep', 'Under 6 hours a night', 'Aim for 7-9 hours; sleep is when blood pressure rests.');

  // Overall band. Already-elevated BP dominates. Otherwise combine the
  // validated diet category with how many non-dietary factors pile on.
  let band: 'LOW' | 'MODERATE' | 'HIGH';
  if (alreadyElevated) {
    band = 'HIGH';
    factors.unshift({
      key: 'bp',
      name: 'Blood pressure',
      detail: 'Already measured high or on treatment',
      category: 'increase',
      impact: 5,
      icon: FACTOR_ICON.bp,
      tip: 'Keep monitoring your blood pressure and follow your doctor’s plan.',
    });
  } else if (nidrs.category === 'high') {
    band = nonDietary >= 2 ? 'HIGH' : 'MODERATE';
  } else {
    band = nonDietary >= 3 ? 'MODERATE' : 'LOW';
  }

  return {
    band,
    score: BAND_SCORE[band],
    nidrsScore: nidrs.score,
    nidrsCategory: nidrs.category,
    alreadyElevated,
    factors,
  };
}
