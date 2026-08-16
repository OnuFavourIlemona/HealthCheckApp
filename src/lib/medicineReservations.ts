import { friendlyError } from './errors';
import { supabase } from './supabase';

export type ReservationStatus = 'pending' | 'ready' | 'collected' | 'cancelled';

export type PharmacyReservation = {
  id: string;
  patient_name: string;
  medicine_name: string;
  status: ReservationStatus;
  created_at: string;
};

/** A short human code for a reservation, matching what the pharmacy is shown. */
export function reservationCode(id: string): string {
  return id.slice(0, 4).toUpperCase();
}

/** Patient asks a pharmacy to hold a medicine. Returns the new reservation id. */
export async function requestMedicineHold(
  medicineId: string,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('request_medicine_hold', {
    p_medicine_id: medicineId,
  });
  if (error) return { id: null, error: friendlyError(error) };
  const row = Array.isArray(data) ? data[0] : data;
  return { id: (row?.id as string) ?? null, error: null };
}

export async function fetchPharmacyReservations(): Promise<PharmacyReservation[]> {
  const { data, error } = await supabase.rpc('get_pharmacy_reservations');
  if (error) return [];
  return (data as PharmacyReservation[]) ?? [];
}

export async function setReservationStatus(
  id: string,
  status: Exclude<ReservationStatus, 'pending'>,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase.rpc('set_reservation_status', { p_id: id, p_status: status });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, error: null };
}

export type MyMedicineReservation = {
  id: string;
  pharmacy_id: string;
  pharmacy_name: string;
  pharmacy_address: string | null;
  pharmacy_phone: string | null;
  medicine_name: string;
  status: ReservationStatus;
  created_at: string;
};

export async function fetchMyMedicineReservations(): Promise<MyMedicineReservation[]> {
  const { data, error } = await supabase.rpc('get_my_medicine_reservations');
  if (error) return [];
  return (data as MyMedicineReservation[]) ?? [];
}
