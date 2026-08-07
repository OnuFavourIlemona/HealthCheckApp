import type { StoredFactor } from './riskFactors';

/**
 * Base URL for the real prediction API (see /api in the repo root). Empty
 * until deployed — every function below fails fast and returns null when
 * it's unset, so the app always has a working fallback (AssessScreen's
 * local heuristic) rather than hanging on a request to nowhere. Set
 * EXPO_PUBLIC_PREDICTION_API_URL once the service is deployed (see
 * api/README.md for the Cloud Run deploy steps).
 */
const API_BASE_URL = process.env.EXPO_PUBLIC_PREDICTION_API_URL ?? '';
const API_KEY = process.env.EXPO_PUBLIC_PREDICTION_API_KEY ?? '';

const REQUEST_TIMEOUT_MS = 8000;

type ApiFactor = {
  feature: string;
  raw_value: number;
  impact_points: number;
  direction: 'increase' | 'protective';
};

type ApiResponse = {
  condition: string;
  model_tier: 'full' | 'core';
  probability: number;
  score: number;
  risk_level: 'LOW' | 'MODERATE' | 'HIGH';
  base_probability: number;
  factors: ApiFactor[];
};

export type PredictionResult = {
  score: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  modelTier: 'full' | 'core';
  factors: StoredFactor[];
};

/** Per-request metadata used to turn a raw API factor back into a display-ready one — see buildDisplayMeta() below. */
type FactorMeta = { name: string; icon: string; detail: string; tip: string | null };

async function postPredict(path: string, body: unknown): Promise<ApiResponse | null> {
  if (!API_BASE_URL) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as ApiResponse;
  } catch {
    // Network error, timeout, service down — all treated the same: the
    // caller falls back to the local heuristic. A prediction API being
    // briefly unreachable should never block a user from getting *a*
    // result, just possibly a less precise one.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function toStoredFactors(factors: ApiFactor[], meta: Record<string, FactorMeta>): StoredFactor[] {
  return factors
    .filter((f) => meta[f.feature])
    .map((f) => {
      const m = meta[f.feature];
      return {
        key: f.feature,
        name: m.name,
        detail: m.detail,
        category: f.direction,
        impact: Math.round(Math.abs(f.impact_points) * 10) / 10,
        icon: m.icon,
        tip: f.impact_points > 0 ? m.tip : null,
      };
    })
    .sort((a, b) => b.impact - a.impact);
}

export type HealthInfoInput = {
  age: number;
  gender: string | null;
  bmi: number;
  sleep_hours: number;
  smoking: boolean;
  family_diabetes: boolean;
  hypertension: boolean;
  fasting_glucose_mgdl: number | null;
};

function genderLabel(gender: string | null): 'Female' | 'Male' | null {
  if (gender === 'female') return 'Female';
  if (gender === 'male') return 'Male';
  return null;
}

/**
 * Diabetes and High Blood Sugar both call the diabetes model server-side
 * (see ml/high_blood_sugar/report.md for why) — only the endpoint path
 * differs, which is what picks the right risk-level thresholds.
 */
async function predictDiabetesLike(
  info: HealthInfoInput,
  endpoint: 'diabetes' | 'high_blood_sugar',
): Promise<PredictionResult | null> {
  const gender = genderLabel(info.gender);
  // No glucose-free tier exists for this model (see api/README.md) — skip
  // the API call entirely rather than send a request guaranteed to 422.
  if (!gender || info.fasting_glucose_mgdl == null) return null;

  const meta: Record<string, FactorMeta> = {
    age: { name: 'Age', icon: 'calendar-month-outline', detail: `Age ${Math.round(info.age)}`, tip: null },
    gender_code: { name: 'Gender', icon: 'account', detail: gender, tip: null },
    hypertension: {
      name: 'Blood Pressure',
      icon: 'heart-pulse',
      detail: info.hypertension ? 'Recorded high blood pressure' : 'No recorded hypertension',
      tip: info.hypertension
        ? 'Keep monitoring and managing your blood pressure with a practitioner.'
        : null,
    },
    bmi: {
      name: 'BMI',
      icon: 'human',
      detail: `BMI ${info.bmi}`,
      tip: 'Work towards a healthier weight through diet and regular activity.',
    },
    smoking_code: {
      name: 'Smoking',
      icon: info.smoking ? 'smoking' : 'smoking-off',
      detail: info.smoking ? 'Current smoker' : 'Non-smoker',
      tip: info.smoking ? 'Consider quitting smoking, since it is one of the biggest drivers of this risk.' : null,
    },
    blood_glucose_level: {
      name: 'Fasting Blood Sugar',
      icon: 'water-plus',
      detail: `${info.fasting_glucose_mgdl} mg/dL`,
      tip: 'Recheck your fasting blood sugar and discuss it with a practitioner. This is often the single biggest factor in this result.',
    },
  };

  const response = await postPredict(`/v1/predict/${endpoint}`, {
    age: info.age,
    gender,
    bmi: info.bmi,
    hypertension: info.hypertension,
    blood_glucose_mgdl: info.fasting_glucose_mgdl,
    smoking_history: info.smoking ? 'current' : 'never',
  });
  if (!response) return null;

  return {
    score: response.score,
    riskLevel: response.risk_level,
    modelTier: response.model_tier,
    factors: toStoredFactors(response.factors, meta),
  };
}

export function predictDiabetes(info: HealthInfoInput): Promise<PredictionResult | null> {
  return predictDiabetesLike(info, 'diabetes');
}

export function predictHighBloodSugar(info: HealthInfoInput): Promise<PredictionResult | null> {
  return predictDiabetesLike(info, 'high_blood_sugar');
}

export async function predictHypertension(info: HealthInfoInput): Promise<PredictionResult | null> {
  const meta: Record<string, FactorMeta> = {
    Age: { name: 'Age', icon: 'calendar-month-outline', detail: `Age ${Math.round(info.age)}`, tip: null },
    BMI: {
      name: 'BMI',
      icon: 'human',
      detail: `BMI ${info.bmi}`,
      tip: 'Work towards a healthier weight through diet and regular activity.',
    },
    Sleep_Duration: {
      name: 'Sleep',
      icon: 'sleep',
      detail: `${info.sleep_hours}h average`,
      tip: 'Aim for 7–9 hours of sleep a night.',
    },
    Smoking_Status_code: {
      name: 'Smoking',
      icon: info.smoking ? 'smoking' : 'smoking-off',
      detail: info.smoking ? 'Current smoker' : 'Non-smoker',
      tip: info.smoking ? 'Consider quitting smoking, since it is one of the biggest drivers of this risk.' : null,
    },
  };

  const response = await postPredict('/v1/predict/hypertension', {
    age: info.age,
    bmi: info.bmi,
    sleep_duration_hours: info.sleep_hours,
    smoking_status: info.smoking ? 'Smoker' : 'Non-Smoker',
  });
  if (!response) return null;

  return {
    score: response.score,
    riskLevel: response.risk_level,
    modelTier: response.model_tier,
    factors: toStoredFactors(response.factors, meta),
  };
}

export async function predictStroke(info: HealthInfoInput): Promise<PredictionResult | null> {
  const gender = genderLabel(info.gender);
  if (!gender) return null;

  const meta: Record<string, FactorMeta> = {
    age: { name: 'Age', icon: 'calendar-month-outline', detail: `Age ${Math.round(info.age)}`, tip: null },
    gender_code: { name: 'Gender', icon: 'account', detail: gender, tip: null },
    hypertension: {
      name: 'Blood Pressure',
      icon: 'heart-pulse',
      detail: info.hypertension ? 'Recorded high blood pressure' : 'No recorded hypertension',
      tip: info.hypertension
        ? 'Keep monitoring and managing your blood pressure with a practitioner.'
        : null,
    },
    bmi: {
      name: 'BMI',
      icon: 'human',
      detail: `BMI ${info.bmi}`,
      tip: 'Work towards a healthier weight through diet and regular activity.',
    },
    smoking_code: {
      name: 'Smoking',
      icon: info.smoking ? 'smoking' : 'smoking-off',
      detail: info.smoking ? 'Current smoker' : 'Non-smoker',
      tip: info.smoking ? 'Consider quitting smoking, since it is one of the biggest drivers of this risk.' : null,
    },
    avg_glucose_level: {
      name: 'Fasting Blood Sugar',
      icon: 'water-plus',
      detail: `${info.fasting_glucose_mgdl} mg/dL`,
      tip: 'Recheck your fasting blood sugar and discuss it with a practitioner.',
    },
  };

  const response = await postPredict('/v1/predict/stroke', {
    age: info.age,
    gender,
    bmi: info.bmi,
    hypertension: info.hypertension,
    smoking_status: info.smoking ? 'smokes' : 'never smoked',
    avg_glucose_level_mgdl: info.fasting_glucose_mgdl ?? undefined,
  });
  if (!response) return null;

  return {
    score: response.score,
    riskLevel: response.risk_level,
    modelTier: response.model_tier,
    factors: toStoredFactors(response.factors, meta),
  };
}

/** Single entry point AssessScreen calls — returns null (fall back to the local heuristic) when ineligible, unreachable, or the condition has no model. */
export function predictCondition(
  conditionKey: string,
  info: HealthInfoInput,
): Promise<PredictionResult | null> {
  switch (conditionKey) {
    case 'diabetes':
      return predictDiabetes(info);
    case 'high_blood_sugar':
      return predictHighBloodSugar(info);
    case 'hypertension':
      return predictHypertension(info);
    case 'stroke':
      return predictStroke(info);
    default:
      return Promise.resolve(null);
  }
}
