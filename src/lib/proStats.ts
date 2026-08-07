import { supabase } from './supabase';

export type ProStats = {
  patientsAttended: number;
  activeConsultations: number;
  completedConsultations: number;
  averageRating: number | null;
  ratingCount: number;
  /** Naira earned, derived from completed consultations at the standard fee. */
  earnings: number;
  /** Consultations accepted per day over the last 14 days, oldest first. */
  dailyCounts: number[];
  /** Ratings received, chronological. */
  ratingTrend: number[];
};

const TREND_DAYS = 14;

export const EMPTY_PRO_STATS: ProStats = {
  patientsAttended: 0,
  activeConsultations: 0,
  completedConsultations: 0,
  averageRating: null,
  ratingCount: 0,
  earnings: 0,
  dailyCounts: Array(TREND_DAYS).fill(0),
  ratingTrend: [],
};

/** Buckets ISO timestamps into per-day counts for the trailing window. */
function dailyBuckets(timestamps: string[]): number[] {
  const counts = Array(TREND_DAYS).fill(0);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  for (const iso of timestamps) {
    const day = new Date(iso);
    day.setHours(0, 0, 0, 0);
    const daysAgo = Math.round((startOfToday.getTime() - day.getTime()) / 86_400_000);
    if (daysAgo >= 0 && daysAgo < TREND_DAYS) {
      counts[TREND_DAYS - 1 - daysAgo] += 1;
    }
  }
  return counts;
}

/** Standard payout per completed consultation, in naira. */
export const CONSULTATION_FEE = 5000;

export async function fetchProStats(): Promise<ProStats> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return EMPTY_PRO_STATS;

  const [{ data: consultations }, { data: ratings }] = await Promise.all([
    supabase
      .from('consultations')
      .select('patient_id, status, accepted_at, created_at')
      .eq('professional_id', userId),
    supabase
      .from('consultation_ratings')
      .select('rating, created_at')
      .eq('professional_id', userId)
      .order('created_at', { ascending: true }),
  ]);

  const rows = consultations ?? [];
  const uniquePatients = new Set(rows.map((r) => r.patient_id));
  const active = rows.filter((r) => r.status === 'active').length;
  const completed = rows.filter((r) => r.status === 'completed').length;

  const ratingRows = ratings ?? [];
  const averageRating =
    ratingRows.length > 0
      ? ratingRows.reduce((sum, r) => sum + (r.rating as number), 0) / ratingRows.length
      : null;

  return {
    patientsAttended: uniquePatients.size,
    activeConsultations: active,
    completedConsultations: completed,
    averageRating,
    ratingCount: ratingRows.length,
    earnings: completed * CONSULTATION_FEE,
    dailyCounts: dailyBuckets(
      rows.map((r) => (r.accepted_at as string | null) ?? (r.created_at as string)),
    ),
    ratingTrend: ratingRows.map((r) => r.rating as number),
  };
}

/**
 * Tier thresholds by completed consultations. Kept here so the dashboard and
 * any future payout logic agree on the same rule.
 */
export function tierFor(completed: number): { name: string; next: number | null } {
  if (completed >= 100) return { name: 'Gold', next: null };
  if (completed >= 40) return { name: 'Silver', next: 100 };
  if (completed >= 10) return { name: 'Bronze', next: 40 };
  return { name: 'Starter', next: 10 };
}

export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG')}`;
}
