import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BounceIn } from '../components/ui/BounceIn';
import { PatternBackground } from '../components/ui/PatternBackground';
import {
  addPeriodLog,
  computePrediction,
  deletePeriodLog,
  fetchCycleSettings,
  fetchPeriodLogs,
  refreshPeriodReminders,
  saveCycleSettings,
  toISODate,
  type CycleSettings,
  type Flow,
  type PeriodLog,
} from '../lib/periodTracker';
import { getReminderPermissionStatus } from '../lib/reminderNotifications';
import { successHaptic } from '../lib/haptics';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PeriodTracker'>;

const FLOWS: { key: Flow; label: string }[] = [
  { key: 'light', label: 'Light' },
  { key: 'medium', label: 'Medium' },
  { key: 'heavy', label: 'Heavy' },
];

function niceDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

// The last 14 days, newest first, for choosing when a period started.
function recentDays(): { iso: string; day: number; weekday: string; isToday: boolean }[] {
  const out: { iso: string; day: number; weekday: string; isToday: boolean }[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i += 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push({
      iso: toISODate(d),
      day: d.getDate(),
      weekday: d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3),
      isToday: i === 0,
    });
  }
  return out;
}

export function PeriodTrackerScreen({ navigation }: Props) {
  const [logs, setLogs] = useState<PeriodLog[]>([]);
  const [settings, setSettings] = useState<CycleSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(toISODate(new Date()));
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const days = useMemo(() => recentDays(), []);

  const load = useCallback(async () => {
    const [logsData, settingsData] = await Promise.all([fetchPeriodLogs(), fetchCycleSettings()]);
    setLogs(logsData);
    setSettings(settingsData);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const prediction = useMemo(
    () => (settings ? computePrediction(logs, settings) : null),
    [logs, settings],
  );

  const logPeriod = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const { ok, error } = await addPeriodLog(selectedDate, selectedFlow);
    if (ok) {
      successHaptic();
      setSelectedFlow(null);
      setSelectedDate(toISODate(new Date()));
      await load();
      await refreshPeriodReminders();
      setMessage('Saved. Your prediction is updated.');
    } else {
      setMessage(error ?? 'Could not save. Please try again.');
    }
    setBusy(false);
  };

  const removeLog = async (log: PeriodLog) => {
    const previous = logs;
    setLogs((prev) => prev.filter((l) => l.id !== log.id));
    const ok = await deletePeriodLog(log.id);
    if (!ok) setLogs(previous);
    else await refreshPeriodReminders();
  };

  const onToggleReminders = async (value: boolean) => {
    setMessage(null);
    setSettings((s) => (s ? { ...s, reminders_enabled: value } : s));
    await saveCycleSettings({ reminders_enabled: value });
    // Schedules when permission is granted; requests it if still undecided.
    await refreshPeriodReminders();
    if (value) {
      const status = await getReminderPermissionStatus();
      if (status !== 'granted') {
        setMessage('To get reminders, turn on notifications for HealthCheck in your phone settings.');
      }
    }
  };

  const setDaysBefore = async (n: number) => {
    setSettings((s) => (s ? { ...s, reminder_days_before: n } : s));
    await saveCycleSettings({ reminder_days_before: n });
    await refreshPeriodReminders();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <PatternBackground />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Period Tracker</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading || !settings || !prediction ? (
        <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Prediction hero */}
          <View style={styles.hero}>
            {!prediction.hasData ? (
              <>
                <Text style={styles.heroBig}>Let's begin</Text>
                <Text style={styles.heroSub}>
                  Log the day your period started below. After a couple of months we can predict
                  your next one.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.heroLabel}>
                  {prediction.isLate ? 'Your period may be late' : 'Next period'}
                </Text>
                <Text style={styles.heroBig}>
                  {prediction.daysUntilNext === 0
                    ? 'Maybe today'
                    : `in ${prediction.daysUntilNext} day${prediction.daysUntilNext === 1 ? '' : 's'}`}
                </Text>
                <Text style={styles.heroSub}>
                  Around {niceDate(prediction.nextStart as string)} · you are on day{' '}
                  {prediction.cycleDay} of your cycle
                </Text>
                {prediction.fertileStart && prediction.fertileEnd ? (
                  <View style={styles.fertilePill}>
                    <MaterialCommunityIcons name="flower-outline" size={15} color={colors.white} />
                    <Text style={styles.fertileText}>
                      Fertile window around {niceDate(prediction.fertileStart)} to{' '}
                      {niceDate(prediction.fertileEnd)}
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </View>

          {/* Log a period */}
          <Text style={styles.sectionTitle}>Log your period</Text>
          <Text style={styles.sectionHint}>Tap the day it started.</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.daysRow}
          >
            {days.map((d) => {
              const active = selectedDate === d.iso;
              return (
                <Pressable
                  key={d.iso}
                  style={[styles.dayChip, active && styles.dayChipActive]}
                  onPress={() => setSelectedDate(d.iso)}
                >
                  <Text style={[styles.dayWeekday, active && styles.dayTextActive]}>{d.weekday}</Text>
                  <Text style={[styles.dayNumber, active && styles.dayTextActive]}>{d.day}</Text>
                  {d.isToday ? (
                    <Text style={[styles.dayToday, active && styles.dayTextActive]}>Today</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[styles.sectionHint, styles.flowLabel]}>How heavy is the flow? (optional)</Text>
          <View style={styles.flowRow}>
            {FLOWS.map((f) => {
              const active = selectedFlow === f.key;
              return (
                <Pressable
                  key={f.key}
                  style={[styles.flowChip, active && styles.flowChipActive]}
                  onPress={() => setSelectedFlow(active ? null : f.key)}
                >
                  <Text style={[styles.flowText, active && styles.flowTextActive]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable style={[styles.logButton, busy && styles.disabled]} onPress={logPeriod} disabled={busy}>
            {busy ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="add" size={18} color={colors.white} />
                <Text style={styles.logButtonText}>Log period on {niceDate(selectedDate)}</Text>
              </>
            )}
          </Pressable>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {/* Reminders */}
          <Text style={styles.sectionTitle}>Reminders</Text>
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextColumn}>
                <Text style={styles.toggleTitle}>Remind me before my period</Text>
                <Text style={styles.toggleBody}>
                  Get a gentle heads-up on your phone, even when the app is closed.
                </Text>
              </View>
              <Switch
                value={settings.reminders_enabled}
                onValueChange={onToggleReminders}
                trackColor={{ false: colors.border, true: colors.primaryGreen }}
                thumbColor={colors.white}
              />
            </View>
            {settings.reminders_enabled ? (
              <View style={styles.daysBeforeRow}>
                <Text style={styles.daysBeforeLabel}>Remind me</Text>
                {[1, 2, 3].map((n) => {
                  const active = settings.reminder_days_before === n;
                  return (
                    <Pressable
                      key={n}
                      style={[styles.daysBeforeChip, active && styles.daysBeforeChipActive]}
                      onPress={() => setDaysBefore(n)}
                    >
                      <Text style={[styles.daysBeforeChipText, active && styles.daysBeforeChipTextActive]}>
                        {n} day{n === 1 ? '' : 's'} before
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>

          {/* History */}
          {logs.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Your history</Text>
              {logs.map((log) => (
                <View key={log.id} style={styles.historyRow}>
                  <View style={styles.historyIcon}>
                    <MaterialCommunityIcons name="water" size={18} color={colors.darkAccentGreen} />
                  </View>
                  <View style={styles.historyTextColumn}>
                    <Text style={styles.historyDate}>{niceDate(log.start_date)}</Text>
                    {log.flow ? (
                      <Text style={styles.historyFlow}>
                        {log.flow.charAt(0).toUpperCase() + log.flow.slice(1)} flow
                      </Text>
                    ) : null}
                  </View>
                  <Pressable onPress={() => removeLog(log)} hitSlop={8} style={styles.historyDelete}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </Pressable>
                </View>
              ))}
            </>
          ) : null}

          <View style={styles.disclaimerCard}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.disclaimerText}>
              These dates are an estimate. Every body is different and cycles can change, so use it
              as a guide. Your information is private to you.
            </Text>
          </View>
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
  hero: {
    backgroundColor: colors.primaryGreen,
    borderRadius: 20,
    padding: 22,
    marginTop: 4,
  },
  heroLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  heroBig: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 28,
    color: colors.white,
    marginTop: 4,
  },
  heroSub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 6,
  },
  fertilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
    padding: 10,
    marginTop: 14,
  },
  fertileText: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.white,
  },
  sectionTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: 26,
  },
  sectionHint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  daysRow: {
    gap: 8,
    paddingVertical: 12,
    paddingRight: 8,
  },
  dayChip: {
    width: 58,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayChipActive: {
    backgroundColor: colors.primaryGreen,
    borderColor: colors.primaryGreen,
  },
  dayWeekday: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  dayNumber: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 18,
    color: colors.textPrimary,
    marginTop: 2,
  },
  dayToday: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 9.5,
    color: colors.darkAccentGreen,
    marginTop: 2,
  },
  dayTextActive: {
    color: colors.white,
  },
  flowLabel: {
    marginTop: 8,
  },
  flowRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  flowChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flowChipActive: {
    backgroundColor: colors.pillGreenBg,
    borderColor: colors.primaryGreen,
  },
  flowText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  flowTextActive: {
    color: colors.darkAccentGreen,
  },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primaryGreen,
    borderRadius: 26,
    height: 52,
    marginTop: 16,
  },
  disabled: {
    opacity: 0.6,
  },
  logButtonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14.5,
    color: colors.white,
  },
  message: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.darkAccentGreen,
    textAlign: 'center',
    marginTop: 12,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleTextColumn: {
    flex: 1,
  },
  toggleTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  toggleBody: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.textSecondary,
    marginTop: 2,
  },
  daysBeforeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  daysBeforeLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  daysBeforeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  daysBeforeChipActive: {
    backgroundColor: colors.primaryGreen,
    borderColor: colors.primaryGreen,
  },
  daysBeforeChipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  daysBeforeChipTextActive: {
    color: colors.white,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  historyIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyTextColumn: {
    flex: 1,
  },
  historyDate: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  historyFlow: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  historyDelete: {
    padding: 4,
  },
  disclaimerCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 22,
  },
  disclaimerText: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
  },
});
