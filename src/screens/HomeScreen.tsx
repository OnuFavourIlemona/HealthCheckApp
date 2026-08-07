import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  DashboardHeader,
  HealthRiskSummaryCard,
  QuickActionButton,
  RecommendedCard,
  RiskScoreCard,
  type RiskSlide,
} from '../components/dashboard';
import {
  HealthTipsIcon,
  HospitalIcon,
  LabTestIcon,
  PharmacyIcon,
} from '../components/icons/QuickActionIcons';
import { BounceIn } from '../components/ui/BounceIn';
import { FadeInUp } from '../components/ui/FadeInUp';
import { PatternBackground } from '../components/ui/PatternBackground';
import { Tappable } from '../components/ui/Tappable';
import { demoData, getDemoScenario } from '../lib/devSimulation';
import { fetchUnreadCount, subscribeToNotifications } from '../lib/notifications';
import { supabase } from '../lib/supabase';
import {
  ASSESSMENT_LABELS,
  fetchAssessmentHistory,
  fetchHealthProfile,
  firstNameOf,
  greetingForNow,
  latestPerType,
  normaliseLevel,
  overallRisk,
  recommendationsFor,
  type HealthProfile,
  type Recommendation,
  type RiskAssessment,
} from '../lib/dashboard';
import type { MainTabsParamList, RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';

type HomeNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabsParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const RECOMMENDATION_ICONS: Record<string, 'moon' | 'body' | 'flame' | 'heart'> = {
  sleep: 'moon',
  bmi: 'body',
  smoking: 'flame',
  bp: 'heart',
};

export function HomeScreen() {
  const navigation = useNavigation<HomeNavigation>();
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [latest, setLatest] = useState<RiskAssessment[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Dev-only: canned scenario in place of live Supabase data, so risk UI
    // states can be checked without a seeded account. Never active in prod.
    const scenario = getDemoScenario();
    if (scenario) {
      const { profile: demoProfile, assessments } = demoData(scenario);
      setProfile(demoProfile);
      setLatest(latestPerType(assessments));
      setRecommendations(recommendationsFor(demoProfile));
      setNotificationCount(0);
      return;
    }

    const [profileData, history, notifications, sessionData] = await Promise.all([
      fetchHealthProfile(),
      fetchAssessmentHistory(),
      fetchUnreadCount(),
      supabase.auth.getSession(),
    ]);
    setProfile(profileData);
    setLatest(latestPerType(history));
    setRecommendations(recommendationsFor(profileData));
    setNotificationCount(notifications);
    setEmail(sessionData.data.session?.user.email ?? null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Badge updates live as notifications arrive.
  useEffect(() => subscribeToNotifications(load), [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const summary = overallRisk(latest);
  const firstName = firstNameOf(profile?.full_name ?? null);

  const quickActions = [
    {
      label: 'Find Hospitals',
      icon: <HospitalIcon />,
      onPress: () => navigation.navigate('Find Care', { category: 'hospitals' }),
    },
    {
      label: 'Find Pharmacies',
      icon: <PharmacyIcon />,
      onPress: () => navigation.navigate('Find Care', { category: 'pharmacies' }),
    },
    {
      label: 'Find a Lab',
      icon: <LabTestIcon />,
      onPress: () => navigation.navigate('BookLabTest'),
    },
    {
      label: 'Health Tips',
      icon: <HealthTipsIcon />,
      onPress: () => navigation.navigate('HealthTips'),
    },
  ];

  // One slide per model prediction, whether or not it has been assessed yet.
  const riskSlides: RiskSlide[] = Object.entries(ASSESSMENT_LABELS).map(([key, label]) => {
    const assessment = latest.find((item) => item.assessment_type === key);
    return {
      key,
      label,
      score: assessment ? assessment.score : null,
      level: assessment ? normaliseLevel(assessment.risk_level) : null,
    };
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <PatternBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primaryGreen}
            colors={[colors.primaryGreen]}
          />
        }
      >
        <DashboardHeader
          email={email}
          name={profile?.full_name ?? null}
          notificationCount={notificationCount}
          onPressNotifications={() => navigation.navigate('Notifications')}
          onPressAvatar={() => navigation.navigate('Profile')}
        />

        <Text style={styles.greeting}>
          {greetingForNow()}
          {firstName ? `, ${firstName}` : ''}
        </Text>
        <Text style={styles.greetingSubtitle}>Here's your health overview for today.</Text>

        <View style={styles.summarySpacing}>
          <HealthRiskSummaryCard
            slides={riskSlides}
            overallLabel={summary.label}
            onPressSlide={(slide) =>
              slide.score != null
                ? navigation.navigate('RiskPrediction', { assessmentType: slide.key })
                : navigation.navigate('Assess')
            }
          />
        </View>

        {/* Primary path into ProConnect */}
        <Tappable
          style={styles.talkToDoctorCard}
          onPress={() => navigation.navigate('RequestConsultation')}
        >
          <View style={styles.talkIconCircle}>
            <Ionicons name="chatbubbles" size={22} color={colors.white} />
          </View>
          <View style={styles.talkTextColumn}>
            <Text style={styles.talkTitle}>Talk to a Doctor</Text>
            <Text style={styles.talkSubtitle}>
              Describe your symptoms, and a verified practitioner will respond.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.white} />
        </Tappable>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Your Health Risk Scores</Text>
          {latest.length > 0 ? (
            <Pressable onPress={() => navigation.navigate('RiskHistory')} hitSlop={8}>
              <Text style={styles.seeAll}>See All</Text>
            </Pressable>
          ) : null}
        </View>

        {latest.length === 0 ? (
          <Tappable style={styles.emptyCard} onPress={() => navigation.navigate('Assess')}>
            <BounceIn style={styles.emptyIcon}>
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.darkAccentGreen} />
            </BounceIn>
            <View style={styles.emptyTextColumn}>
              <Text style={styles.emptyTitle}>No assessments yet</Text>
              <Text style={styles.emptyBody}>
                Run your first assessment to see your personal risk scores.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Tappable>
        ) : (
          <View style={styles.riskGrid}>
            {latest.map((item, index) => (
              <FadeInUp key={item.assessment_type} index={index}>
                <RiskScoreCard
                  label={ASSESSMENT_LABELS[item.assessment_type] ?? item.assessment_type}
                  score={Math.round(item.score)}
                  level={normaliseLevel(item.risk_level)}
                  onPress={() =>
                    navigation.navigate('RiskPrediction', { assessmentType: item.assessment_type })
                  }
                />
              </FadeInUp>
            ))}
          </View>
        )}

        <Text style={[styles.sectionHeader, styles.sectionSpacing]}>Recommended for You</Text>
        {recommendations.length === 0 ? (
          <Tappable style={styles.emptyCard} onPress={() => navigation.navigate('HealthInfo')}>
            <BounceIn style={styles.emptyIcon}>
              <Ionicons name="clipboard-outline" size={22} color={colors.darkAccentGreen} />
            </BounceIn>
            <View style={styles.emptyTextColumn}>
              <Text style={styles.emptyTitle}>Complete your health info</Text>
              <Text style={styles.emptyBody}>
                Add your details to get suggestions tailored to you.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Tappable>
        ) : (
          recommendations.map((item, index) => (
            <FadeInUp key={item.key} index={index}>
              <RecommendedCard
                title={item.title}
                subtitle={item.subtitle}
                tag={item.tag}
                tagTone={item.tagTone}
                icon={RECOMMENDATION_ICONS[item.key] ?? 'moon'}
                onPress={() => navigation.navigate('RecommendationDetail', { key: item.key })}
              />
            </FadeInUp>
          ))
        )}

        <Text style={[styles.sectionHeader, styles.sectionSpacing]}>Quick Actions</Text>
        <View style={styles.quickActionsRow}>
          {quickActions.map((item, index) => (
            <FadeInUp key={item.label} index={index} staggerMs={60}>
              <QuickActionButton {...item} />
            </FadeInUp>
          ))}
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 32,
  },
  greeting: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 22,
    color: colors.textPrimary,
    marginTop: 16,
  },
  greetingSubtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 4,
  },
  summarySpacing: {
    marginTop: 20,
  },
  talkToDoctorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.darkAccentGreen,
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
  },
  talkIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  talkTextColumn: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  talkTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.white,
  },
  talkSubtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 26,
  },
  sectionHeader: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  sectionSpacing: {
    marginTop: 26,
    marginBottom: 12,
  },
  seeAll: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.primaryGreen,
  },
  riskGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 13,
    marginTop: 16,
  },
  emptyCard: {
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
  emptyIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTextColumn: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  emptyTitle: {
    fontFamily: fonts.headingMedium,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  emptyBody: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: 2,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
