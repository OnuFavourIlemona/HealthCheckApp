import { cancelReminderNotification, scheduleReminderNotification } from './reminderNotifications';
import { supabase } from './supabase';

export type PractitionerReminder = {
  id: string;
  title: string;
  notes: string | null;
  remind_at: string;
  completed_at: string | null;
  local_notification_id: string | null;
};

export async function fetchReminders(): Promise<PractitionerReminder[]> {
  const { data } = await supabase
    .from('practitioner_reminders')
    .select('id, title, notes, remind_at, completed_at, local_notification_id')
    .order('remind_at', { ascending: true });
  return data ?? [];
}

export async function addReminder(
  title: string,
  remindAt: Date,
  notes?: string,
): Promise<{ reminder: PractitionerReminder | null; error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { reminder: null, error: 'You must be signed in to add a reminder.' };

  // Schedule the device alarm first so we can store its id alongside the row.
  const notificationId =
    remindAt.getTime() > Date.now()
      ? await scheduleReminderNotification(title, notes, remindAt)
      : null;

  const { data, error } = await supabase
    .from('practitioner_reminders')
    .insert({
      professional_id: userId,
      title: title.trim(),
      notes: notes?.trim() || null,
      remind_at: remindAt.toISOString(),
      local_notification_id: notificationId,
    })
    .select('id, title, notes, remind_at, completed_at, local_notification_id')
    .single();

  if (error) {
    await cancelReminderNotification(notificationId);
    return { reminder: null, error: error.message };
  }
  return { reminder: data, error: null };
}

export async function toggleReminderComplete(
  reminder: PractitionerReminder,
): Promise<PractitionerReminder | null> {
  const completing = !reminder.completed_at;
  // A completed reminder shouldn't still buzz later.
  if (completing) await cancelReminderNotification(reminder.local_notification_id);

  const { data } = await supabase
    .from('practitioner_reminders')
    .update({ completed_at: completing ? new Date().toISOString() : null })
    .eq('id', reminder.id)
    .select('id, title, notes, remind_at, completed_at, local_notification_id')
    .single();
  return data ?? null;
}

export async function deleteReminder(reminder: PractitionerReminder): Promise<void> {
  await cancelReminderNotification(reminder.local_notification_id);
  await supabase.from('practitioner_reminders').delete().eq('id', reminder.id);
}
