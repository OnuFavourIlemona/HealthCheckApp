import type { HealthProfile, RiskAssessment } from './dashboard';

/**
 * Dev-only demo data for visually verifying the Home screen across risk
 * scenarios without needing seeded Supabase accounts. Never used in
 * production — every entry point into this module is gated by __DEV__.
 */
export type DemoScenario = 'low' | 'high';

let activeScenario: DemoScenario | null = null;

export function setDemoScenario(scenario: DemoScenario | null): void {
  if (!__DEV__) return;
  activeScenario = scenario;
}

export function getDemoScenario(): DemoScenario | null {
  return __DEV__ ? activeScenario : null;
}

const now = () => new Date().toISOString();

const LOW_RISK_PROFILE: HealthProfile = {
  full_name: 'Demo Patient (Low Risk)',
  age: 27,
  gender: 'female',
  bmi: 21.8,
  height_cm: 165,
  weight_kg: 59,
  sleep_hours: 7.5,
  smoking: false,
  family_diabetes: false,
  hypertension: false,
  fasting_glucose_mgdl: 88,
};

function detailsFor(profile: HealthProfile): Record<string, unknown> {
  return {
    age: profile.age,
    bmi: profile.bmi,
    sleep_hours: profile.sleep_hours,
    smoking: profile.smoking,
    family_history: profile.family_diabetes,
    hypertension: profile.hypertension,
    fasting_glucose_mgdl: profile.fasting_glucose_mgdl,
  };
}

const LOW_RISK_ASSESSMENTS: RiskAssessment[] = [
  { id: -1, assessment_type: 'diabetes', score: 16, risk_level: 'LOW', details: detailsFor(LOW_RISK_PROFILE), created_at: now() },
  { id: -2, assessment_type: 'hypertension', score: 11, risk_level: 'LOW', details: detailsFor(LOW_RISK_PROFILE), created_at: now() },
  { id: -3, assessment_type: 'stroke', score: 8, risk_level: 'LOW', details: detailsFor(LOW_RISK_PROFILE), created_at: now() },
  { id: -4, assessment_type: 'high_blood_sugar', score: 14, risk_level: 'LOW', details: detailsFor(LOW_RISK_PROFILE), created_at: now() },
];

const HIGH_RISK_PROFILE: HealthProfile = {
  full_name: 'Demo Patient (High Risk)',
  age: 59,
  gender: 'male',
  bmi: 31.6,
  height_cm: 175,
  weight_kg: 97,
  sleep_hours: 5,
  smoking: true,
  family_diabetes: true,
  hypertension: true,
  fasting_glucose_mgdl: 148,
};

const HIGH_RISK_ASSESSMENTS: RiskAssessment[] = [
  { id: -5, assessment_type: 'diabetes', score: 83, risk_level: 'HIGH', details: detailsFor(HIGH_RISK_PROFILE), created_at: now() },
  { id: -6, assessment_type: 'hypertension', score: 79, risk_level: 'HIGH', details: detailsFor(HIGH_RISK_PROFILE), created_at: now() },
  { id: -7, assessment_type: 'stroke', score: 71, risk_level: 'HIGH', details: detailsFor(HIGH_RISK_PROFILE), created_at: now() },
  { id: -8, assessment_type: 'high_blood_sugar', score: 88, risk_level: 'HIGH', details: detailsFor(HIGH_RISK_PROFILE), created_at: now() },
];

export function demoData(scenario: DemoScenario): {
  profile: HealthProfile;
  assessments: RiskAssessment[];
} {
  return scenario === 'low'
    ? { profile: LOW_RISK_PROFILE, assessments: LOW_RISK_ASSESSMENTS }
    : { profile: HIGH_RISK_PROFILE, assessments: HIGH_RISK_ASSESSMENTS };
}
