import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FadeInUp } from '../components/ui/FadeInUp';
import { PatternBackground } from '../components/ui/PatternBackground';
import { fetchHealthProfile, type HealthProfile } from '../lib/dashboard';
import { demoData, getDemoScenario } from '../lib/devSimulation';
import { planFor, type RecommendationPlan } from '../lib/recommendationPlans';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'RecommendationDetail'>;

type MCIName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const HERO_ICONS: Record<string, MCIName> = {
  sleep: 'sleep',
  bmi: 'scale-bathroom',
  smoking: 'smoking-off',
  bp: 'heart-pulse',
};

export function RecommendationDetailScreen({ navigation, route }: Props) {
  const { key } = route.params;
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const scenario = getDemoScenario();
      if (scenario) {
        setProfile(demoData(scenario).profile);
        setLoading(false);
        return;
      }
      setProfile(await fetchHealthProfile());
      setLoading(false);
    })();
  }, []);

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

        <FadeInUp index={2}>
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

        <FadeInUp index={3}>
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

        <FadeInUp index={4}>
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
