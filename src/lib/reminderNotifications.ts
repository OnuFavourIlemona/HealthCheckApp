import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch {
  // Runs at import time; harmless no-op on platforms without the native module.
}

let androidChannelReady = false;

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android' || androidChannelReady) return;
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
  androidChannelReady = true;
}

/** Current OS permission status, without triggering the system prompt. */
export async function getReminderPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'undetermined';
  } catch {
    return 'undetermined';
  }
}

export async function requestReminderPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return true;
    const { status: requested } = await Notifications.requestPermissionsAsync();
    return requested === 'granted';
  } catch {
    return false;
  }
}

/** Schedules a local alarm-style notification for a future time. Returns the id needed to cancel it later. */
export async function scheduleReminderNotification(
  title: string,
  body: string | undefined,
  fireAt: Date,
): Promise<string | null> {
  try {
    const granted = await requestReminderPermission();
    if (!granted) return null;
    await ensureAndroidChannel();

    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
        channelId: Platform.OS === 'android' ? 'reminders' : undefined,
      },
    });
  } catch {
    // Platforms without local-notification support (e.g. web) shouldn't
    // block saving the reminder -- it just won't alarm there.
    return null;
  }
}

/**
 * Schedules a reminder that repeats every day at the given time. Used for the
 * health-habit reminders ("Have you drunk water today?"). Returns the id needed
 * to cancel it, or null on platforms without local notifications.
 */
export async function scheduleDailyReminder(
  title: string,
  body: string | undefined,
  hour: number,
  minute: number,
): Promise<string | null> {
  try {
    const granted = await requestReminderPermission();
    if (!granted) return null;
    await ensureAndroidChannel();

    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: Platform.OS === 'android' ? 'reminders' : undefined,
      },
    });
  } catch {
    return null;
  }
}

export async function cancelReminderNotification(notificationId: string | null): Promise<void> {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Nothing to clean up if the platform never scheduled one.
  }
}

/** IDs of every alarm still armed with the OS right now (survives across app opens, not across reinstall). */
export async function getScheduledNotificationIds(): Promise<Set<string>> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return new Set(scheduled.map((n) => n.identifier));
  } catch {
    return new Set();
  }
}
