/**
 * Kidney health risk (chronic kidney disease). Kidney failure is rising fast in
 * Nigeria, and most of what drives it is lifestyle and diet: high blood
 * pressure, diabetes, heavy painkiller use, herbal mixtures (agbo / paraga),
 * too much salt, and not enough water.
 *
 * There is no single no-lab kidney equation validated in Nigeria. So this check
 * is built the honest way: it uses the same risk factors that validated no-lab
 * kidney screening questionnaires rely on (for example SCORED, Bang et al.),
 * plus the causes kidney doctors see most in Nigeria. It reports a Low /
 * Moderate / High band and always says the same thing a doctor would: only a
 * blood and urine test can confirm how your kidneys are doing. The rule that
 * turns the factors into a band is a clear, written-down clinical judgement, not
 * a single proven formula. See api/KIDNEY_METHODOLOGY.md.
 */

export type KidneyInput = {
  age: number | null;
  /** Nigeria's national screening found women had higher rates of kidney changes. */
  sex: 'male' | 'female' | null;
  bmi: number | null;
  smoking: boolean | null;
  /** Told by a health worker they have high blood pressure, on BP medicine, or a high reading. */
  hypertension: boolean | null;
  onBpMedication: boolean | null;
  systolicBp: number | null;
  /** Any sign of diabetes: told diabetic, a high sugar reading, or a past high reading. */
  diabetes: boolean | null;
  /** Ever had a heart attack, stroke, or heart disease. */
  heartDisease: boolean | null;
  /** A close relative with kidney disease or on dialysis. */
  familyKidneyDisease: boolean | null;
  /** Takes pain medicine (ibuprofen, diclofenac, APC, tramadol) several times a week. */
  frequentPainkillers: boolean | null;
  /** Regularly drinks herbal mixtures such as agbo or paraga. */
  herbalRemedies: boolean | null;
  /** Eats salt or seasoning cubes heavily (daily or more). */
  highSalt: boolean | null;
  /** Cups of water a day (low intake is a mild risk). */
  waterCupsPerDay: number | null;
  /** Hepatitis B or C, HIV, or repeated untreated urinary or kidney infections. */
  chronicInfection: boolean | null;
};

export type KidneyFactor = {
  key: string;
  name: string;
  detail: string;
  category: 'increase' | 'protective';
  impact: number;
  icon: string;
  tip: string | null;
};

export type KidneyResult = {
  band: 'LOW' | 'MODERATE' | 'HIGH';
  score: number;
  points: number;
  factors: KidneyFactor[];
};

const BAND_SCORE = { LOW: 20, MODERATE: 55, HIGH: 85 } as const;

export function computeKidneyRisk(input: KidneyInput): KidneyResult {
  const factors: KidneyFactor[] = [];
  let points = 0;

  const add = (
    key: string,
    present: boolean,
    weight: number,
    name: string,
    detail: string,
    icon: string,
    tip: string | null,
  ) => {
    if (!present) return;
    points += weight;
    factors.push({ key, name, detail, category: 'increase', impact: weight, icon, tip });
  };

  // The two biggest causes of kidney failure in Nigeria.
  const hasDiabetes = input.diabetes === true;
  const hasHypertension =
    input.hypertension === true ||
    input.onBpMedication === true ||
    (input.systolicBp != null && input.systolicBp >= 140);

  add(
    'diabetes',
    hasDiabetes,
    3,
    'Diabetes',
    'High blood sugar is the leading cause of kidney damage',
    'water',
    'Keeping your sugar under control protects your kidneys. A doctor can help you plan this.',
  );
  add(
    'hypertension',
    hasHypertension,
    3,
    'High blood pressure',
    'High blood pressure quietly damages the kidneys over time',
    'heart-pulse',
    'Controlling your blood pressure is one of the best things you can do for your kidneys.',
  );

  // Age. Nigeria's national screening showed kidney changes climb sharply with
  // age (about 2% under 20, rising to a third of people over 60).
  if (input.age != null && input.age >= 60) {
    add('age', true, 3, 'Age', '60 or older', 'calendar-account-outline', null);
  } else if (input.age != null && input.age >= 50) {
    add('age', true, 2, 'Age', '50 or older', 'calendar-account-outline', null);
  } else if (input.age != null && input.age >= 40) {
    add('age', true, 1, 'Age', '40 or older', 'calendar-account-outline', null);
  }

  // Female sex was an independent risk factor in the national screening. It is
  // not something you can change, so there is no tip, just an honest note.
  add(
    'sex',
    input.sex === 'female',
    1,
    'Sex',
    'Women in Nigeria have shown slightly higher rates of kidney changes',
    'account-outline',
    null,
  );

  add(
    'family',
    input.familyKidneyDisease === true,
    2,
    'Family history',
    'A close relative has kidney disease or is on dialysis',
    'account-multiple-outline',
    null,
  );

  // Nigeria-specific lifestyle drivers.
  add(
    'painkillers',
    input.frequentPainkillers === true,
    2,
    'Frequent painkillers',
    'Takes pain medicine like ibuprofen or diclofenac several times a week',
    'pill',
    'Taking painkillers often can slowly harm the kidneys. Use them only when you really need to, and ask a pharmacist for safer options.',
  );
  add(
    'herbal',
    input.herbalRemedies === true,
    2,
    'Herbal mixtures',
    'Regularly drinks herbal mixtures such as agbo or paraga',
    'bottle-tonic-outline',
    'Some herbal mixtures are hard on the kidneys because you cannot know what is inside. Cutting back is safer.',
  );
  add(
    'infection',
    input.chronicInfection === true,
    2,
    'Long-term infection',
    'Hepatitis B or C, HIV, or repeated urinary infections that can scar the kidneys',
    'virus-outline',
    'Getting these treated and checked by a doctor protects your kidneys over time.',
  );
  add(
    'bmi',
    input.bmi != null && input.bmi >= 30,
    1,
    'Weight',
    'Weight is in the obese range',
    'human',
    'Losing a little weight eases the load on your kidneys.',
  );
  add(
    'salt',
    input.highSalt === true,
    1,
    'Salt',
    'Eats a lot of salt or seasoning cubes',
    'shaker-outline',
    'Using less salt and Maggi helps both your blood pressure and your kidneys.',
  );
  add(
    'water',
    input.waterCupsPerDay != null && input.waterCupsPerDay < 5,
    1,
    'Low water',
    'Drinks little water during the day',
    'cup-water',
    'Drinking enough clean water helps your kidneys flush waste. Aim for about 6 to 8 cups a day.',
  );
  add('smoking', input.smoking === true, 1, 'Smoking', 'Current smoker', 'smoking', 'Quitting protects your kidneys and your heart.');
  add(
    'cvd',
    input.heartDisease === true,
    1,
    'Heart disease',
    'Has had heart disease, a heart attack, or a stroke',
    'heart-broken',
    null,
  );

  // Band. The two leading causes together push straight to High. Otherwise the
  // total decides. Thresholds are a written-down clinical judgement, not a
  // single proven equation (see the methodology doc).
  let band: 'LOW' | 'MODERATE' | 'HIGH';
  if ((hasDiabetes && hasHypertension) || points >= 7) band = 'HIGH';
  else if (points >= 4) band = 'MODERATE';
  else band = 'LOW';

  return { band, score: BAND_SCORE[band], points, factors };
}
