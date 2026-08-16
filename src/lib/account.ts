import { supabase } from './supabase';

/**
 * Deletes the signed-in user's account. Nothing is actually removed from the
 * database -- we mark the profile deactivated so their history stays intact
 * for medical and audit purposes, but the account can no longer sign in and
 * no longer appears anywhere in the app. Requires the current password so a
 * phone left unlocked can't be used to delete someone else's account.
 */
export async function deleteAccount(password: string): Promise<{ error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const email = sessionData.session?.user.email;
  const userId = sessionData.session?.user.id;
  if (!email || !userId) return { error: 'You must be signed in to delete your account.' };

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return { error: 'Your password is incorrect.' };

  const { error } = await supabase
    .from('profiles')
    .update({ deactivated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) return { error: error.message };

  await supabase.auth.signOut();
  return { error: null };
}
