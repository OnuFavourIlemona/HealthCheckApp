import { supabase } from './supabase';

export type ProStats = {
  patientsAttended: number;
  activeConsultations: number;
  completedConsultations: number;
  averageRating: number | null;
  ratingCount: number;
  /** Naira earned, summed across every completed consultation -- each one priced by its own rating. */
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

/**
 * Practitioner payout model. Each completed consultation earns a share of the
 * patient consult fee, adjusted for the quality of care (its rating) and how
 * quickly it was accepted, then lifted by the practitioner's loyalty tier. Every
 * lever is a constant here so it can be tuned in one place without touching the
 * maths. See docs/PRACTITIONER_PAYOUT.md for the full write-up.
 */
export const PAYOUT_CONFIG = {
  /** What a patient is charged for a standard consult — this funds the payout. */
  baseConsultFee: 2000,
  /** The platform's cut, which keeps the service running. */
  platformCommission: 0.25,
  /** Paid on top when the consult is accepted quickly. */
  responsivenessBonus: 200,
  /** "Quick" means accepted within this many seconds (10 minutes). */
  fastAcceptSeconds: 600,
  /** A consult's star rating (1..5) maps linearly onto this multiplier band. */
  qualityMin: 0.9,
  qualityMax: 1.1,
  /** Loyalty uplift by tier, applied to every consult once the tier is reached. */
  tierUplift: { Starter: 0, Bronze: 0.05, Silver: 0.1, Gold: 0.15 } as Record<string, number>,
};

/** Quality multiplier from a consult's star rating (1★ → 0.9, 5★ → 1.1, unrated → 1.0). */
export function qualityMultiplier(rating: number | null): number {
  if (rating == null) return 1;
  const clamped = Math.max(1, Math.min(5, rating));
  return (
    PAYOUT_CONFIG.qualityMin +
    ((clamped - 1) / 4) * (PAYOUT_CONFIG.qualityMax - PAYOUT_CONFIG.qualityMin)
  );
}

/** Seconds between a consult being created and accepted, or null if unknown. */
export function acceptSeconds(createdAt: string | null, acceptedAt: string | null): number | null {
  if (!createdAt || !acceptedAt) return null;
  return (new Date(acceptedAt).getTime() - new Date(createdAt).getTime()) / 1000;
}

/**
 * Naira a single completed consultation pays: the fee after commission, scaled
 * by quality, plus a responsiveness bonus, then lifted by the loyalty tier.
 */
export function computeConsultPayout(
  rating: number | null,
  acceptedInSeconds: number | null,
  tierName = 'Starter',
): number {
  const afterCommission = PAYOUT_CONFIG.baseConsultFee * (1 - PAYOUT_CONFIG.platformCommission);
  const quality = qualityMultiplier(rating);
  const fast = acceptedInSeconds != null && acceptedInSeconds <= PAYOUT_CONFIG.fastAcceptSeconds;
  const beforeTier = afterCommission * quality + (fast ? PAYOUT_CONFIG.responsivenessBonus : 0);
  const uplift = PAYOUT_CONFIG.tierUplift[tierName] ?? 0;
  return Math.round(beforeTier * (1 + uplift));
}

export async function fetchProStats(): Promise<ProStats> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return EMPTY_PRO_STATS;

  const [{ data: consultations }, { data: ratings }] = await Promise.all([
    supabase
      .from('consultations')
      .select('id, patient_id, status, accepted_at, created_at')
      .eq('professional_id', userId),
    supabase
      .from('consultation_ratings')
      .select('consultation_id, rating, created_at')
      .eq('professional_id', userId)
      .order('created_at', { ascending: true }),
  ]);

  const rows = consultations ?? [];
  const uniquePatients = new Set(rows.map((r) => r.patient_id));
  const active = rows.filter((r) => r.status === 'active').length;
  const completedRows = rows.filter((r) => r.status === 'completed');

  const ratingRows = ratings ?? [];
  const ratingByConsultation = new Map<string, number>(
    ratingRows.map((r) => [r.consultation_id as string, r.rating as number]),
  );
  const averageRating =
    ratingRows.length > 0
      ? ratingRows.reduce((sum, r) => sum + (r.rating as number), 0) / ratingRows.length
      : null;

  const tierName = tierFor(completedRows.length).name;
  const earnings = completedRows.reduce((sum, c) => {
    const rating = ratingByConsultation.get(c.id as string) ?? null;
    const secs = acceptSeconds(
      (c.created_at as string) ?? null,
      (c.accepted_at as string | null) ?? null,
    );
    return sum + computeConsultPayout(rating, secs, tierName);
  }, 0);

  return {
    patientsAttended: uniquePatients.size,
    activeConsultations: active,
    completedConsultations: completedRows.length,
    averageRating,
    ratingCount: ratingRows.length,
    earnings,
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
