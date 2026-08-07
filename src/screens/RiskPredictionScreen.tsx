import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { BounceIn } from '../components/ui/BounceIn';
import { FadeInUp } from '../components/ui/FadeInUp';
import { PatternBackground } from '../components/ui/PatternBackground';
import { Tappable } from '../components/ui/Tappable';
import { ASSESSMENT_LABELS, normaliseLevel, type RiskAssessment } from '../lib/dashboard';
import { demoData, getDemoScenario } from '../lib/devSimulation';
import type { StoredFactor } from '../lib/riskFactors';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, riskLevelColor } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'RiskPrediction'>;

const RISK_ORANGE = '#F59E0B';

type MCIName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type FactorCategory = 'increase' | 'protective';

type DerivedFactor = {
  key: string;
  name: string;
  detail: string;
  category: FactorCategory;
  /** Risk points contributed, on the same 0-100 scale as the score. Always 0 for protective factors — the heuristic doesn't model a negative/protective magnitude, only whether a factor is elevated or not. */
  impact: number;
  icon: MCIName;
  tip: string | null;
};

function factorStyle(category: FactorCategory): { iconColor: string; iconBg: string } {
  return category === 'increase'
    ? { iconColor: colors.danger, iconBg: '#FDEBE4' }
    : { iconColor: colors.darkAccentGreen, iconBg: colors.pillGreenBg };
}

type AssessmentDetails = {
  age?: number | null;
  bmi?: number | null;
  sleep_hours?: number | null;
  smoking?: boolean | null;
  family_history?: boolean | null;
  hypertension?: boolean | null;
  fasting_glucose_mgdl?: number | null;
  /** Present when this assessment came from the real prediction API — see predictionApi.ts. Absent means it came from the local heuristic, and deriveFactors() below reconstructs the breakdown from the raw fields above instead. */
  factors?: StoredFactor[];
  source?: 'api' | 'heuristic';
};

// Sentence phrasing per condition — "developing a stroke" reads oddly, so a
// few conditions get a tailored verb phrase instead of the generic template.
const CONDITION_PHRASE: Record<string, string> = {
  diabetes: 'developing diabetes',
  hypertension: 'developing hypertension',
  stroke: 'having a stroke',
  high_blood_sugar: 'developing high blood sugar',
};

function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Healthy';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

/**
 * Turns the health-info snapshot saved with the assessment into a full
 * factor breakdown — every factor that was collected, not just the ones
 * pushing risk up. That's what lets a low-risk result explain itself: each
 * input is shown as either adding risk points or being protective/not
 * elevated. Uses the exact same weights the placeholder scoring heuristic in
 * AssessScreen used to produce the score, so the numbers always add up to
 * something real rather than invented figures.
 */
function deriveFactors(details: AssessmentDetails | null): DerivedFactor[] {
  if (!details) return [];
  const out: DerivedFactor[] = [];

  if (details.age != null) {
    const impact = Math.min(30, Math.max(0, (details.age - 25) * 0.8));
    out.push({
      key: 'age',
      name: 'Age',
      detail: `Age ${details.age}`,
      category: impact > 0 ? 'increase' : 'protective',
      impact,
      icon: 'calendar-month-outline',
      tip: null,
    });
  }

  if (details.bmi != null) {
    let impact = 0;
    if (details.bmi >= 30) impact = 22;
    else if (details.bmi >= 25) impact = 14;
    else if (details.bmi < 18.5) impact = 6;
    out.push({
      key: 'bmi',
      name: 'BMI',
      detail: `BMI ${details.bmi} (${bmiCategory(details.bmi)})`,
      category: impact > 0 ? 'increase' : 'protective',
      impact,
      icon: 'human',
      tip: impact > 0 ? 'Work towards a healthier weight through diet and regular activity.' : null,
    });
  }

  if (details.sleep_hours != null) {
    let impact = 0;
    if (details.sleep_hours < 6) impact = 10;
    else if (details.sleep_hours > 9) impact = 5;
    out.push({
      key: 'sleep',
      name: 'Sleep',
      detail: `${details.sleep_hours}h average`,
      category: impact > 0 ? 'increase' : 'protective',
      impact,
      icon: 'sleep',
      tip: impact > 0 ? 'Aim for 7–9 hours of sleep a night.' : null,
    });
  }

  if (details.smoking != null) {
    out.push({
      key: 'smoking',
      name: 'Smoking',
      detail: details.smoking ? 'Current smoker' : 'Non-smoker',
      category: details.smoking ? 'increase' : 'protective',
      impact: details.smoking ? 15 : 0,
      icon: details.smoking ? 'smoking' : 'smoking-off',
      tip: details.smoking ? 'Consider quitting smoking, since it is one of the biggest drivers of this risk.' : null,
    });
  }

  if (details.family_history != null) {
    out.push({
      key: 'family',
      name: 'Family History',
      detail: details.family_history ? 'Diabetes in close family' : 'No family history reported',
      category: details.family_history ? 'increase' : 'protective',
      impact: details.family_history ? 15 : 0,
      icon: 'account-group',
      tip: details.family_history
        ? 'Since this runs in your family, regular screening matters even more.'
        : null,
    });
  }

  if (details.hypertension != null) {
    out.push({
      key: 'bp',
      name: 'Blood Pressure',
      detail: details.hypertension ? 'Recorded high blood pressure' : 'No recorded hypertension',
      category: details.hypertension ? 'increase' : 'protective',
      impact: details.hypertension ? 12 : 0,
      icon: 'heart-pulse',
      tip: details.hypertension
        ? 'Keep monitoring and managing your blood pressure with a practitioner.'
        : null,
    });
  }

  if (details.fasting_glucose_mgdl != null) {
    const glucose = details.fasting_glucose_mgdl;
    let impact = 0;
    if (glucose >= 126) impact = 35;
    else if (glucose >= 100) impact = 18;
    out.push({
      key: 'glucose',
      name: 'Fasting Blood Sugar',
      detail: `${glucose} mg/dL`,
      category: impact > 0 ? 'increase' : 'protective',
      impact,
      icon: 'water-plus',
      tip:
        impact > 0
          ? 'Recheck your fasting blood sugar and discuss it with a practitioner. This is the single biggest factor in your result.'
          : null,
    });
  }

  return out.sort((a, b) => b.impact - a.impact);
}

/** Ramps a number from 0 to `target` once on mount — used to sweep the ring in and count the label up together. */
function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const anim = new Animated.Value(0);
    const listenerId = anim.addListener(({ value: v }) => setValue(v));
    Animated.timing(anim, {
      toValue: target,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(listenerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return value;
}

function RiskRing({ percent, size = 108, strokeWidth = 10 }: { percent: number; size?: number; strokeWidth?: number }) {
  const r = (size - strokeWidth) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const greenFraction = (percent / 100) * 0.75;
  const orangeFraction = (percent / 100) * 0.25;
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={r} stroke="rgba(255,255,255,0.2)" strokeWidth={strokeWidth} fill="none" />
      <Circle
        cx={c}
        cy={c}
        r={r}
        stroke={colors.primaryGreen}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circumference * greenFraction} ${circumference}`}
        transform={`rotate(-90 ${c} ${c})`}
      />
      <Circle
        cx={c}
        cy={c}
        r={r}
        stroke={RISK_ORANGE}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circumference * orangeFraction} ${circumference}`}
        strokeDashoffset={-circumference * greenFraction}
        transform={`rotate(-90 ${c} ${c})`}
      />
    </Svg>
  );
}

function FactorBar({ isPositive, targetWidth, index }: { isPositive: boolean; targetWidth: number; index: number }) {
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(width, {
      toValue: targetWidth,
      duration: 500,
      delay: 150 + index * 60,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetWidth]);

  return (
    <Animated.View style={[styles.factorBarBase, { width }]}>
      <LinearGradient
        colors={isPositive ? ['#F97316', '#EF4444'] : ['#86EFAC', '#22C55E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.factorBarFill}
      />
    </Animated.View>
  );
}

type Tab = 'explanation' | 'factors' | 'actions';

export function RiskPredictionScreen({ navigation, route }: Props) {
  const { assessmentType } = route.params;
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('explanation');
  const [shapExpanded, setShapExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setActiveTab('explanation');
    setFeedback(null);

    (async () => {
      const scenario = getDemoScenario();
      if (scenario) {
        const { assessments } = demoData(scenario);
        const match = assessments.find((a) => a.assessment_type === assessmentType) ?? null;
        if (!cancelled) {
          setAssessment(match);
          setLoading(false);
        }
        return;
      }

      const { data } = await supabase
        .from('risk_assessments')
        .select('id, assessment_type, score, risk_level, details, created_at')
        .eq('assessment_type', assessmentType)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setAssessment((data as RiskAssessment) ?? null);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assessmentType]);

  const animatedPercent = useCountUp(assessment?.score ?? 0);
  const conditionLabel = ASSESSMENT_LABELS[assessmentType] ?? assessmentType;
  const conditionPhrase = CONDITION_PHRASE[assessmentType] ?? `developing ${conditionLabel.toLowerCase()}`;
  const level = assessment ? normaliseLevel(assessment.risk_level) : 'LOW';
  const levelWord = level === 'HIGH' ? 'High' : level === 'MODERATE' ? 'Moderate' : 'Low';
  const levelColor = riskLevelColor(level);
  const factorDetails = (assessment?.details as AssessmentDetails | null) ?? null;
  // Real API-sourced factors (real SHAP contributions) win when present;
  // older/heuristic-sourced assessments fall back to the local reconstruction.
  const factors: DerivedFactor[] = factorDetails?.factors
    ? factorDetails.factors.map((f: StoredFactor) => ({ ...f, icon: f.icon as MCIName }))
    : deriveFactors(factorDetails);
  const increasingFactors = factors.filter((f) => f.category === 'increase');
  const maxImpact = Math.max(1, ...increasingFactors.map((f) => f.impact));
  const tips = factors.filter((f) => f.tip);

  const riskMessage =
    level === 'HIGH'
      ? `This means you currently have a higher likelihood of ${conditionPhrase}, based on your saved health info.`
      : level === 'MODERATE'
        ? `This means you currently have a moderate likelihood of ${conditionPhrase}. Small changes can help lower it.`
        : `This means your current likelihood of ${conditionPhrase} is low. Keep up your healthy habits.`;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <PatternBackground />
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {conditionLabel} Risk Prediction
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.loader} />
      ) : !assessment ? (
        <View style={styles.emptyState}>
          <BounceIn style={styles.emptyIcon}>
            <Ionicons name="analytics-outline" size={32} color={colors.primaryGreen} />
          </BounceIn>
          <Text style={styles.emptyTitle}>No assessment yet</Text>
          <Text style={styles.emptyBody}>
            Run a {conditionLabel.toLowerCase()} assessment to see your personal risk prediction here.
          </Text>
          <Tappable
            style={styles.primaryButton}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Assess' })}
          >
            <Text style={styles.primaryButtonText}>Go to Assess</Text>
          </Tappable>
        </View>
      ) : (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Title row */}
          <View style={styles.titleRow}>
            <Text style={styles.screenTitle}>{conditionLabel} Risk Prediction</Text>
            <View style={styles.aiPill}>
              <Text style={styles.aiPillText}>Estimate</Text>
            </View>
          </View>

          {/* Risk summary card */}
          <View style={styles.riskCard}>
            <View style={styles.ringWrap}>
              <RiskRing percent={animatedPercent} />
              <View style={styles.ringLabel}>
                <Text style={[styles.ringPercent, { color: levelColor }]}>
                  {Math.round(animatedPercent)}%
                </Text>
                <Text style={styles.ringCaption}>{levelWord} Risk</Text>
              </View>
            </View>
            <View style={styles.riskTextColumn}>
              <Text style={styles.riskTitle}>
                Your {conditionLabel.toLowerCase()} risk is{' '}
                <Text style={{ color: levelColor }}>{levelWord}</Text>
              </Text>
              <Text style={styles.riskBody}>{riskMessage}</Text>
              <Pressable style={styles.meaningRow} onPress={() => setActiveTab('explanation')} hitSlop={6}>
                <Text style={styles.meaningText}>What does this mean?</Text>
                <Ionicons name="information-circle-outline" size={15} color={colors.primaryGreen} />
              </Pressable>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabsRow}>
            {(
              [
                ['explanation', 'Explanation'],
                ['factors', 'Risk Factors'],
                ['actions', 'What You Can Do'],
              ] as const
            ).map(([key, label]) => (
              <Pressable
                key={key}
                style={[styles.tab, activeTab === key && styles.tabActive]}
                onPress={() => setActiveTab(key)}
              >
                <Text style={activeTab === key ? styles.tabActiveText : styles.tabText}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {activeTab === 'explanation' ? (
            <>
              <Text style={styles.sectionTitle}>Why is this my predicted risk?</Text>
              <Text style={styles.sectionBody}>
                This estimate comes from a model using the health info you've saved, including
                your age, BMI, sleep, smoking and family history. It's a screening estimate, not a
                medical diagnosis.
              </Text>

              <View style={styles.aboutBanner}>
                <MaterialCommunityIcons name="shield-check" size={26} color={colors.darkAccentGreen} />
                <View style={styles.aboutTextColumn}>
                  <Text style={styles.aboutTitle}>About This Prediction</Text>
                  <Text style={styles.aboutBody}>
                    This prediction is based on your saved health data and may change as your
                    health improves or you update your info.
                  </Text>
                </View>
              </View>
            </>
          ) : activeTab === 'factors' ? (
            <>
              <View style={styles.shapBanner}>
                <Text style={styles.shapText}>
                  Shapley Additive Explanations (SHAP) help show how each factor contributes to
                  your risk score.
                </Text>
                {shapExpanded ? (
                  <Text style={[styles.shapText, styles.shapExpandedText]}>
                    Each factor below is weighted by how much it raises or lowers your estimated
                    score, so you can see exactly which parts of your health info are driving this
                    result.
                  </Text>
                ) : null}
                <Pressable style={styles.learnMoreRow} onPress={() => setShapExpanded((v) => !v)} hitSlop={6}>
                  <Text style={styles.learnMoreText}>{shapExpanded ? 'Show less' : 'Learn more'}</Text>
                  <Ionicons
                    name={shapExpanded ? 'chevron-up' : 'information-circle-outline'}
                    size={15}
                    color={colors.primaryGreen}
                  />
                </Pressable>
              </View>

              <View style={styles.factorsCard}>
                <View style={styles.factorsHeaderRow}>
                  <Text style={styles.factorsTitle}>Factors Behind Your Risk</Text>
                </View>

                {factors.length === 0 ? (
                  <Text style={styles.sectionBody}>
                    We don't have a detailed breakdown for this assessment.
                  </Text>
                ) : (
                  <>
                    <View style={styles.factorsLegendRow}>
                      <Text style={styles.factorsColumnLabel}>Factor</Text>
                      <Text style={styles.factorsColumnLabel}>Impact on Risk</Text>
                    </View>
                    {factors.map((factor, index) => {
                      const style = factorStyle(factor.category);
                      const barWidth = 24 + (factor.impact / maxImpact) * 96;
                      return (
                        <FadeInUp key={factor.key} index={index} staggerMs={60}>
                          <View style={styles.factorRow}>
                            <View style={[styles.factorIcon, { backgroundColor: style.iconBg }]}>
                              <MaterialCommunityIcons name={factor.icon} size={18} color={style.iconColor} />
                            </View>
                            <View style={styles.factorBody}>
                              <Text style={styles.factorName}>{factor.name}</Text>
                              <Text style={styles.factorDetail}>{factor.detail}</Text>
                            </View>
                            <View style={styles.factorImpactColumn}>
                              {factor.category === 'increase' ? (
                                <>
                                  <Text style={[styles.factorImpact, { color: colors.danger }]}>
                                    +{factor.impact.toFixed(0)}
                                  </Text>
                                  <FactorBar isPositive targetWidth={barWidth} index={index} />
                                </>
                              ) : (
                                <View style={styles.protectiveBadge}>
                                  <Ionicons name="checkmark-circle" size={13} color={colors.primaryGreen} />
                                  <Text style={styles.protectiveBadgeText}>Protective</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </FadeInUp>
                      );
                    })}

                    <View style={styles.legendRow}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
                        <Text style={styles.legendText}>Increases Risk</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: colors.primaryGreen }]} />
                        <Text style={styles.legendText}>Protective / Not Elevated</Text>
                      </View>
                    </View>
                  </>
                )}
              </View>
            </>
          ) : (
            <View style={styles.factorsCard}>
              <Text style={styles.factorsTitle}>What You Can Do</Text>
              {tips.length === 0 ? (
                <Text style={[styles.sectionBody, { marginTop: 8 }]}>
                  Your current profile doesn't show elevated risk factors for {conditionLabel.toLowerCase()}.
                  Keep up your healthy habits and reassess periodically.
                </Text>
              ) : (
                tips.map((factor, index) => (
                  <FadeInUp key={factor.key} index={index} staggerMs={60}>
                    <View style={styles.tipRow}>
                      <View style={[styles.factorIcon, { backgroundColor: '#FDEBE4' }]}>
                        <MaterialCommunityIcons name={factor.icon} size={18} color={colors.danger} />
                      </View>
                      <Text style={styles.tipText}>{factor.tip}</Text>
                    </View>
                  </FadeInUp>
                ))
              )}
              <Tappable
                style={styles.talkButton}
                onPress={() => navigation.navigate('RequestConsultation')}
              >
                <Ionicons name="chatbubbles-outline" size={18} color={colors.white} />
                <Text style={styles.talkButtonText}>Talk to a Doctor About This</Text>
              </Tappable>
            </View>
          )}

          {/* Feedback row */}
          <View style={styles.feedbackRow}>
            <Text style={styles.feedbackText}>
              {feedback ? 'Thanks for the feedback!' : 'Was this explanation helpful?'}
            </Text>
            <View style={styles.feedbackButtons}>
              <Tappable
                scaleDown={false}
                onPress={() => setFeedback((prev) => (prev === 'up' ? null : 'up'))}
              >
                <Ionicons
                  name={feedback === 'up' ? 'thumbs-up' : 'thumbs-up-outline'}
                  size={22}
                  color={colors.primaryGreen}
                />
              </Tappable>
              <Tappable
                scaleDown={false}
                onPress={() => setFeedback((prev) => (prev === 'down' ? null : 'down'))}
              >
                <Ionicons
                  name={feedback === 'down' ? 'thumbs-down' : 'thumbs-down-outline'}
                  size={22}
                  color={feedback === 'down' ? colors.danger : colors.textPrimary}
                />
              </Tappable>
            </View>
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
  flex: {
    flex: 1,
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
    marginTop: 60,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
    marginTop: 16,
  },
  emptyBody: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: colors.primaryGreen,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 13,
    marginTop: 20,
  },
  primaryButtonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14.5,
    color: colors.white,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  screenTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  aiPill: {
    backgroundColor: colors.pillGreenBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  aiPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.darkAccentGreen,
  },
  riskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardDark,
    borderRadius: 18,
    padding: 18,
    marginTop: 14,
  },
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabel: {
    position: 'absolute',
    alignItems: 'center',
  },
  ringPercent: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 22,
    color: RISK_ORANGE,
  },
  ringCaption: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11.5,
    color: colors.white,
    marginTop: 1,
  },
  riskTextColumn: {
    flex: 1,
    marginLeft: 16,
  },
  riskTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16.5,
    color: colors.white,
    lineHeight: 23,
  },
  riskBody: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.cardDarkMutedText,
    marginTop: 6,
  },
  meaningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  meaningText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.primaryGreen,
  },
  tabsRow: {
    flexDirection: 'row',
    marginTop: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 10,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primaryGreen,
  },
  tabActiveText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.primaryGreen,
  },
  tabText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  sectionTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: 18,
  },
  sectionBody: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginTop: 6,
  },
  shapBanner: {
    backgroundColor: colors.pillGreenBg,
    borderRadius: 12,
    padding: 14,
    marginTop: 18,
  },
  shapText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  shapExpandedText: {
    marginTop: 8,
  },
  learnMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    marginTop: 6,
  },
  learnMoreText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.primaryGreen,
  },
  factorsCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  factorsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  factorsTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15.5,
    color: colors.textPrimary,
  },
  factorsLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  factorsColumnLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textMuted,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F4F4',
  },
  factorIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  factorBody: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  factorName: {
    fontFamily: fonts.headingMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  factorDetail: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 1,
  },
  factorImpactColumn: {
    alignItems: 'flex-end',
  },
  factorImpact: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
  },
  factorBarBase: {
    height: 5,
    borderRadius: 3,
    marginTop: 5,
    overflow: 'hidden',
  },
  factorBarFill: {
    width: '100%',
    height: '100%',
  },
  protectiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  protectiveBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.primaryGreen,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F4F4',
  },
  tipText: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  talkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primaryGreen,
    borderRadius: 24,
    height: 50,
    marginTop: 16,
  },
  talkButtonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14.5,
    color: colors.white,
  },
  aboutBanner: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.pillGreenBg,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  aboutTextColumn: {
    flex: 1,
  },
  aboutTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.darkAccentGreen,
  },
  aboutBody: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textPrimary,
    marginTop: 4,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  feedbackText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textPrimary,
  },
  feedbackButtons: {
    flexDirection: 'row',
    gap: 18,
  },
});
