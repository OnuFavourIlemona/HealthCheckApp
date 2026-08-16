import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ComponentProps } from 'react';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PatternBackground } from '../components/ui/PatternBackground';
import {
  disableHealthReminder,
  enableHealthReminder,
  fetchHealthReminders,
  type HealthReminderRow,
  type PlanReminder,
} from '../lib/healthReminders';
import { planFor } from '../lib/recommendationPlans';
import { getReminderPermissionStatus } from '../lib/reminderNotifications';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Reminders'>;
type MCIName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// The reminders a patient can manage, grouped by area. Factor-only plans (bp,
// weight, smoking) are left out to avoid duplicate entries.
const CATALOG: { planKey: string; title: string }[] = [
  { planKey: 'sleep', title: 'Sleep' },
  { planKey: 'diabetes', title: 'Diabetes' },
  { planKey: 'hypertension', title: 'Blood pressure' },
  { planKey: 'stroke', title: 'Stroke' },
  { planKey: 'kidney', title: 'Kidney' },
  { planKey: 'liver', title: 'Liver' },
];

function formatTimes(times: { hour: number; minute: number }[]): string {
  return times
    .map((t) => {
      const h12 = t.hour % 12 === 0 ? 12 : t.hour % 12;
      const ampm = t.hour < 12 ? 'am' : 'pm';
      return `${h12}:${t.minute.toString().padStart(2, '0')}${ampm}`;
    })
    .join(' and ');
}

export function RemindersScreen({ navigation }: Props) {
  const [rows, setRows] = useState<HealthReminderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');

  const load = useCallback(async () => {
    const [reminders, status] = await Promise.all([
      fetchHealthReminders(),
      getReminderPermissionStatus(),
    ]);
    setRows(reminders);
    setPermission(status);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const isOn = (planKey: string, reminderKey: string) =>
    rows.some((r) => r.plan_key === planKey && r.reminder_key === reminderKey);

  const onToggle = async (planKey: string, reminder: PlanReminder, on: boolean) => {
    const key = `${planKey}:${reminder.key}`;
    setBusyKey(key);
    if (on) {
      const row = await enableHealthReminder(planKey, reminder);
      if (row) setRows((prev) => [...prev.filter((r) => r.id !== row.id), row]);
    } else {
      const row = rows.find((r) => r.plan_key === planKey && r.reminder_key === reminder.key);
      if (row) {
        await disableHealthReminder(row);
        setRows((prev) => prev.filter((r) => r.id !== row.id));
      }
    }
    setBusyKey(null);
  };

  const onCount = rows.length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <PatternBackground />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>My Reminders</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            Switch any reminder on or off. When it is on, your phone nudges you every day, even when
            the app is closed. {onCount > 0 ? `${onCount} on right now.` : ''}
          </Text>

          {permission !== 'granted' ? (
            <View style={styles.permBanner}>
              <Ionicons name="notifications-off-outline" size={18} color="#C77B00" />
              <Text style={styles.permText}>
                Notifications are off for HealthCheck, so reminders will not show. Turn them on in
                your phone settings to start getting them.
              </Text>
            </View>
          ) : null}

          {CATALOG.map((group) => {
            const plan = planFor(group.planKey, null);
            const reminders = plan?.reminders ?? [];
            if (reminders.length === 0) return null;
            return (
              <View key={group.planKey} style={styles.group}>
                <Text style={styles.groupTitle}>{group.title}</Text>
                <View style={styles.card}>
                  {reminders.map((reminder, index) => {
                    const on = isOn(group.planKey, reminder.key);
                    const busy = busyKey === `${group.planKey}:${reminder.key}`;
                    return (
                      <View
                        key={reminder.key}
                        style={[styles.row, index > 0 && styles.rowSpacing]}
                      >
                        <View style={styles.rowIcon}>
                          <MaterialCommunityIcons
                            name={reminder.icon as MCIName}
                            size={20}
                            color={colors.darkAccentGreen}
                          />
                        </View>
                        <View style={styles.rowTextColumn}>
                          <Text style={styles.rowLabel}>{reminder.label}</Text>
                          <Text style={styles.rowMessage}>{reminder.message}</Text>
                          <Text style={styles.rowTime}>
                            {on ? `On, at ${formatTimes(reminder.times)}` : `Suggested for ${formatTimes(reminder.times)}`}
                          </Text>
                        </View>
                        <Switch
                          value={on}
                          onValueChange={(v) => onToggle(group.planKey, reminder, v)}
                          disabled={busy}
                          trackColor={{ true: colors.primaryGreen, false: colors.border }}
                          thumbColor={colors.white}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}

          <Text style={styles.footnote}>
            Period reminders are managed in the Period Tracker.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
  },
  loader: {
    marginTop: 80,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  intro: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  permBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF4E0',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  permText: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 17,
    color: '#9A6A10',
  },
  group: {
    marginTop: 22,
  },
  groupTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowSpacing: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextColumn: {
    flex: 1,
  },
  rowLabel: {
    fontFamily: fonts.headingMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  rowMessage: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rowTime: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    color: colors.darkAccentGreen,
    marginTop: 4,
  },
  footnote: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 24,
  },
});
