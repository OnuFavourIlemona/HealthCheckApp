import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

// EAS project id (from app.json extra.eas.projectId) — required by Expo to
// mint a push token for a standalone build.
const EAS_PROJECT_ID = '5458b9a2-c318-41b4-a609-3278a171f64e';

/**
 * Registers this device for push notifications and saves the Expo push token
 * on the signed-in user's profile. A database trigger then sends a push to
 * that token whenever a notification row is created, so alerts reach the
 * phone even when the app is closed. Safe to call repeatedly; fails quietly
 * on web, simulators, or when permission is denied.
 */
export async function registerForPushNotifications(): Promise<void> {
  try {
    if (!Device.isDevice) return; // push tokens only work on real hardware

    const { status } = await Notifications.getPermissionsAsync();
    let finalStatus = status;
    if (status !== 'granted') {
      finalStatus = (await Notifications.requestPermissionsAsync()).status;
    }
    if (finalStatus !== 'granted') return;

    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
    const token = tokenResult.data;

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (userId && token) {
      await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
    }
  } catch {
    // Non-fatal — the in-app notification feed still works without push.
  }
}
