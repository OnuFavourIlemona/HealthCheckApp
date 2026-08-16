import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'healthcheck.hasOnboarded';

/** True once the user has seen the onboarding carousel or signed in at least once. */
export async function getHasOnboarded(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setHasOnboarded(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, 'true');
  } catch {
    // Non-fatal: worst case the user sees the onboarding carousel again.
  }
}
