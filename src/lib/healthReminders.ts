import {
  cancelReminderNotification,
  getScheduledNotificationIds,
  scheduleDailyReminder,
} from './reminderNotifications';
import { supabase } from './supabase';

/**
 * Health-habit reminders. A recommendation plan can suggest daily habits (drink
 * water, wind down for sleep, take your BP reading). When a patient switches one
 * on, we schedule a repeating daily phone reminder so it nudges them even when
 * the app is closed, and we save it so it survives a restart.
 *
 * Note: local notifications only work in a real installed build, not Expo Go,
 * so every call here is wrapped to fail quietly.
 */

export type ReminderTime = { hour: number; minute: number };

/** A habit a plan can offer to remind the user about. */
export type PlanReminder = {
  key: string;
  /** Short title shown on the notification and the toggle. */
  label: string;
  /** The friendly nudge shown in the notification body. */
  message: string;
  /** One or more times a day to fire. */
  times: ReminderTime[];
  icon: string;
};

export type HealthReminderRow = {
  id: string;
  plan_key: string;
  reminder_key: string;
  message: string;
  times: ReminderTime[];
  notification_ids: string[];
};

export async function fetchHealthReminders(planKey?: string): Promise<HealthReminderRow[]> {
  let query = supabase
    .from('health_reminders')
    .select('id, plan_key, reminder_key, message, times, notification_ids');
  if (planKey) query = query.eq('plan_key', planKey);
  const { data } = await query;
  return (data as HealthReminderRow[]) ?? [];
}

async function scheduleAll(label: string, message: string, times: ReminderTime[]): Promise<string[]> {
  const ids: string[] = [];
  for (const t of times) {
    const id = await scheduleDailyReminder(label, message, t.hour, t.minute);
    if (id) ids.push(id);
  }
  return ids;
}

export async function enableHealthReminder(
  planKey: string,
  reminder: PlanReminder,
): Promise<HealthReminderRow | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return null;

  // Guard against double-enabling the same habit (e.g. a race between two
  // screens calling this at once) leaving an orphan alarm still armed.
  const { data: existing } = await supabase
    .from('health_reminders')
    .select('notification_ids')
    .eq('user_id', userId)
    .eq('plan_key', planKey)
    .eq('reminder_key', reminder.key)
    .maybeSingle();
  if (existing?.notification_ids?.length) {
    await Promise.all(
      (existing.notification_ids as string[]).map((id) => cancelReminderNotification(id)),
    );
  }

  const notificationIds = await scheduleAll(reminder.label, reminder.message, reminder.times);

  const { data, error } = await supabase
    .from('health_reminders')
    .upsert(
      {
        user_id: userId,
        plan_key: planKey,
        reminder_key: reminder.key,
        message: reminder.message,
        times: reminder.times,
        notification_ids: notificationIds,
      },
      { onConflict: 'user_id,plan_key,reminder_key' },
    )
    .select('id, plan_key, reminder_key, message, times, notification_ids')
    .single();

  if (error) {
    // Roll back the alarms we just set so we don't leave orphans buzzing.
    await Promise.all(notificationIds.map((id) => cancelReminderNotification(id)));
    return null;
  }
  return data as HealthReminderRow;
}

export async function disableHealthReminder(row: HealthReminderRow): Promise<void> {
  await Promise.all((row.notification_ids ?? []).map((id) => cancelReminderNotification(id)));
  await supabase.from('health_reminders').delete().eq('id', row.id);
}

let reschedulingInFlight: Promise<void> | null = null;

/**
 * Re-arms any saved reminder whose alarm the OS has actually lost (a fresh
 * install, or a phone that cleared scheduled alarms). Called on every login
 * and app open, so it only touches rows that are actually missing an alarm --
 * otherwise a reminder that is still correctly scheduled would get cancelled
 * and re-added on every launch, which is how duplicates used to sneak in.
 */
export async function rescheduleAllHealthReminders(): Promise<void> {
  // Two call sites (Splash on cold start, Login on sign-in) can fire close
  // together; share one in-flight run so they never race over the same rows.
  if (reschedulingInFlight) return reschedulingInFlight;
  reschedulingInFlight = (async () => {
    try {
      const [rows, armed] = await Promise.all([fetchHealthReminders(), getScheduledNotificationIds()]);
      for (const row of rows) {
        const ids = row.notification_ids ?? [];
        const stillArmed = ids.length > 0 && ids.every((id) => armed.has(id));
        if (stillArmed) continue; // nothing to do -- the OS still has this reminder scheduled

        await Promise.all(ids.map((id) => cancelReminderNotification(id)));
        const label = row.message.split('?')[0].slice(0, 40) || 'HealthCheck reminder';
        const newIds = await scheduleAll(label, row.message, row.times ?? []);
        await supabase.from('health_reminders').update({ notification_ids: newIds }).eq('id', row.id);
      }
    } finally {
      reschedulingInFlight = null;
    }
  })();
  return reschedulingInFlight;
}
