import { friendlyError } from './errors';
import { supabase } from './supabase';

export type Medicine = {
  id: string;
  pharmacy_id: string;
  name: string;
  form: string | null;
  price: number | null;
  in_stock: boolean;
};

export type PharmacyLite = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  is_verified: boolean;
};

export type MedicineSearchResult = {
  id: string;
  name: string;
  form: string | null;
  price: number | null;
  in_stock: boolean;
  pharmacy: PharmacyLite;
  /** Straight-line distance in km from the user, when a location is known. */
  distanceKm: number | null;
};

/** The signed-in owner's pharmacy id, or null if they haven't created one yet. */
export async function fetchMyPharmacyId(): Promise<string | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return null;
  const { data } = await supabase
    .from('pharmacies')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function fetchMyMedicines(pharmacyId: string): Promise<Medicine[]> {
  const { data } = await supabase
    .from('pharmacy_medicines')
    .select('id, pharmacy_id, name, form, price, in_stock')
    .eq('pharmacy_id', pharmacyId)
    .order('name', { ascending: true });
  return (data as Medicine[]) ?? [];
}

export async function addMedicine(
  pharmacyId: string,
  input: { name: string; form: string | null; price: number | null; in_stock: boolean },
): Promise<{ medicine: Medicine | null; error: string | null }> {
  const { data, error } = await supabase
    .from('pharmacy_medicines')
    .insert({
      pharmacy_id: pharmacyId,
      name: input.name.trim(),
      form: input.form?.trim() || null,
      price: input.price,
      in_stock: input.in_stock,
    })
    .select('id, pharmacy_id, name, form, price, in_stock')
    .single();
  if (error) return { medicine: null, error: friendlyError(error) };
  return { medicine: data as Medicine, error: null };
}

export async function setMedicineStock(id: string, inStock: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('pharmacy_medicines')
    .update({ in_stock: inStock, updated_at: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

export async function deleteMedicine(id: string): Promise<boolean> {
  const { error } = await supabase.from('pharmacy_medicines').delete().eq('id', id);
  return !error;
}

function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Patient-facing search: which pharmacies have this medicine in stock. Verified
 * pharmacies come first, then the nearest, then the cheapest that set a price.
 */
export async function searchMedicines(
  query: string,
  userLocation: { latitude: number; longitude: number } | null,
): Promise<MedicineSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const { data, error } = await supabase
    .from('pharmacy_medicines')
    .select(
      'id, name, form, price, in_stock, pharmacies!inner(id, name, address, phone, latitude, longitude, is_verified)',
    )
    .ilike('name', `%${q}%`)
    .eq('in_stock', true)
    .limit(60);
  if (error || !data) return [];

  const results: MedicineSearchResult[] = (data as unknown as (Medicine & { pharmacies: PharmacyLite })[]).map(
    (row) => {
      const pharmacy = row.pharmacies;
      const distanceKm =
        userLocation && pharmacy.latitude != null && pharmacy.longitude != null
          ? haversineKm(userLocation, {
              latitude: pharmacy.latitude,
              longitude: pharmacy.longitude,
            })
          : null;
      return {
        id: row.id,
        name: row.name,
        form: row.form,
        price: row.price,
        in_stock: row.in_stock,
        pharmacy,
        distanceKm,
      };
    },
  );

  results.sort((a, b) => {
    if (a.pharmacy.is_verified !== b.pharmacy.is_verified) return a.pharmacy.is_verified ? -1 : 1;
    if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
    if (a.distanceKm != null) return -1;
    if (b.distanceKm != null) return 1;
    if (a.price != null && b.price != null) return a.price - b.price;
    return 0;
  });

  return results;
}
