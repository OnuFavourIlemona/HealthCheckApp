import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

/**
 * Lets the user pick a photo, uploads it to their own folder in the public
 * `avatars` bucket, saves the public URL on their profile, and returns it.
 * Returns { url: null, error: null } when the user cancels the picker.
 */
export async function pickAndUploadAvatar(): Promise<{ url: string | null; error: string | null }> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { url: null, error: 'We need permission to open your photos.' };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6,
  });
  if (result.canceled || !result.assets?.[0]) return { url: null, error: null };

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { url: null, error: 'You must be signed in.' };

  try {
    const uri = result.assets[0].uri;
    const arrayBuffer = await fetch(uri).then((r) => r.arrayBuffer());
    // Timestamped filename so the public CDN URL changes each upload and
    // isn't served stale from cache.
    const path = `${userId}/avatar_${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
    if (uploadError) return { url: null, error: uploadError.message };

    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = publicUrlData.publicUrl;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: url })
      .eq('id', userId);
    if (updateError) return { url: null, error: updateError.message };

    return { url, error: null };
  } catch {
    return { url: null, error: 'Could not upload that photo. Please try again.' };
  }
}

/** Clears the saved profile photo, so the app falls back to Gravatar or initials. */
export async function removeAvatar(): Promise<{ error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { error: 'You must be signed in.' };

  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId);
  return { error: error?.message ?? null };
}
