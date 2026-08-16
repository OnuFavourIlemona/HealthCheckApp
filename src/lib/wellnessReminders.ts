import { cancelReminderNotification, scheduleYearlyReminder } from './reminderNotifications';
import { supabase } from './supabase';

const PATIENT_BIRTHDAY_MESSAGE =
  'Wishing you another year of good health. A great gift to yourself this month is a quick check-up.';
const PRACTITIONER_BIRTHDAY_MESSAGE =
  'Wishing you another year of good health and strength. Thank you for the care you give your patients every day.';

/**
 * Arms a once-a-year birthday alarm for the signed-in user, if they've given
 * a date of birth (collected on Health Info for patients, on the licence
 * form for practitioners) and don't already have one scheduled. Only ever
 * schedules once -- if their date of birth changes later, the profile save
 * screens are responsible for clearing birthday_notification_id so this
 * re-arms with the new date next time it runs.
 */
export async function ensureBirthdayReminder(): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return;

    const { data } = await supabase
      .from('profiles')
      .select('date_of_birth, role, birthday_notification_id')
      .eq('id', userId)
      .maybeSingle();
    if (!data?.date_of_birth || data.birthday_notification_id) return;

    const dob = new Date(data.date_of_birth);
    const message =
      data.role === 'medical_practitioner' ? PRACTITIONER_BIRTHDAY_MESSAGE : PATIENT_BIRTHDAY_MESSAGE;

    const notificationId = await scheduleYearlyReminder(
      'Happy birthday from HealthCheck',
      message,
      dob.getDate(),
      dob.getMonth(),
      9,
      0,
    );
    if (notificationId) {
      await supabase.from('profiles').update({ birthday_notification_id: notificationId }).eq('id', userId);
    }
  } catch {
    // Non-fatal.
  }
}

/**
 * Cancels the signed-in user's already-armed birthday alarm (if any) and
 * clears the reference, so the next call to ensureBirthdayReminder() re-arms
 * it against a freshly-saved date of birth instead of leaving a stale alarm
 * on the old date running alongside a new one.
 */
export async function clearBirthdayReminder(): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return;

    const { data } = await supabase
      .from('profiles')
      .select('birthday_notification_id')
      .eq('id', userId)
      .maybeSingle();
    if (!data?.birthday_notification_id) return;

    await cancelReminderNotification(data.birthday_notification_id);
    await supabase.from('profiles').update({ birthday_notification_id: null }).eq('id', userId);
  } catch {
    // Non-fatal.
  }
}
