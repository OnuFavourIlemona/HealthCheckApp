import { cancelReminderNotification, scheduleReminderNotification } from './reminderNotifications';
import { supabase } from './supabase';

export type Flow = 'light' | 'medium' | 'heavy';

export type PeriodLog = {
  id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string | null;
  flow: Flow | null;
};

export type CycleSettings = {
  cycle_length: number | null;
  period_length: number;
  reminders_enabled: boolean;
  reminder_days_before: number;
  notification_ids: string[];
};

export type CyclePrediction = {
  cycleLength: number;
  hasData: boolean;
  lastStart: string | null;
  nextStart: string | null;
  daysUntilNext: number | null;
  cycleDay: number | null;
  periodLength: number;
  fertileStart: string | null;
  fertileEnd: string | null;
  /** True when the predicted date has already passed (period may be late). */
  isLate: boolean;
};

const DEFAULT_CYCLE = 28;

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(a: Date, b: Date): number {
  const ms = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime() -
    new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  return Math.round(ms / 86400000);
}

export async function fetchPeriodLogs(): Promise<PeriodLog[]> {
  const { data } = await supabase
    .from('period_logs')
    .select('id, start_date, end_date, flow')
    .order('start_date', { ascending: false });
  return (data as PeriodLog[]) ?? [];
}

export async function addPeriodLog(
  startDate: string,
  flow: Flow | null,
): Promise<{ ok: boolean; error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { ok: false, error: 'Please sign in first.' };
  const { error } = await supabase
    .from('period_logs')
    .upsert({ user_id: userId, start_date: startDate, flow }, { onConflict: 'user_id,start_date' });
  return { ok: !error, error: error ? error.message : null };
}

export async function deletePeriodLog(id: string): Promise<boolean> {
  const { error } = await supabase.from('period_logs').delete().eq('id', id);
  return !error;
}

export async function fetchCycleSettings(): Promise<CycleSettings> {
  const { data } = await supabase
    .from('cycle_settings')
    .select('cycle_length, period_length, reminders_enabled, reminder_days_before, notification_ids')
    .maybeSingle();
  return {
    cycle_length: data?.cycle_length ?? null,
    period_length: data?.period_length ?? 5,
    reminders_enabled: data?.reminders_enabled ?? false,
    reminder_days_before: data?.reminder_days_before ?? 2,
    notification_ids: (data?.notification_ids as string[]) ?? [],
  };
}

export async function saveCycleSettings(patch: Partial<CycleSettings>): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return;
  await supabase
    .from('cycle_settings')
    .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
}

/** Predicts the next period from logged history, falling back to a 28-day cycle. */
export function computePrediction(logs: PeriodLog[], settings: CycleSettings): CyclePrediction {
  const periodLength = settings.period_length ?? 5;
  if (logs.length === 0) {
    return {
      cycleLength: settings.cycle_length ?? DEFAULT_CYCLE,
      hasData: false,
      lastStart: null,
      nextStart: null,
      daysUntilNext: null,
      cycleDay: null,
      periodLength,
      fertileStart: null,
      fertileEnd: null,
      isLate: false,
    };
  }

  // Oldest to newest for gap maths.
  const starts = [...logs].map((l) => l.start_date).sort();
  const dates = starts.map(parseDate);

  let cycleLength = settings.cycle_length ?? DEFAULT_CYCLE;
  if (dates.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i += 1) gaps.push(daysBetween(dates[i - 1], dates[i]));
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    cycleLength = Math.min(35, Math.max(21, Math.round(avg)));
  }

  const lastStartDate = dates[dates.length - 1];
  const today = new Date();

  let nextStartDate = addDays(lastStartDate, cycleLength);
  let isLate = false;
  // Roll forward if the predicted date is already in the past.
  while (daysBetween(today, nextStartDate) < 0) {
    isLate = true;
    nextStartDate = addDays(nextStartDate, cycleLength);
  }

  const ovulation = addDays(nextStartDate, -14);
  return {
    cycleLength,
    hasData: true,
    lastStart: toISODate(lastStartDate),
    nextStart: toISODate(nextStartDate),
    daysUntilNext: daysBetween(today, nextStartDate),
    cycleDay: daysBetween(lastStartDate, today) + 1,
    periodLength,
    fertileStart: toISODate(addDays(ovulation, -5)),
    fertileEnd: toISODate(addDays(ovulation, 1)),
    isLate,
  };
}

let periodRefreshInFlight: Promise<void> | null = null;

/**
 * Cancels any existing period alarms and schedules fresh ones for the next
 * predicted period, based on the current logs and settings. Saves the new
 * notification ids so they can be cancelled next time.
 */
export async function refreshPeriodReminders(): Promise<void> {
  // Splash and Login can both call this close together; share one in-flight
  // run so they never race and leave a duplicate alarm behind.
  if (periodRefreshInFlight) return periodRefreshInFlight;
  periodRefreshInFlight = runRefreshPeriodReminders();
  try {
    await periodRefreshInFlight;
  } finally {
    periodRefreshInFlight = null;
  }
}

async function runRefreshPeriodReminders(): Promise<void> {
  const settings = await fetchCycleSettings();
  // Always clear the old alarms first.
  await Promise.all((settings.notification_ids ?? []).map((id) => cancelReminderNotification(id)));

  if (!settings.reminders_enabled) {
    if ((settings.notification_ids ?? []).length > 0) await saveCycleSettings({ notification_ids: [] });
    return;
  }

  const logs = await fetchPeriodLogs();
  const prediction = computePrediction(logs, settings);
  const ids: string[] = [];

  if (prediction.nextStart) {
    const next = parseDate(prediction.nextStart);
    const heads = [
      { days: settings.reminder_days_before, isDayOf: false },
      { days: 0, isDayOf: true },
    ];
    for (const h of heads) {
      const fireAt = addDays(next, -h.days);
      fireAt.setHours(9, 0, 0, 0);
      if (fireAt.getTime() <= Date.now()) continue;
      const body = h.isDayOf
        ? 'Your period may start today. Take care of yourself.'
        : `Your period may start in about ${h.days} day${h.days === 1 ? '' : 's'}. A good time to get ready.`;
      const id = await scheduleReminderNotification('Period reminder', body, fireAt);
      if (id) ids.push(id);
    }
  }

  await saveCycleSettings({ notification_ids: ids });
}
