import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AddDrugReminderSheet } from '../components/AddDrugReminderSheet';
import { BounceIn } from '../components/ui/BounceIn';
import { FadeInUp } from '../components/ui/FadeInUp';
import { PatternBackground } from '../components/ui/PatternBackground';
import {
  addDrugReminder,
  deleteDrugReminder,
  fetchDrugReminders,
  updateDrugReminder,
  type DrugReminderRow,
  type DrugReminderTime,
} from '../lib/drugReminders';
import { getReminderPermissionStatus } from '../lib/reminderNotifications';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'DrugReminders'>;

function formatTimes(times: DrugReminderTime[]): string {
  return times
    .map((t) => {
      const h12 = t.hour % 12 === 0 ? 12 : t.hour % 12;
      const ampm = t.hour < 12 ? 'am' : 'pm';
      return `${h12}:${t.minute.toString().padStart(2, '0')}${ampm}`;
    })
    .join(', ');
}

export function DrugRemindersScreen({ navigation }: Props) {
  const [rows, setRows] = useState<DrugReminderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editing, setEditing] = useState<DrugReminderRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [reminders, status] = await Promise.all([fetchDrugReminders(), getReminderPermissionStatus()]);
    setRows(reminders);
    setPermission(status);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openAdd = () => {
    setEditing(null);
    setError(null);
    setSheetVisible(true);
  };

  const openEdit = (row: DrugReminderRow) => {
    setEditing(row);
    setError(null);
    setSheetVisible(true);
  };

  const handleSubmit = async (drugName: string, dosage: string, times: DrugReminderTime[]) => {
    setSubmitting(true);
    setError(null);
    const result = editing
      ? await updateDrugReminder(editing, drugName, dosage, times)
      : await addDrugReminder(drugName, dosage, times);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setSheetVisible(false);
    void load();
  };

  const handleDelete = async (row: DrugReminderRow) => {
    setDeletingId(row.id);
    await deleteDrugReminder(row);
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    setDeletingId(null);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <PatternBackground />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Medicine Reminders</Text>
        <Pressable onPress={openAdd} hitSlop={12}>
          <Ionicons name="add-circle" size={26} color={colors.primaryGreen} />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            Add your drugs here and your phone will alarm you at the right time, even when the app
            is closed. Good for drugs your pharmacy told you to take more than once a day.
          </Text>

          {permission !== 'granted' ? (
            <View style={styles.permBanner}>
              <Ionicons name="notifications-off-outline" size={18} color="#C77B00" />
              <Text style={styles.permText}>
                Notifications are off for HealthCheck, so these alarms will not show. Turn them on in
                your phone settings.
              </Text>
            </View>
          ) : null}

          {rows.length === 0 ? (
            <View style={styles.emptyState}>
              <BounceIn style={styles.emptyIcon}>
                <MaterialCommunityIcons name="pill" size={28} color={colors.primaryGreen} />
              </BounceIn>
              <Text style={styles.emptyTitle}>No medicine reminders yet</Text>
              <Text style={styles.emptyBody}>
                Tap the + above to add a drug, its dosage, and when to take it.
              </Text>
            </View>
          ) : (
            rows.map((row, index) => (
              <FadeInUp key={row.id} index={index}>
                <Pressable style={styles.card} onPress={() => openEdit(row)}>
                  <View style={styles.cardIcon}>
                    <MaterialCommunityIcons name="pill" size={20} color={colors.darkAccentGreen} />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{row.drug_name}</Text>
                    <Text style={styles.cardSubtitle}>{row.dosage}</Text>
                    <Text style={styles.cardTime}>{formatTimes(row.times)}</Text>
                  </View>
                  <Pressable
                    hitSlop={10}
                    onPress={() => handleDelete(row)}
                    disabled={deletingId === row.id}
                  >
                    {deletingId === row.id ? (
                      <ActivityIndicator size="small" color={colors.danger} />
                    ) : (
                      <Ionicons name="trash-outline" size={19} color={colors.textMuted} />
                    )}
                  </Pressable>
                </Pressable>
              </FadeInUp>
            ))
          )}
        </ScrollView>
      )}

      <AddDrugReminderSheet
        visible={sheetVisible}
        submitting={submitting}
        error={error}
        initial={editing ? { drugName: editing.drug_name, dosage: editing.dosage, times: editing.times } : null}
        onSubmit={handleSubmit}
        onDismiss={() => setSheetVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
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
  loader: { marginTop: 80 },
  content: { paddingHorizontal: 24, paddingBottom: 32 },
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
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  cardTitle: {
    fontFamily: fonts.headingMedium,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  cardSubtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardTime: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    color: colors.darkAccentGreen,
    marginTop: 4,
  },
});
