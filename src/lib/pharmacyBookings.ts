import { friendlyError } from './errors';
import { supabase } from './supabase';

export type PharmacyBookingStatus = 'pending' | 'accepted' | 'completed' | 'declined';

export type PharmacyBooking = {
  id: string;
  patient_id: string;
  patient_name: string;
  test_type: string;
  mode: string;
  status: PharmacyBookingStatus;
  created_at: string;
  address_requested_at: string | null;
  /** Only ever populated while the booking is still open -- the RPC hides it once accepted collection is done. */
  patient_address: string | null;
  /** Walk-in only: the slot the pharmacist offered the patient. */
  appointment_time: string | null;
};

export const LAB_TEST_LABELS: Record<string, string> = {
  blood_sugar: 'Blood Sugar (Fasting)',
  full_blood_count: 'Full Blood Count',
  lipid_panel: 'Lipid Panel',
  malaria_typhoid: 'Malaria + Typhoid',
  blood_pressure: 'Blood Pressure Check',
  kidney_function: 'Kidney Function',
};

export function labTestLabel(key: string): string {
  return LAB_TEST_LABELS[key] ?? key;
}

/** Bookings for the signed-in pharmacy owner, newest and most-urgent first. */
export async function fetchPharmacyBookings(): Promise<PharmacyBooking[]> {
  const { data, error } = await supabase.rpc('get_pharmacy_bookings');
  if (error) return [];
  return (data as PharmacyBooking[]) ?? [];
}

/** Accept, decline, or complete a booking, which also notifies the patient. */
export async function setLabBookingStatus(
  id: string,
  status: Exclude<PharmacyBookingStatus, 'pending'>,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase.rpc('set_lab_booking_status', {
    p_booking_id: id,
    p_status: status,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, error: null };
}

/** Asks the patient for their address, for an accepted home-collection booking. */
export async function requestBookingAddress(id: string): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase.rpc('request_booking_address', { p_booking_id: id });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, error: null };
}

/** Offers the patient a specific slot for an accepted walk-in booking. */
export async function setBookingAppointmentTime(
  id: string,
  appointmentTime: Date,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase.rpc('set_booking_appointment_time', {
    p_booking_id: id,
    p_appointment_time: appointmentTime.toISOString(),
  });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, error: null };
}
