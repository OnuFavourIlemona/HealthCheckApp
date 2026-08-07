import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AddReminderSheet } from '../../components/AddReminderSheet';
import { BounceIn } from '../../components/ui/BounceIn';
import { PatternBackground } from '../../components/ui/PatternBackground';
import type { Consultation } from '../../lib/consultations';
import {
  addReminder,
  deleteReminder,
  fetchReminders,
  toggleReminderComplete,
  type PractitionerReminder,
} from '../../lib/practitionerReminders';
import { supabase } from '../../lib/supabase';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts } from '../../theme';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** 2 days back through 4 days ahead, so practitioners can both check history and plan upcoming days. */
function buildWeek(): { label: string; dayNum: number; offset: number }[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const offset = i - 2;
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    return {
      label: offset === 0 ? 'Today' : DAY_NAMES[date.getDay()],
      dayNum: date.getDate(),
      offset,
    };
  });
}

function sameDay(iso: string, offset: number): boolean {
  const target = new Date();
  target.setDate(target.getDate() + offset);
  target.setHours(0, 0, 0, 0);
  const value = new Date(iso);
  value.setHours(0, 0, 0, 0);
  return value.getTime() === target.getTime();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dayLabelFor(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function ProScheduleScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const week = buildWeek();
  const [selectedOffset, setSelectedOffset] = useState(0);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [reminders, setReminders] = useState<PractitionerReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [addingReminder, setAddingReminder] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setLoading(false);
      return;
    }
    const [{ data: consultationRows }, reminderRows] = await Promise.all([
      supabase
        .from('consultations')
        .select('*')
        .eq('professional_id', userId)
        .order('accepted_at', { ascending: true }),
      fetchReminders(),
    ]);
    setConsultations((consultationRows ?? []) as Consultation[]);
    setReminders(reminderRows);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const consultationsForDay = consultations.filter((c) =>
    sameDay(c.accepted_at ?? c.created_at, selectedOffset),
  );
  const remindersForDay = reminders
    .filter((r) => sameDay(r.remind_at, selectedOffset))
    .sort((a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime());

  const countFor = (offset: number) =>
    consultations.filter((c) => sameDay(c.accepted_at ?? c.created_at, offset)).length +
    reminders.filter((r) => sameDay(r.remind_at, offset)).length;

  const handleAddReminder = async (
    title: string,
    hour12: number,
    minute: number,
    ampm: 'AM' | 'PM',
    notes: string,
  ) => {
    setAddError(null);
    setAddingReminder(true);

    const remindAt = new Date();
    remindAt.setDate(remindAt.getDate() + selectedOffset);
    const hour24 = ampm === 'PM' ? (hour12 === 12 ? 12 : hour12 + 12) : hour12 === 12 ? 0 : hour12;
    remindAt.setHours(hour24, minute, 0, 0);

    const { reminder, error } = await addReminder(title, remindAt, notes);
    setAddingReminder(false);
    if (error || !reminder) {
      setAddError(error ?? 'Could not save this reminder.');
      return;
    }
    setReminders((prev) => [...prev, reminder]);
    setSheetVisible(false);
  };

  const handleToggleReminder = async (reminder: PractitionerReminder) => {
    const updated = await toggleReminderComplete(reminder);
    if (!updated) return;
    setReminders((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  const handleDeleteReminder = async (reminder: PractitionerReminder) => {
    setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
    await deleteReminder(reminder);
  };

  const hasAnyItems = consultationsForDay.length > 0 || remindersForDay.length > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <PatternBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Text style={styles.screenTitle}>Schedule</Text>
          <Pressable style={styles.addButton} onPress={() => setSheetVisible(true)}>
            <Ionicons name="add" size={22} color={colors.white} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.daysScroll}
          contentContainerStyle={styles.daysRow}
        >
          {week.map((day) => {
            const active = day.offset === selectedOffset;
            const count = countFor(day.offset);
            return (
              <Pressable
                key={day.offset}
                style={[styles.dayCard, active && styles.dayCardActive]}
                onPress={() => setSelectedOffset(day.offset)}
              >
                <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>{day.label}</Text>
                <Text style={[styles.dayNum, active && styles.dayNumActive]}>{day.dayNum}</Text>
                <View style={[styles.dayDot, count > 0 && (active ? styles.dayDotOnActive : styles.dayDotHas)]} />
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.loader} />
        ) : !hasAnyItems ? (
          <View style={styles.emptyState}>
            <BounceIn style={styles.emptyIcon}>
              <Ionicons name="calendar-outline" size={30} color={colors.primaryGreen} />
            </BounceIn>
            <Text style={styles.emptyTitle}>Nothing on this day</Text>
            <Text style={styles.emptyBody}>
              Add a reminder for this day, or consultations you accept will show up here too.
            </Text>
          </View>
        ) : (
          <>
            {remindersForDay.map((reminder) => (
              <View key={reminder.id} style={styles.reminderCard}>
                <Pressable
                  style={styles.checkCircle}
                  onPress={() => handleToggleReminder(reminder)}
                  hitSlop={8}
                >
                  <Ionicons
                    name={reminder.completed_at ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={reminder.completed_at ? colors.primaryGreen : colors.textMuted}
                  />
                </Pressable>
                <View style={styles.appointmentDividerLine} />
                <View style={styles.appointmentBody}>
                  <Text
                    style={[styles.patientName, reminder.completed_at && styles.reminderDone]}
                    numberOfLines={1}
                  >
                    {reminder.title}
                  </Text>
                  <Text style={styles.symptoms}>{formatTime(reminder.remind_at)}</Text>
                  {reminder.notes ? (
                    <Text style={styles.symptoms} numberOfLines={1}>
                      {reminder.notes}
                    </Text>
                  ) : null}
                </View>
                <Pressable onPress={() => handleDeleteReminder(reminder)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}

            {consultationsForDay.map((item) => (
              <Pressable
                key={item.id}
                style={styles.appointmentCard}
                onPress={() => navigation.navigate('ProConnect', { consultationId: item.id })}
              >
                <View style={styles.timeColumn}>
                  <Text style={styles.timeText}>
                    {formatTime(item.accepted_at ?? item.created_at)}
                  </Text>
                </View>
                <View style={styles.appointmentDividerLine} />
                <View style={styles.appointmentBody}>
                  <Text style={styles.patientName}>{item.patient_name ?? 'Patient'}</Text>
                  <Text style={styles.symptoms} numberOfLines={1}>
                    {item.symptoms ?? 'No symptoms recorded'}
                  </Text>
                  <View style={styles.typeRow}>
                    <Ionicons
                      name={item.status === 'active' ? 'chatbubble-ellipses-outline' : 'checkmark-done'}
                      size={15}
                      color={colors.darkAccentGreen}
                    />
                    <Text style={styles.typeText}>
                      {item.status === 'active' ? 'Active chat' : item.status}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>

      <AddReminderSheet
        visible={sheetVisible}
        dayLabel={dayLabelFor(selectedOffset)}
        submitting={addingReminder}
        error={addError}
        onSubmit={handleAddReminder}
        onDismiss={() => setSheetVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysScroll: {
    marginTop: 16,
    marginHorizontal: -24,
  },
  daysRow: {
    paddingHorizontal: 24,
    gap: 10,
  },
  dayCard: {
    width: 62,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
  },
  dayCardActive: {
    backgroundColor: colors.primaryGreen,
    borderColor: colors.primaryGreen,
  },
  dayLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  dayLabelActive: {
    color: colors.white,
  },
  dayNum: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 18,
    color: colors.textPrimary,
    marginTop: 4,
  },
  dayNumActive: {
    color: colors.white,
  },
  dayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'transparent',
    marginTop: 5,
  },
  dayDotHas: {
    backgroundColor: colors.primaryGreen,
  },
  dayDotOnActive: {
    backgroundColor: colors.white,
  },
  loader: {
    marginTop: 50,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingBottom: 40,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: 14,
  },
  emptyBody: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.pillGreenBg,
  },
  checkCircle: {
    width: 24,
  },
  reminderDone: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  appointmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    marginTop: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  timeColumn: {
    alignItems: 'center',
    width: 56,
  },
  timeText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  appointmentDividerLine: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
    marginHorizontal: 14,
  },
  appointmentBody: {
    flex: 1,
  },
  patientName: {
    fontFamily: fonts.headingMedium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  symptoms: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  typeText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
});
