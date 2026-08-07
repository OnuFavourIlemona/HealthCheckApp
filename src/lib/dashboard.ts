import type { RiskLevel } from '../theme';
import { supabase } from './supabase';

export type RiskAssessment = {
  id: number;
  assessment_type: string;
  score: number;
  risk_level: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

export type HealthProfile = {
  full_name: string | null;
  age: number | null;
  gender: string | null;
  bmi: number | null;
  sleep_hours: number | null;
  smoking: boolean | null;
  family_diabetes: boolean | null;
  hypertension: boolean | null;
  fasting_glucose_mgdl: number | null;
};

export const ASSESSMENT_LABELS: Record<string, string> = {
  diabetes: 'Diabetes',
  hypertension: 'Hypertension',
  stroke: 'Stroke',
  high_blood_sugar: 'High Blood Sugar',
};

export function normaliseLevel(value: string | null | undefined): RiskLevel {
  const upper = (value ?? '').toUpperCase();
  if (upper === 'LOW' || upper === 'MODERATE' || upper === 'HIGH') return upper;
  return 'LOW';
}

export function greetingForNow(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function firstNameOf(fullName: string | null): string | null {
  if (!fullName) return null;
  const first = fullName.trim().split(/\s+/)[0];
  return first || null;
}

export async function fetchHealthProfile(): Promise<HealthProfile | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return null;

  const { data } = await supabase
    .from('profiles')
    .select(
      'full_name, age, gender, bmi, sleep_hours, smoking, family_diabetes, hypertension, fasting_glucose_mgdl',
    )
    .eq('id', userId)
    .maybeSingle();
  return (data as HealthProfile) ?? null;
}

/** Full assessment history, newest first. */
export async function fetchAssessmentHistory(): Promise<RiskAssessment[]> {
  const { data } = await supabase
    .from('risk_assessments')
    .select('id, assessment_type, score, risk_level, details, created_at')
    .order('created_at', { ascending: false });
  return (data ?? []) as RiskAssessment[];
}

/** Most recent assessment per condition. */
export function latestPerType(history: RiskAssessment[]): RiskAssessment[] {
  const seen = new Set<string>();
  const latest: RiskAssessment[] = [];
  for (const item of history) {
    if (seen.has(item.assessment_type)) continue;
    seen.add(item.assessment_type);
    latest.push(item);
  }
  return latest;
}

/** Overall risk = the highest current risk across conditions. */
export function overallRisk(latest: RiskAssessment[]): {
  level: RiskLevel;
  label: string;
  title: string;
  message: string;
} {
  if (latest.length === 0) {
    return {
      level: 'LOW',
      label: 'Not assessed',
      title: 'Get started',
      message: 'Run your first assessment to see your risk.',
    };
  }
  const highest = latest.reduce((max, item) => (item.score > max.score ? item : max), latest[0]);
  const level = normaliseLevel(highest.risk_level);

  if (level === 'HIGH') {
    return {
      level,
      label: 'High',
      title: 'Take action',
      message: 'Speak to a practitioner about your results.',
    };
  }
  if (level === 'MODERATE') {
    return {
      level,
      label: 'Moderate',
      title: 'Room to improve',
      message: 'Small changes can lower your risk.',
    };
  }
  return {
    level,
    label: 'Low',
    title: 'Great job!',
    message: 'Keep up your healthy habits.',
  };
}

export type Recommendation = {
  key: string;
  title: string;
  subtitle: string;
  tag: string;
  tagTone: 'good' | 'watch';
};

/** Personalised suggestions derived from the user's saved health info. */
export function recommendationsFor(profile: HealthProfile | null): Recommendation[] {
  if (!profile) return [];
  const items: Recommendation[] = [];

  if (profile.sleep_hours != null) {
    const good = profile.sleep_hours >= 7 && profile.sleep_hours <= 9;
    items.push({
      key: 'sleep',
      title: good ? 'Keep your sleep on track' : 'Improve your sleep quality',
      subtitle: `${profile.sleep_hours}h average sleep`,
      tag: good ? 'Good' : 'Low',
      tagTone: good ? 'good' : 'watch',
    });
  }

  if (profile.bmi != null) {
    const healthy = profile.bmi >= 18.5 && profile.bmi < 25;
    items.push({
      key: 'bmi',
      title: healthy ? 'Maintain a healthy weight' : 'Work towards a healthier weight',
      subtitle: `BMI ${profile.bmi}`,
      tag: healthy ? 'Healthy' : profile.bmi >= 25 ? 'High' : 'Low',
      tagTone: healthy ? 'good' : 'watch',
    });
  }

  if (profile.smoking) {
    items.push({
      key: 'smoking',
      title: 'Consider quitting smoking',
      subtitle: 'Smoking raises your risk across conditions',
      tag: 'Risk',
      tagTone: 'watch',
    });
  }

  if (profile.hypertension) {
    items.push({
      key: 'bp',
      title: 'Monitor your blood pressure',
      subtitle: 'Check regularly and keep your info updated',
      tag: 'Watch',
      tagTone: 'watch',
    });
  }

  return items;
}

/**
 * Badge count for the dashboard bell: consultations needing the patient's
 * attention (a practitioner has accepted and the chat is open).
 */
export async function fetchNotificationCount(): Promise<number> {
  const { count } = await supabase
    .from('consultations')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');
  return count ?? 0;
}
