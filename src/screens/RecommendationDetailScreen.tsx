import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FadeInUp } from '../components/ui/FadeInUp';
import { PatternBackground } from '../components/ui/PatternBackground';
import { fetchHealthProfile, type HealthProfile } from '../lib/dashboard';
import { demoData, getDemoScenario } from '../lib/devSimulation';
import {
  disableHealthReminder,
  enableHealthReminder,
  fetchHealthReminders,
  type HealthReminderRow,
} from '../lib/healthReminders';
import { planFor, type RecommendationPlan } from '../lib/recommendationPlans';
import type { PlanReminder } from '../lib/healthReminders';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'RecommendationDetail'>;

type MCIName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const HERO_ICONS: Record<string, MCIName> = {
  sleep: 'sleep',
  bmi: 'scale-bathroom',
  smoking: 'smoking-off',
  bp: 'heart-pulse',
  diabetes: 'water-plus',
  hypertension: 'heart-pulse',
  stroke: 'brain',
  kidney: 'water-outline',
  liver: 'medical-bag',
};

function formatTimes(times: { hour: number; minute: number }[]): string {
  return times
    .map((t) => {
      const h12 = t.hour % 12 === 0 ? 12 : t.hour % 12;
      const ampm = t.hour < 12 ? 'am' : 'pm';
      const mm = t.minute.toString().padStart(2, '0');
      return `${h12}:${mm}${ampm}`;
    })
    .join(' and ');
}

export function RecommendationDetailScreen({ navigation, route }: Props) {
  const { key } = route.params;
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [reminderRows, setReminderRows] = useState<HealthReminderRow[]>([]);
  const [reminderBusy, setReminderBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const scenario = getDemoScenario();
      if (scenario) {
        setProfile(demoData(scenario).profile);
        setLoading(false);
        return;
      }
      const [prof, reminders] = await Promise.all([fetchHealthProfile(), fetchHealthReminders(key)]);
      setProfile(prof);
      setReminderRows(reminders);
      setLoading(false);
    })();
  }, [key]);

  const enabledKeys = new Set(reminderRows.map((r) => r.reminder_key));

  const onToggleReminder = async (reminder: PlanReminder, on: boolean) => {
    setReminderBusy(reminder.key);
    if (on) {
      const row = await enableHealthReminder(key, reminder);
      if (row) setReminderRows((prev) => [...prev.filter((x) => x.reminder_key !== reminder.key), row]);
    } else {
      const row = reminderRows.find((x) => x.reminder_key === reminder.key);
      if (row) {
        await disableHealthReminder(row);
        setReminderRows((prev) => prev.filter((x) => x.reminder_key !== reminder.key));
      }
    }
    setReminderBusy(null);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.loader} />
      </SafeAreaView>
    );
  }

  const plan: RecommendationPlan | null = planFor(key, profile);

  if (!plan) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Recommendation</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>We couldn't find this recommendation.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <PatternBackground />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Your Plan</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FadeInUp>
          <View style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons
                name={HERO_ICONS[key] ?? 'heart-pulse'}
                size={26}
                color={colors.darkAccentGreen}
              />
            </View>
            <Text style={styles.heroTitle}>{plan.heroTitle}</Text>
            <Text style={styles.heroSubtitle}>{plan.heroSubtitle}</Text>
          </View>
        </FadeInUp>

        {plan.warningSigns ? (
          <FadeInUp index={1}>
            <View style={styles.warningCard}>
              <View style={styles.warningHeaderRow}>
                <Ionicons name="warning" size={20} color={colors.danger} />
                <Text style={styles.warningTitle}>Warning signs to watch for</Text>
              </View>
              <Text style={styles.warningIntro}>{plan.warningSigns.intro}</Text>
              {plan.warningSigns.signs.map((sign) => (
                <View key={sign} style={styles.warningSignRow}>
                  <Ionicons name="alert-circle" size={15} color={colors.danger} />
                  <Text style={styles.warningSignText}>{sign}</Text>
                </View>
              ))}
              <View style={styles.warningUrgentRow}>
                <Ionicons name="medkit" size={15} color={colors.white} />
                <Text style={styles.warningUrgentText}>{plan.warningSigns.urgentNote}</Text>
              </View>
            </View>
          </FadeInUp>
        ) : null}

        <FadeInUp index={1}>
          <Text style={styles.sectionTitle}>How to improve</Text>
          <View style={styles.card}>
            {plan.howToImprove.map((line, index) => (
              <View key={line} style={[styles.bulletRow, index > 0 && styles.bulletRowSpacing]}>
                <View style={styles.bullet} />
                <Text style={styles.bulletText}>{line}</Text>
              </View>
            ))}
          </View>
        </FadeInUp>

        {plan.reminders && plan.reminders.length > 0 ? (
          <FadeInUp index={2}>
            <Text style={styles.sectionTitle}>Daily reminders</Text>
            <Text style={styles.reminderHint}>
              Switch these on and your phone will nudge you every day, even when the app is closed.
            </Text>
            <View style={styles.card}>
              {plan.reminders.map((reminder, index) => {
                const on = enabledKeys.has(reminder.key);
                return (
                  <View
                    key={reminder.key}
                    style={[styles.reminderRow, index > 0 && styles.reminderRowSpacing]}
                  >
                    <View style={styles.reminderIcon}>
                      <MaterialCommunityIcons
                        name={reminder.icon as MCIName}
                        size={20}
                        color={colors.darkAccentGreen}
                      />
                    </View>
                    <View style={styles.reminderTextColumn}>
                      <Text style={styles.reminderLabel}>{reminder.label}</Text>
                      <Text style={styles.reminderMessage}>{reminder.message}</Text>
                      <Text style={styles.reminderTime}>
                        {on
                          ? `On, at ${formatTimes(reminder.times)}`
                          : `Suggested for ${formatTimes(reminder.times)}`}
                      </Text>
                    </View>
                    <Switch
                      value={on}
                      onValueChange={(v) => onToggleReminder(reminder, v)}
                      disabled={reminderBusy === reminder.key}
                      trackColor={{ true: colors.primaryGreen, false: colors.border }}
                      thumbColor={colors.white}
                    />
                  </View>
                );
              })}
            </View>
          </FadeInUp>
        ) : null}

        <FadeInUp index={3}>
          <Text style={styles.sectionTitle}>This week's plan</Text>
          <View style={styles.card}>
            {plan.weeklyPlan.map((item, index) => (
              <View key={item.day} style={[styles.planRow, index > 0 && styles.planRowSpacing]}>
                <View style={styles.dayBadge}>
                  <Text style={styles.dayBadgeText}>{item.day}</Text>
                </View>
                <View style={styles.planTextColumn}>
                  <Text style={styles.planActivity}>{item.activity}</Text>
                  <Text style={styles.planDetail}>{item.detail}</Text>
                </View>
              </View>
            ))}
            <Text style={styles.planNote}>{plan.weeklyPlanNote}</Text>
          </View>
        </FadeInUp>

        <FadeInUp index={4}>
          <Text style={styles.sectionTitle}>Food to enjoy</Text>
          <View style={styles.card}>
            {plan.food.enjoy.map((line, index) => (
              <View key={line} style={[styles.bulletRow, index > 0 && styles.bulletRowSpacing]}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primaryGreen} />
                <Text style={styles.bulletTextInline}>{line}</Text>
              </View>
            ))}
          </View>
        </FadeInUp>

        <FadeInUp index={5}>
          <Text style={styles.sectionTitle}>Food to limit</Text>
          <View style={styles.card}>
            {plan.food.limit.map((line, index) => (
              <View key={line} style={[styles.bulletRow, index > 0 && styles.bulletRowSpacing]}>
                <Ionicons name="close-circle" size={16} color={colors.danger} />
                <Text style={styles.bulletTextInline}>{line}</Text>
              </View>
            ))}
          </View>
        </FadeInUp>

        <View style={styles.disclaimerCard}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.disclaimerText}>
            General guidance based on your saved health info. It does not replace advice from a
            qualified health professional about your own situation.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loader: {
    marginTop: 80,
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  heroCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 18,
    color: colors.textPrimary,
    marginTop: 12,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  sectionTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15.5,
    color: colors.textPrimary,
    marginTop: 22,
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bulletRowSpacing: {
    marginTop: 10,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primaryGreen,
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  bulletTextInline: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textPrimary,
    marginTop: -1,
  },
  reminderHint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: -4,
    marginBottom: 10,
  },
  warningCard: {
    backgroundColor: '#FEF2F0',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F6D2CC',
    padding: 16,
    marginTop: 16,
  },
  warningHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.danger,
  },
  warningIntro: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textPrimary,
    marginTop: 8,
    marginBottom: 10,
  },
  warningSignRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 7,
  },
  warningSignText: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  warningUrgentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.danger,
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
  },
  warningUrgentText: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.white,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reminderRowSpacing: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reminderIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderTextColumn: {
    flex: 1,
  },
  reminderLabel: {
    fontFamily: fonts.headingMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  reminderMessage: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: 2,
  },
  reminderTime: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    color: colors.darkAccentGreen,
    marginTop: 4,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  planRowSpacing: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dayBadge: {
    width: 44,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.darkAccentGreen,
  },
  planTextColumn: {
    flex: 1,
  },
  planActivity: {
    fontFamily: fonts.headingMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  planDetail: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: 2,
  },
  planNote: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
