import { useEffect, useState } from 'react';
import { autoEnableRelevantReminders } from '../lib/autoReminders';
import { getNotifPromptSeen, setNotifPromptSeen } from '../lib/notificationPrompt';
import { getReminderPermissionStatus, requestReminderPermission } from '../lib/reminderNotifications';
import { NotificationPrimer } from './NotificationPrimer';

/**
 * Asks for notification permission ONCE for the whole app, the first time a
 * signed-in user reaches the main area. Mounted inside each role's tab
 * navigator. After the first ask (allowed or not) it never prompts again, and
 * if permission is already decided at the OS level it stays silent.
 */
export function NotificationGate() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (await getNotifPromptSeen()) return;
      const status = await getReminderPermissionStatus();
      if (status === 'undetermined') {
        if (!cancelled) setVisible(true);
      } else {
        // Already granted or denied at the OS level — nothing to ask.
        await setNotifPromptSeen();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onAllow = async () => {
    setVisible(false);
    await setNotifPromptSeen();
    const granted = await requestReminderPermission();
    // The moment they allow, switch on the reminders relevant to them so they
    // don't have to enable each one by hand.
    if (granted) await autoEnableRelevantReminders();
  };

  const onDismiss = async () => {
    setVisible(false);
    await setNotifPromptSeen();
  };

  return (
    <NotificationPrimer
      visible={visible}
      title="Stay on top of your health"
      body="Allow notifications so we can remind you about your medicines, appointments, results, and reminders, even when the app is closed. You can change this any time."
      onAllow={onAllow}
      onDismiss={onDismiss}
    />
  );
}
