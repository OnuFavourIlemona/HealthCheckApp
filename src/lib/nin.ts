import { supabase } from './supabase';

/**
 * Stores the user's NIN, encrypted at rest. The plaintext is sent once over
 * HTTPS to the store_nin() database function, which encrypts it with a key
 * held in Supabase Vault (never in a table or in code) and keeps only the
 * ciphertext. The app can never read it back -- only an admin can, via the
 * service-role-only admin_decrypt_nin() function, for dispute resolution.
 */
export async function storeNin(nin: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('store_nin', { nin: nin.trim() });
  return { error: error?.message ?? null };
}

/** Whether the signed-in user has provided their NIN (gates ProConnect). */
export async function hasProvidedNin(): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return false;
  const { data } = await supabase
    .from('profiles')
    .select('nin_provided_at')
    .eq('id', userId)
    .maybeSingle();
  return data?.nin_provided_at != null;
}
