import { cancelReminderNotification, scheduleDailyReminder } from './reminderNotifications';
import { supabase } from './supabase';

/**
 * Patient-set medicine reminders. Nigerian dosing instructions from a
 * pharmacy commonly work as one dosage taken at more than one time of day
 * ("two in the morning and two at night") or once every 24 hours, so a
 * reminder is one drug + one dosage + one or more times, each time getting
 * its own repeating daily alarm.
 */

export type DrugReminderTime = { hour: number; minute: number };

export type DrugReminderRow = {
  id: string;
  drug_name: string;
  dosage: string;
  times: DrugReminderTime[];
  notification_ids: string[];
};

export async function fetchDrugReminders(): Promise<DrugReminderRow[]> {
  const { data } = await supabase
    .from('drug_reminders')
    .select('id, drug_name, dosage, times, notification_ids')
    .order('created_at', { ascending: true });
  return (data as DrugReminderRow[]) ?? [];
}

async function scheduleAll(
  drugName: string,
  dosage: string,
  times: DrugReminderTime[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const t of times) {
    const id = await scheduleDailyReminder(
      'Time for your medicine',
      `Take ${dosage} of ${drugName} now.`,
      t.hour,
      t.minute,
    );
    if (id) ids.push(id);
  }
  return ids;
}

export async function addDrugReminder(
  drugName: string,
  dosage: string,
  times: DrugReminderTime[],
): Promise<{ reminder: DrugReminderRow | null; error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { reminder: null, error: 'You must be signed in to add a reminder.' };
  if (times.length === 0) return { reminder: null, error: 'Add at least one time.' };

  const notificationIds = await scheduleAll(drugName, dosage, times);

  const { data, error } = await supabase
    .from('drug_reminders')
    .insert({
      user_id: userId,
      drug_name: drugName,
      dosage,
      times,
      notification_ids: notificationIds,
    })
    .select('id, drug_name, dosage, times, notification_ids')
    .single();

  if (error) {
    await Promise.all(notificationIds.map((id) => cancelReminderNotification(id)));
    return { reminder: null, error: error.message };
  }
  return { reminder: data as DrugReminderRow, error: null };
}

/** Cancels the old alarms and reschedules fresh ones for the edited details. */
export async function updateDrugReminder(
  row: DrugReminderRow,
  drugName: string,
  dosage: string,
  times: DrugReminderTime[],
): Promise<{ reminder: DrugReminderRow | null; error: string | null }> {
  if (times.length === 0) return { reminder: null, error: 'Add at least one time.' };

  await Promise.all((row.notification_ids ?? []).map((id) => cancelReminderNotification(id)));
  const notificationIds = await scheduleAll(drugName, dosage, times);

  const { data, error } = await supabase
    .from('drug_reminders')
    .update({ drug_name: drugName, dosage, times, notification_ids: notificationIds })
    .eq('id', row.id)
    .select('id, drug_name, dosage, times, notification_ids')
    .single();

  if (error) {
    await Promise.all(notificationIds.map((id) => cancelReminderNotification(id)));
    return { reminder: null, error: error.message };
  }
  return { reminder: data as DrugReminderRow, error: null };
}

export async function deleteDrugReminder(row: DrugReminderRow): Promise<void> {
  await Promise.all((row.notification_ids ?? []).map((id) => cancelReminderNotification(id)));
  await supabase.from('drug_reminders').delete().eq('id', row.id);
}
