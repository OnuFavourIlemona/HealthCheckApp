import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ComponentProps } from 'react';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AiConsentModal } from '../components/AiConsentModal';
import { FadeInUp } from '../components/ui/FadeInUp';
import { PatternBackground } from '../components/ui/PatternBackground';
import { ProgressRing } from '../components/ui/ProgressRing';
import { Tappable } from '../components/ui/Tappable';
import { fetchAssessmentHistory, latestPerType } from '../lib/dashboard';
import { predictCondition, type HealthInfoInput } from '../lib/predictionApi';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, riskLevelColor, type RiskLevel } from '../theme';

type AssessmentType = {
  key: string;
  label: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  iconColor: string;
  iconBg: string;
};

const assessmentTypes: AssessmentType[] = [
  { key: 'diabetes', label: 'Diabetes', icon: 'water-plus', iconColor: '#E4572E', iconBg: '#FDEBE4' },
  { key: 'hypertension', label: 'Hypertension', icon: 'heart-pulse', iconColor: colors.darkAccentGreen, iconBg: colors.pillGreenBg },
  { key: 'stroke', label: 'Stroke', icon: 'brain', iconColor: '#6C6FCF', iconBg: colors.moonBg },
  { key: 'high_blood_sugar', label: 'High Blood Sugar', icon: 'diabetes', iconColor: '#E4572E', iconBg: '#FDEBE4' },
];

type HealthInfo = {
  age: number | null;
  gender: string | null;
  bmi: number | null;
  sleep_hours: number | null;
  smoking: boolean | null;
  family_diabetes: boolean | null;
  hypertension: boolean | null;
  fasting_glucose_mgdl: number | null;
};

function isComplete(info: HealthInfo | null): info is Required<HealthInfo> & HealthInfo {
  return (
    !!info &&
    info.age != null &&
    info.bmi != null &&
    info.sleep_hours != null &&
    info.smoking != null &&
    info.family_diabetes != null &&
    info.hypertension != null
  );
}

/**
 * Fallback heuristic scoring — used when the real prediction API
 * (predictionApi.ts, see api/) is unreachable, unconfigured, or the
 * condition/inputs aren't eligible for it (e.g. diabetes without a glucose
 * reading). Not a placeholder anymore; a real, always-available safety net.
 */
function computeScore(info: Required<HealthInfo> & HealthInfo): number {
  let score = 0;
  score += Math.min(30, Math.max(0, ((info.age as number) - 25) * 0.8));
  const bmi = info.bmi as number;
  if (bmi >= 30) score += 22;
  else if (bmi >= 25) score += 14;
  else if (bmi < 18.5) score += 6;
  const sleep = info.sleep_hours as number;
  if (sleep < 6) score += 10;
  else if (sleep > 9) score += 5;
  if (info.smoking) score += 15;
  if (info.family_diabetes) score += 15;
  if (info.hypertension) score += 12;
  // Fasting glucose is optional, but it's the single strongest predictor
  // once known (confirmed by SHAP importance in the trained diabetes/stroke
  // models — see ml/diabetes/report.md). Thresholds follow the standard ADA
  // fasting-glucose criteria: <100 normal, 100-125 prediabetes, >=126 diabetes.
  if (info.fasting_glucose_mgdl != null) {
    if (info.fasting_glucose_mgdl >= 126) score += 35;
    else if (info.fasting_glucose_mgdl >= 100) score += 18;
  }
  return Math.min(100, Math.round(score));
}

/**
 * "High Blood Sugar" deliberately shares diabetes's score rather than
 * having its own model — an attempt at a separate model trained on the
 * available data came back statistically random (see
 * ml/high_blood_sugar/report.md), while diabetes and high blood sugar are
 * closely related conditions driven by the same inputs. So instead of a
 * second model, it reuses this one but flags "elevated" earlier — a
 * broader early-warning category, not a diabetes diagnosis risk.
 */
function levelForScore(score: number, type: string): RiskLevel {
  if (type === 'high_blood_sugar') {
    if (score < 20) return 'LOW';
    if (score < 45) return 'MODERATE';
    return 'HIGH';
  }
  if (score < 34) return 'LOW';
  if (score < 67) return 'MODERATE';
  return 'HIGH';
}

export function AssessScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [healthInfo, setHealthInfo] = useState<HealthInfo | null>(null);
  const [consentedAt, setConsentedAt] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [consentVisible, setConsentVisible] = useState(false);
  const [consentReadOnly, setConsentReadOnly] = useState(false);
  const [pendingType, setPendingType] = useState<AssessmentType | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: AssessmentType; score: number; level: RiskLevel } | null>(null);
  const [assessedTypes, setAssessedTypes] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id;
        if (!userId) {
          if (!cancelled) {
            setSignedIn(false);
            setLoading(false);
          }
          return;
        }
        const [{ data }, history] = await Promise.all([
          supabase
            .from('profiles')
            .select(
              'age, gender, bmi, sleep_hours, smoking, family_diabetes, hypertension, fasting_glucose_mgdl, ai_consent_at',
            )
            .eq('id', userId)
            .maybeSingle(),
          fetchAssessmentHistory(),
        ]);
        if (cancelled) return;
        setSignedIn(true);
        if (data) {
          setHealthInfo(data);
          setConsentedAt(data.ai_consent_at);
        }
        setAssessedTypes(new Set(latestPerType(history).map((item) => item.assessment_type)));
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const runAssessment = async (type: AssessmentType) => {
    if (!isComplete(healthInfo)) {
      navigation.navigate('HealthInfo');
      return;
    }
    setError(null);
    setRunning(true);

    // Try the real prediction API first; it returns null when the
    // condition is ineligible (e.g. no glucose reading for diabetes — see
    // api/README.md), the service is unreachable, or EXPO_PUBLIC_PREDICTION_API_URL
    // isn't configured yet. Either way, the heuristic below is a real,
    // working fallback, not a degraded error state.
    const apiInput: HealthInfoInput = {
      age: healthInfo.age as number,
      gender: healthInfo.gender,
      bmi: healthInfo.bmi as number,
      sleep_hours: healthInfo.sleep_hours as number,
      smoking: healthInfo.smoking as boolean,
      family_diabetes: healthInfo.family_diabetes as boolean,
      hypertension: healthInfo.hypertension as boolean,
      fasting_glucose_mgdl: healthInfo.fasting_glucose_mgdl,
    };
    const apiResult = await predictCondition(type.key, apiInput);

    const score = apiResult?.score ?? computeScore(healthInfo);
    const level = apiResult?.riskLevel ?? levelForScore(score, type.key);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (userId) {
      const { error: insertError } = await supabase.from('risk_assessments').insert({
        user_id: userId,
        assessment_type: type.key,
        score,
        risk_level: level,
        details: {
          age: healthInfo.age,
          bmi: healthInfo.bmi,
          sleep_hours: healthInfo.sleep_hours,
          smoking: healthInfo.smoking,
          family_history: healthInfo.family_diabetes,
          hypertension: healthInfo.hypertension,
          fasting_glucose_mgdl: healthInfo.fasting_glucose_mgdl,
          model_tier: apiResult?.modelTier ?? (healthInfo.fasting_glucose_mgdl != null ? 'full' : 'core'),
          source: apiResult ? 'api' : 'heuristic',
          ...(apiResult ? { factors: apiResult.factors } : {}),
          ...(type.key === 'high_blood_sugar' ? { shares_model_with: 'diabetes' } : {}),
        },
        created_at: new Date().toISOString(),
      });
      if (insertError) {
        setRunning(false);
        setError(insertError.message);
        return;
      }
    }
    setRunning(false);
    setResult({ type, score, level });
    setAssessedTypes((prev) => new Set(prev).add(type.key));
  };

  const handleSelectType = (type: AssessmentType) => {
    if (!signedIn) {
      setError('Please sign in to run assessments. Your health info and results are saved to your account.');
      return;
    }
    if (!consentedAt) {
      setPendingType(type);
      setConsentReadOnly(false);
      setConsentVisible(true);
      return;
    }
    runAssessment(type);
  };

  const handleAgree = async () => {
    setConsentVisible(false);
    const now = new Date().toISOString();
    setConsentedAt(now);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (userId) {
      await supabase.from('profiles').update({ ai_consent_at: now }).eq('id', userId);
    }
    if (pendingType) {
      runAssessment(pendingType);
      setPendingType(null);
    }
  };

  const complete = isComplete(healthInfo);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <PatternBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.screenTitle}>Assess</Text>
            {!result ? (
              <Text style={styles.screenSubtitle}>
                {assessedTypes.size} of {assessmentTypes.length} conditions assessed
              </Text>
            ) : null}
          </View>
          <View style={styles.headerRightRow}>
            {!result ? (
              <View style={styles.ringWrap}>
                <ProgressRing
                  progress={assessedTypes.size / assessmentTypes.length}
                  size={40}
                  strokeWidth={4}
                  color={colors.primaryGreen}
                />
                <Text style={styles.ringLabel}>
                  {assessedTypes.size}/{assessmentTypes.length}
                </Text>
              </View>
            ) : null}
            <Pressable
              hitSlop={10}
              onPress={() => {
                setConsentReadOnly(true);
                setConsentVisible(true);
              }}
            >
              <Ionicons name="information-circle-outline" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.loader} />
        ) : result ? (
          <>
            <View style={styles.resultCard}>
              <View style={[styles.resultIcon, { backgroundColor: result.type.iconBg }]}>
                <MaterialCommunityIcons
                  name={result.type.icon}
                  size={26}
                  color={result.type.iconColor}
                />
              </View>
              <Text style={styles.resultTitle}>{result.type.label} Risk</Text>
              <Text style={[styles.resultLevel, { color: riskLevelColor(result.level) }]}>
                {result.level === 'LOW' ? 'Low' : result.level === 'MODERATE' ? 'Moderate' : 'High'}
              </Text>
              <Text style={styles.resultScore}>
                {result.score} <Text style={styles.resultScoreSuffix}>/100</Text>
              </Text>
              <Text style={styles.resultNote}>
                Saved to your health record. This is an early estimate based on your saved health
                info, and it does not replace professional medical advice.
              </Text>
            </View>
            <Pressable style={styles.primaryButton} onPress={() => setResult(null)}>
              <Text style={styles.primaryButtonText}>Back to Assessments</Text>
            </Pressable>
          </>
        ) : (
          <>
            {/* Health info summary card */}
            <View style={styles.infoCard}>
              <View style={styles.infoHeaderRow}>
                <Text style={styles.infoTitle}>Your Health Info</Text>
                <Pressable onPress={() => navigation.navigate('HealthInfo')} hitSlop={8}>
                  <Text style={styles.infoEdit}>{complete ? 'Update' : 'Complete'}</Text>
                </Pressable>
              </View>
              {complete ? (
                <View style={styles.chipsWrap}>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>Age {healthInfo.age}</Text>
                  </View>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>BMI {healthInfo.bmi}</Text>
                  </View>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{healthInfo.sleep_hours}h sleep</Text>
                  </View>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>
                      {healthInfo.smoking ? 'Smoker' : 'Non-smoker'}
                    </Text>
                  </View>
                  {healthInfo.family_diabetes ? (
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>Family diabetes</Text>
                    </View>
                  ) : null}
                  {healthInfo.hypertension ? (
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>High BP</Text>
                    </View>
                  ) : null}
                </View>
              ) : (
                <View style={styles.incompleteRow}>
                  <Ionicons name="alert-circle-outline" size={18} color="#C77B00" />
                  <Text style={styles.incompleteText}>
                    {signedIn
                      ? 'Fill in your health info once. Predictions use it automatically, and you can update it anytime.'
                      : 'Sign in and fill in your health info to unlock predictions.'}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.sectionHint}>Choose a condition to assess your personal risk.</Text>

            {assessmentTypes.map((type, index) => {
              const done = assessedTypes.has(type.key);
              return (
                <FadeInUp key={type.key} index={index}>
                  <Tappable style={styles.typeCard} onPress={() => handleSelectType(type)}>
                    <View style={[styles.typeIcon, { backgroundColor: type.iconBg }]}>
                      <MaterialCommunityIcons name={type.icon} size={22} color={type.iconColor} />
                    </View>
                    <View style={styles.typeTextColumn}>
                      <Text style={styles.typeLabel}>{type.label}</Text>
                      {done ? <Text style={styles.typeDoneLabel}>Assessed</Text> : null}
                    </View>
                    {running ? (
                      <ActivityIndicator size="small" color={colors.primaryGreen} />
                    ) : done ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primaryGreen} />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    )}
                  </Tappable>
                </FadeInUp>
              );
            })}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </>
        )}
      </ScrollView>

      <AiConsentModal
        visible={consentVisible}
        readOnly={consentReadOnly}
        onAgree={handleAgree}
        onClose={() => {
          setConsentVisible(false);
          setPendingType(null);
        }}
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
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  screenSubtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  ringWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabel: {
    position: 'absolute',
    fontFamily: fonts.bodySemiBold,
    fontSize: 10.5,
    color: colors.textPrimary,
  },
  loader: {
    marginTop: 60,
  },
  infoCard: {
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
  infoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15.5,
    color: colors.textPrimary,
  },
  infoEdit: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.primaryGreen,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    backgroundColor: colors.pillGreenBg,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.darkAccentGreen,
  },
  incompleteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
  },
  incompleteText: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  sectionHint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 20,
    marginBottom: 12,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeTextColumn: {
    flex: 1,
    marginLeft: 12,
  },
  typeLabel: {
    fontFamily: fonts.headingMedium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  typeDoneLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.primaryGreen,
    marginTop: 2,
  },
  errorText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.danger,
    textAlign: 'center',
    marginTop: 8,
  },
  resultCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 24,
    marginTop: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  resultIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
    marginTop: 12,
  },
  resultLevel: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 22,
    marginTop: 8,
  },
  resultScore: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 34,
    color: colors.textPrimary,
    marginTop: 4,
  },
  resultScoreSuffix: {
    fontFamily: fonts.bodyRegular,
    fontSize: 16,
    color: colors.textSecondary,
  },
  resultNote: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },
  primaryButton: {
    backgroundColor: colors.primaryGreen,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.white,
  },
});
