/**
 * Liver health risk. Liver disease is a large, mostly hidden problem in Nigeria.
 * Hepatitis B alone infects an estimated 1 in 10 Nigerians, most without knowing
 * it, and it is the leading cause of liver cirrhosis and liver cancer here. Add
 * alcohol, fatty liver from poor diet, and toxic herbal mixtures, and the risk
 * is widespread. The damage is silent for years, so early testing saves lives.
 *
 * There is no single no-lab liver equation validated for Nigeria. So this check
 * adds up the causes Nigerian liver doctors point to and reports a Low / Moderate
 * / High band, always saying clearly that a simple blood test (liver function
 * test and hepatitis B and C screening) is what confirms things. See
 * api/LIVER_METHODOLOGY.md.
 */

export type LiverInput = {
  /** Told they have hepatitis B or C. The single biggest driver. */
  viralHepatitis: boolean | null;
  /** Has never been tested for hepatitis B or C. */
  neverTestedHepatitis: boolean | null;
  /** Drinks alcohol regularly. */
  alcohol: boolean | null;
  /** Takes painkillers (especially paracetamol) often. */
  frequentPainkillers: boolean | null;
  /** Regularly drinks herbal mixtures such as agbo or paraga. */
  herbalRemedies: boolean | null;
  /** Current smoker. Found in about a third of Nigerian liver-disease admissions. */
  smoking: boolean | null;
  /** Obese (BMI 30+): the main driver of fatty liver. */
  bmi: number | null;
  /** Any sign of diabetes (metabolic fatty liver). */
  diabetes: boolean | null;
  /** Heavy sugary or processed diet. */
  sugaryDiet: boolean | null;
  /** A close relative with liver disease or liver cancer. */
  familyLiverDisease: boolean | null;
  /** Blood transfusion, tribal marks, unsafe tattoos, shared blades, or unsafe injections. */
  riskyBloodExposure: boolean | null;
};

export type LiverFactor = {
  key: string;
  name: string;
  detail: string;
  category: 'increase' | 'protective';
  impact: number;
  icon: string;
  tip: string | null;
};

export type LiverResult = {
  band: 'LOW' | 'MODERATE' | 'HIGH';
  score: number;
  points: number;
  factors: LiverFactor[];
};

const BAND_SCORE = { LOW: 20, MODERATE: 55, HIGH: 85 } as const;

export function computeLiverRisk(input: LiverInput): LiverResult {
  const factors: LiverFactor[] = [];
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

  const hasHepatitis = input.viralHepatitis === true;

  add(
    'hepatitis',
    hasHepatitis,
    4,
    'Hepatitis B or C',
    'The biggest cause of serious liver disease in Nigeria',
    'virus-outline',
    'If you carry hepatitis B or C, a doctor can monitor you and give medicine that stops it from damaging your liver. Hepatitis C can even be cured now.',
  );
  add(
    'family',
    input.familyLiverDisease === true,
    2,
    'Family history',
    'A close relative has liver disease or liver cancer',
    'account-multiple-outline',
    null,
  );
  add(
    'alcohol',
    input.alcohol === true,
    3,
    'Alcohol',
    'Drinks alcohol regularly. The top cause of liver disease admissions in Nigeria',
    'glass-mug-variant',
    'Cutting down on alcohol, or stopping, gives your liver a chance to heal.',
  );
  add(
    'painkillers',
    input.frequentPainkillers === true,
    2,
    'Frequent painkillers',
    'Takes painkillers like paracetamol often',
    'pill',
    'Too much paracetamol is a leading cause of sudden liver damage. Only take the correct dose, and only when you need it.',
  );
  add(
    'herbal',
    input.herbalRemedies === true,
    2,
    'Herbal mixtures',
    'Regularly drinks herbal mixtures such as agbo or paraga',
    'bottle-tonic-outline',
    'Many herbal mixtures are toxic to the liver, and you cannot know what is inside. Cutting back protects you.',
  );
  add(
    'exposure',
    input.riskyBloodExposure === true,
    2,
    'Blood exposure',
    'Blood transfusion, tribal marks, unsafe tattoos, shared blades, or unsafe injections',
    'needle',
    'These can pass on hepatitis. A simple hepatitis test tells you where you stand.',
  );
  add(
    'weight',
    input.bmi != null && input.bmi >= 30,
    2,
    'Weight',
    'Weight is in the obese range, which can cause fatty liver',
    'human',
    'Losing 7 to 10 percent of your weight can clear a lot of fat from the liver.',
  );
  add(
    'smoking',
    input.smoking === true,
    1,
    'Smoking',
    'Current smoker. Common among Nigerian liver-disease patients',
    'smoking',
    'Quitting lowers your liver cancer risk along with many others.',
  );
  add(
    'diabetes',
    input.diabetes === true,
    1,
    'Diabetes',
    'High blood sugar adds to fatty liver risk',
    'water',
    'Keeping your sugar controlled also protects your liver.',
  );
  add(
    'diet',
    input.sugaryDiet === true,
    1,
    'Sugary diet',
    'A lot of soft drinks and sugary or processed foods',
    'cup',
    'Cutting sugary drinks and processed food lowers the fat building up in your liver.',
  );
  add(
    'untested',
    input.neverTestedHepatitis === true && !hasHepatitis,
    1,
    'Never tested',
    'Has never been tested for hepatitis B or C',
    'help-circle-outline',
    'Most people with hepatitis feel completely fine and have no idea they carry it. A one-time test is the only way to know.',
  );

  // Band. A known hepatitis carrier is High and needs proper follow-up.
  // Otherwise the total decides. Thresholds are a written-down clinical
  // judgement, not a single proven equation (see the methodology doc).
  let band: 'LOW' | 'MODERATE' | 'HIGH';
  if (hasHepatitis || points >= 6) band = 'HIGH';
  else if (points >= 3) band = 'MODERATE';
  else band = 'LOW';

  return { band, score: BAND_SCORE[band], points, factors };
}
