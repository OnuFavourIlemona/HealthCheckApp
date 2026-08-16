import { cancelReminderNotification, scheduleReminderNotification } from './reminderNotifications';
import { friendlyError } from './errors';
import { supabase } from './supabase';

export type MyLabBooking = {
  id: string;
  pharmacy_id: string;
  pharmacy_name: string;
  pharmacy_address: string | null;
  pharmacy_phone: string | null;
  pharmacy_latitude: number | null;
  pharmacy_longitude: number | null;
  test_type: string;
  mode: 'home' | 'walk_in';
  status: 'pending' | 'accepted' | 'completed' | 'declined';
  created_at: string;
  address_requested_at: string | null;
  patient_address: string | null;
  /** Walk-in only: the slot the pharmacist offered. */
  appointment_time: string | null;
  /** Set once the patient has switched on a reminder for their appointment. */
  reminder_notification_id: string | null;
};

export async function fetchMyLabBookings(): Promise<MyLabBooking[]> {
  const { data, error } = await supabase.rpc('get_my_lab_bookings');
  if (error) return [];
  return (data as MyLabBooking[]) ?? [];
}

/** Sends the patient's address to the pharmacy, once it has asked for one. */
export async function submitBookingAddress(
  id: string,
  address: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase.rpc('submit_booking_address', {
    p_booking_id: id,
    p_address: address,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, error: null };
}

/**
 * Schedules a local alarm for the patient's own walk-in appointment and
 * remembers it on the booking, so the toggle still shows "on" next time they
 * open the app and can be switched off from any screen showing this booking.
 */
export async function enableBookingReminder(
  booking: MyLabBooking,
): Promise<{ ok: boolean; error: string | null }> {
  if (!booking.appointment_time) return { ok: false, error: 'No appointment time set yet.' };
  const fireAt = new Date(booking.appointment_time);
  if (fireAt.getTime() <= Date.now()) return { ok: false, error: 'That appointment time has already passed.' };

  const notificationId = await scheduleReminderNotification(
    'Lab appointment today',
    `Time to head to ${booking.pharmacy_name} for your ${booking.test_type.replace(/_/g, ' ')} test.`,
    fireAt,
  );

  const { error } = await supabase.rpc('set_booking_reminder', {
    p_booking_id: booking.id,
    p_notification_id: notificationId,
  });
  if (error) {
    await cancelReminderNotification(notificationId);
    return { ok: false, error: friendlyError(error) };
  }
  return { ok: true, error: null };
}

export async function disableBookingReminder(
  booking: MyLabBooking,
): Promise<{ ok: boolean; error: string | null }> {
  await cancelReminderNotification(booking.reminder_notification_id);
  const { error } = await supabase.rpc('set_booking_reminder', {
    p_booking_id: booking.id,
    p_notification_id: null,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, error: null };
}
