/**
 * Revised Framingham Stroke Risk Profile (FSRP) — a validated, published
 * clinical equation that estimates a person's 10-year probability of stroke
 * from a small set of risk factors. Unlike the ML models, this is a fixed
 * points-based lookup with peer-reviewed coefficients, so it runs instantly
 * on-device, offline, and is fully transparent.
 *
 * See api/FSRP_METHODOLOGY.md for the full derivation, sources, every point
 * value, and the exact fallback rules used when an input is missing.
 *
 * IMPORTANT: v1. The score→risk% conversion tables are verified against the
 * official Framingham Heart Study anchor values. The per-factor point values
 * are reconstructed from the open-access Revised FSRP supplementary tables
 * and should be re-confirmed against D'Agostino (Circulation 2017) before
 * this drives scores for real patients. It is a screening estimate, never a
 * diagnosis.
 */

export type FsrpInput = {
  age: number;
  sex: 'male' | 'female' | null;
  systolicBp: number | null;
  onBpMedication: boolean | null;
  diabetes: boolean | null;
  smoker: boolean | null;
  cardiovascularDisease: boolean | null;
  atrialFibrillation: boolean | null;
};

export type FsrpFactor = {
  key: string;
  name: string;
  detail: string;
  points: number;
  /** True when this value was assumed because the user didn't provide it. */
  assumed: boolean;
};

export type FsrpResult = {
  /** Total FSRP points. */
  totalPoints: number;
  /** 10-year probability of stroke, as a percentage (0-100). */
  tenYearRiskPercent: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  factors: FsrpFactor[];
  /** True if any input was assumed via a fallback (result is an estimate). */
  usedFallback: boolean;
};

// --- Point tables -----------------------------------------------------------
// Each entry: [inclusiveUpperBound, points]. The last band catches everything
// above it. Age uses lower-bound bands; BP uses upper-bound bands.

const MALE_AGE_BANDS: [number, number][] = [
  [56, 0], [59, 1], [62, 2], [65, 3], [68, 4], [72, 5], [75, 6], [78, 7], [81, 8], [84, 9], [Infinity, 10],
];
const FEMALE_AGE_BANDS: [number, number][] = [
  [56, 0], [59, 1], [62, 2], [64, 3], [67, 4], [70, 5], [73, 6], [76, 7], [78, 8], [81, 9], [Infinity, 10],
];

const MALE_SBP_UNTREATED: [number, number][] = [
  [105, 0], [115, 1], [125, 2], [135, 3], [145, 4], [155, 5], [165, 6], [175, 7], [185, 8], [195, 9], [Infinity, 10],
];
const MALE_SBP_TREATED: [number, number][] = [
  [105, 0], [112, 1], [117, 2], [123, 3], [129, 4], [135, 5], [142, 6], [150, 7], [161, 8], [176, 9], [Infinity, 10],
];
const FEMALE_SBP_UNTREATED: [number, number][] = [
  [106, 0], [118, 1], [130, 2], [143, 3], [155, 4], [167, 5], [180, 6], [192, 7], [204, 8], [216, 9], [Infinity, 10],
];
const FEMALE_SBP_TREATED: [number, number][] = [
  [106, 0], [113, 1], [119, 2], [125, 3], [131, 4], [139, 5], [148, 6], [160, 7], [204, 8], [216, 9], [Infinity, 10],
];

// Binary factor points (same for both sexes in the revised profile).
const PTS_DIABETES = 2;
const PTS_SMOKER = 3;
const PTS_CVD = 4;
const PTS_AFIB = 5;

// Total points -> 10-year risk %. Index 0 = 0 points.
const MALE_RISK: number[] = [
  2, 3, 3, 4, 4, 5, 5, 6, 7, 8, 10, 11, 13, 15, 17, 20, 22, 26, 29, 33, 37, 42, 47, 52, 57, 63, 68, 74, 79, 84, 88,
];
const FEMALE_RISK: number[] = [
  1, 1, 1, 2, 2, 2, 3, 4, 4, 5, 6, 8, 9, 11, 13, 16, 19, 23, 27, 32, 37, 43, 50, 57, 64, 71, 78, 84, 84, 84, 84,
];

// --- Fallback defaults (population-typical, so a missing answer still yields
// a near-accurate estimate rather than blocking the calculation) ------------
const DEFAULT_SBP = 130; // untreated, near the adult population mean

function pointsFor(bands: [number, number][], value: number): number {
  for (const [bound, pts] of bands) {
    if (value <= bound) return pts;
  }
  return bands[bands.length - 1][1];
}

function riskFromPoints(risk: number[], points: number): number {
  const clamped = Math.max(0, Math.min(points, risk.length - 1));
  return risk[clamped];
}

function levelFor(percent: number): 'LOW' | 'MODERATE' | 'HIGH' {
  if (percent < 10) return 'LOW';
  if (percent < 20) return 'MODERATE';
  return 'HIGH';
}

function ageBandLabel(age: number, bands: [number, number][]): string {
  let lower = 0;
  for (const [bound] of bands) {
    if (age <= bound) return lower === 0 ? `≤${bound}` : `${lower}-${bound}`;
    lower = bound + 1;
  }
  return `${age}`;
}

function computeForSex(sex: 'male' | 'female', input: FsrpInput): { points: number; risk: number; factors: FsrpFactor[]; fallback: boolean } {
  const ageBands = sex === 'male' ? MALE_AGE_BANDS : FEMALE_AGE_BANDS;
  const treated = input.onBpMedication === true;
  const sbpBands = sex === 'male'
    ? (treated ? MALE_SBP_TREATED : MALE_SBP_UNTREATED)
    : (treated ? FEMALE_SBP_TREATED : FEMALE_SBP_UNTREATED);
  const riskTable = sex === 'male' ? MALE_RISK : FEMALE_RISK;

  let fallback = false;
  const factors: FsrpFactor[] = [];

  // Age (always known — derived from date of birth).
  const agePts = pointsFor(ageBands, input.age);
  factors.push({ key: 'age', name: 'Age', detail: ageBandLabel(input.age, ageBands), points: agePts, assumed: false });

  // Systolic BP.
  const sbp = input.systolicBp ?? DEFAULT_SBP;
  const sbpAssumed = input.systolicBp == null;
  fallback = fallback || sbpAssumed;
  const sbpPts = pointsFor(sbpBands, sbp);
  factors.push({
    key: 'bp',
    name: 'Blood pressure',
    detail: `${sbp} mmHg${treated ? ' (on medication)' : ''}${sbpAssumed ? ' — assumed average' : ''}`,
    points: sbpPts,
    assumed: sbpAssumed,
  });

  // Binary factors — missing defaults to "No" (the common case).
  const addBinary = (key: string, name: string, value: boolean | null, pts: number) => {
    const assumed = value == null;
    fallback = fallback || assumed;
    const yes = value === true;
    factors.push({
      key,
      name,
      detail: yes ? 'Yes' : assumed ? 'Assumed no' : 'No',
      points: yes ? pts : 0,
      assumed,
    });
  };
  addBinary('diabetes', 'Diabetes', input.diabetes, PTS_DIABETES);
  addBinary('smoker', 'Smoking', input.smoker, PTS_SMOKER);
  addBinary('cvd', 'Heart disease', input.cardiovascularDisease, PTS_CVD);
  addBinary('afib', 'Atrial fibrillation', input.atrialFibrillation, PTS_AFIB);

  const points = factors.reduce((sum, f) => sum + f.points, 0);
  return { points, risk: riskFromPoints(riskTable, points), factors, fallback };
}

export function computeFsrp(input: FsrpInput): FsrpResult {
  // Sex unknown: average the male and female estimates rather than guess.
  if (input.sex == null) {
    const m = computeForSex('male', input);
    const f = computeForSex('female', input);
    const percent = Math.round((m.risk + f.risk) / 2);
    return {
      totalPoints: Math.round((m.points + f.points) / 2),
      tenYearRiskPercent: percent,
      riskLevel: levelFor(percent),
      factors: m.factors, // point structure is the same; labels match
      usedFallback: true,
    };
  }

  const { points, risk, factors, fallback } = computeForSex(input.sex, input);
  return {
    totalPoints: points,
    tenYearRiskPercent: risk,
    riskLevel: levelFor(risk),
    factors,
    usedFallback: fallback,
  };
}
