import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'healthcheck.notifPromptSeen';

/** True once the app has asked for notification permission (allowed or not). */
export async function getNotifPromptSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setNotifPromptSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, 'true');
  } catch {
    // Non-fatal: worst case the primer shows once more next launch.
  }
}
