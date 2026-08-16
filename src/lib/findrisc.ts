/**
 * FINDRISC — Finnish Diabetes Risk Score, in the exact 0–26 form that the
 * International Diabetes Federation recommends and that has been VALIDATED IN
 * AFRICANS (Omech et al., Botswana: AUC 0.86, 77% sensitivity, 89% specificity)
 * and used in Nigerian populations (Busari et al., Ondo; Ambakederemo et al.).
 *
 * It estimates the 10-YEAR risk of developing type 2 diabetes with NO blood
 * test — which matters here because only about a quarter of Nigerians know
 * their blood sugar. See api/DIABETES_METHODOLOGY.md for the full breakdown,
 * sources, and honest caveats.
 *
 * Output is a Low / Moderate / High BAND (plus the finer FINDRISC label) — not
 * a false-precision percentage, because absolute-risk calibration is the weak
 * point of ported Western tools in African populations. What holds up is the
 * RANKING, so we surface the band.
 */

export type FamilyDiabetesDegree = 'none' | 'second' | 'first';

export type FindriscInput = {
  age: number | null;
  bmi: number | null;
  /** Waist circumference in cm, measured midway between lowest rib and hip. */
  waistCm: number | null;
  /** Male / female changes the waist thresholds. */
  sex: 'male' | 'female' | null;
  /** At least 30 min of physical activity most days. */
  physicallyActive: boolean | null;
  /** Eats fruits or vegetables every day. */
  dailyFruitVeg: boolean | null;
  /** Ever taken blood-pressure medication regularly. */
  onBpMedication: boolean | null;
  /** Ever been found to have high blood glucose (check-up, pregnancy, illness). */
  everHighGlucose: boolean | null;
  /** Closest relative with diabetes. */
  familyDiabetes: FamilyDiabetesDegree | null;
};

export type FindriscFactor = {
  key: string;
  name: string;
  detail: string;
  points: number;
  icon: string;
  tip: string | null;
};

export type FindriscResult = {
  score: number;
  /** The tool's own five-level label. */
  findriscCategory: 'low' | 'slightly_elevated' | 'moderate' | 'high' | 'very_high';
  /** Collapsed to the app's three bands for the score ring. */
  band: 'LOW' | 'MODERATE' | 'HIGH';
  /** 0–100 value for the app's score ring. */
  score100: number;
  factors: FindriscFactor[];
  /** How many of the 8 items had real answers (rest fell back to 0). */
  answered: number;
};

const FACTOR_ICON: Record<string, string> = {
  age: 'calendar-account-outline',
  bmi: 'human',
  waist: 'tape-measure',
  activity: 'run',
  diet: 'food-apple-outline',
  bp: 'heart-pulse',
  glucose: 'water',
  family: 'account-multiple-outline',
};

/** Age: <45=0, 45–54=2, 55–64=3, ≥65=4. */
function agePoints(age: number): number {
  if (age < 45) return 0;
  if (age <= 54) return 2;
  if (age <= 64) return 3;
  return 4;
}

/** BMI: <25=0, 25–29.9=1, ≥30=3. */
function bmiPoints(bmi: number): number {
  if (bmi < 25) return 0;
  if (bmi < 30) return 1;
  return 3;
}

/** Waist (cm): men <94=0 / 94–102=3 / >102=4; women <80=0 / 80–88=3 / >88=4. */
function waistPoints(waistCm: number, sex: 'male' | 'female'): number {
  if (sex === 'male') {
    if (waistCm < 94) return 0;
    if (waistCm <= 102) return 3;
    return 4;
  }
  if (waistCm < 80) return 0;
  if (waistCm <= 88) return 3;
  return 4;
}

/** Family history: none=0, second-degree=3, first-degree=5. */
function familyPoints(degree: FamilyDiabetesDegree): number {
  if (degree === 'first') return 5;
  if (degree === 'second') return 3;
  return 0;
}

export function computeFindrisc(input: FindriscInput): FindriscResult {
  const factors: FindriscFactor[] = [];
  let score = 0;
  let answered = 0;

  // Age.
  if (input.age != null) {
    answered += 1;
    const pts = agePoints(input.age);
    score += pts;
    if (pts > 0) {
      factors.push({
        key: 'age',
        name: 'Age',
        detail: input.age >= 65 ? '65 or older' : `${input.age} years`,
        points: pts,
        icon: FACTOR_ICON.age,
        tip: null,
      });
    }
  }

  // BMI.
  if (input.bmi != null) {
    answered += 1;
    const pts = bmiPoints(input.bmi);
    score += pts;
    if (pts > 0) {
      factors.push({
        key: 'bmi',
        name: 'Weight',
        detail: input.bmi >= 30 ? `BMI ${input.bmi.toFixed(1)} (obese range)` : `BMI ${input.bmi.toFixed(1)} (overweight range)`,
        points: pts,
        icon: FACTOR_ICON.bmi,
        tip: 'Losing even a little weight sharply lowers diabetes risk.',
      });
    }
  }

  // Waist circumference (needs sex for the threshold).
  if (input.waistCm != null && input.sex != null) {
    answered += 1;
    const pts = waistPoints(input.waistCm, input.sex);
    score += pts;
    if (pts > 0) {
      factors.push({
        key: 'waist',
        name: 'Waist size',
        detail: `${input.waistCm} cm around your waist`,
        points: pts,
        icon: FACTOR_ICON.waist,
        tip: 'Fat around the belly raises diabetes risk even more than general weight does.',
      });
    }
  }

  // Physical activity.
  if (input.physicallyActive != null) {
    answered += 1;
    const pts = input.physicallyActive ? 0 : 2;
    score += pts;
    if (pts > 0) {
      factors.push({
        key: 'activity',
        name: 'Low activity',
        detail: 'Not active for 30 minutes most days',
        points: pts,
        icon: FACTOR_ICON.activity,
        tip: 'Even brisk walking most days improves how your body handles sugar.',
      });
    }
  }

  // Daily fruit/veg.
  if (input.dailyFruitVeg != null) {
    answered += 1;
    const pts = input.dailyFruitVeg ? 0 : 1;
    score += pts;
    if (pts > 0) {
      factors.push({
        key: 'diet',
        name: 'Diet',
        detail: 'Does not eat fruits or vegetables every day',
        points: pts,
        icon: FACTOR_ICON.diet,
        tip: 'Add vegetables (efo, ugu, garden egg) and fruit to daily meals.',
      });
    }
  }

  // BP medication.
  if (input.onBpMedication != null) {
    answered += 1;
    const pts = input.onBpMedication ? 2 : 0;
    score += pts;
    if (pts > 0) {
      factors.push({
        key: 'bp',
        name: 'Blood pressure',
        detail: 'Takes blood-pressure medication',
        points: pts,
        icon: FACTOR_ICON.bp,
        tip: null,
      });
    }
  }

  // Ever high blood glucose.
  if (input.everHighGlucose != null) {
    answered += 1;
    const pts = input.everHighGlucose ? 5 : 0;
    score += pts;
    if (pts > 0) {
      factors.push({
        key: 'glucose',
        name: 'Past high sugar',
        detail: 'Has had a high blood-sugar reading before',
        points: pts,
        icon: FACTOR_ICON.glucose,
        tip: 'A past high reading is one of the strongest warning signs, so it is worth a proper check.',
      });
    }
  }

  // Family history.
  if (input.familyDiabetes != null) {
    answered += 1;
    const pts = familyPoints(input.familyDiabetes);
    score += pts;
    if (pts > 0) {
      factors.push({
        key: 'family',
        name: 'Family history',
        detail:
          input.familyDiabetes === 'first'
            ? 'A parent, brother, sister, or own child has diabetes'
            : 'A grandparent, aunt, uncle, or cousin has diabetes',
        points: pts,
        icon: FACTOR_ICON.family,
        tip: 'Family history is the biggest warning sign for Nigerians, so use the steps below to stay ahead of it.',
      });
    }
  }

  // FINDRISC's own five-level categories.
  let findriscCategory: FindriscResult['findriscCategory'];
  if (score < 7) findriscCategory = 'low';
  else if (score <= 11) findriscCategory = 'slightly_elevated';
  else if (score <= 14) findriscCategory = 'moderate';
  else if (score <= 20) findriscCategory = 'high';
  else findriscCategory = 'very_high';

  // Collapse to the app's three bands for the ring.
  let band: 'LOW' | 'MODERATE' | 'HIGH';
  if (score < 7) band = 'LOW';
  else if (score <= 14) band = 'MODERATE';
  else band = 'HIGH';

  // Map the 0–26 score onto 0–100 for the ring (kept coarse on purpose).
  const score100 = Math.min(100, Math.round((score / 26) * 100));

  // Sort factors by how much they contributed.
  factors.sort((a, b) => b.points - a.points);

  return { score, findriscCategory, band, score100, factors, answered };
}

export const FINDRISC_CATEGORY_LABEL: Record<FindriscResult['findriscCategory'], string> = {
  low: 'Low risk',
  slightly_elevated: 'Slightly elevated risk',
  moderate: 'Moderate risk',
  high: 'High risk',
  very_high: 'Very high risk',
};
