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
import { friendlyError } from '../lib/errors';
import { computeFsrp } from '../lib/fsrp';
import { computeHypertensionRisk } from '../lib/hypertensionRisk';
import { computeFindrisc, type FamilyDiabetesDegree } from '../lib/findrisc';
import { interpretKnownReadings, bandForReading } from '../lib/diabetesReading';
import { computeKidneyRisk } from '../lib/kidneyRisk';
import { computeLiverRisk } from '../lib/liverRisk';
import { autoEnableRelevantReminders } from '../lib/autoReminders';
import { successHaptic } from '../lib/haptics';
import { type DietFrequencies } from '../lib/nidrs';
import { predictCondition, type HealthInfoInput } from '../lib/predictionApi';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, riskLevelColor, type RiskLevel } from '../theme';

const FSRP_ICONS: Record<string, string> = {
  age: 'calendar-account-outline',
  bp: 'heart-pulse',
  diabetes: 'water-plus',
  smoker: 'smoking',
  cvd: 'heart-broken',
  afib: 'heart-flash',
};

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
  { key: 'kidney', label: 'Kidney Health', icon: 'water-outline', iconColor: '#3B7DB0', iconBg: '#E4F0F8' },
  { key: 'liver', label: 'Liver Health', icon: 'medical-bag', iconColor: '#B5732E', iconBg: '#F7ECDD' },
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
  // Optional extras used by the Framingham stroke equation (fall back
  // gracefully when absent — see lib/fsrp.ts).
  bp_systolic?: number | null;
  on_bp_medication?: boolean | null;
  atrial_fibrillation?: boolean | null;
  heart_disease?: boolean | null;
  diet_frequencies?: Record<string, string> | null;
  family_hypertension?: boolean | null;
  exercise_days_per_week?: number | null;
  // Optional extras used by the FINDRISC diabetes score (see lib/findrisc.ts).
  waist_cm?: number | null;
  daily_fruit_veg?: boolean | null;
  ever_high_glucose?: boolean | null;
  glucose_is_fasting?: boolean | null;
  hba1c_percent?: number | null;
  // Optional extras used by the kidney health risk check (see lib/kidneyRisk.ts).
  family_kidney_disease?: boolean | null;
  frequent_painkiller_use?: boolean | null;
  herbal_remedy_use?: boolean | null;
  water_cups_per_day?: number | null;
  chronic_infection_history?: boolean | null;
  // Optional extras used by the liver health risk check (see lib/liverRisk.ts).
  alcohol?: boolean | null;
  viral_hepatitis?: boolean | null;
  hepatitis_tested?: boolean | null;
  family_liver_disease?: boolean | null;
  risky_blood_exposure?: boolean | null;
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
              'age, gender, bmi, sleep_hours, smoking, family_diabetes, hypertension, fasting_glucose_mgdl, ai_consent_at, bp_systolic, on_bp_medication, atrial_fibrillation, heart_disease, diet_frequencies, family_hypertension, exercise_days_per_week, waist_cm, daily_fruit_veg, ever_high_glucose, glucose_is_fasting, hba1c_percent, family_kidney_disease, frequent_painkiller_use, herbal_remedy_use, water_cups_per_day, chronic_infection_history, alcohol, viral_hepatitis, hepatitis_tested, family_liver_disease, risky_blood_exposure',
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
        // Only count conditions we still offer, so retired types can never
        // push the "X of Y assessed" count past the number of tiles.
        const offered = new Set(assessmentTypes.map((t) => t.key));
        setAssessedTypes(
          new Set(
            latestPerType(history)
              .map((item) => item.assessment_type)
              .filter((key) => offered.has(key)),
          ),
        );
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
    // Stroke uses the validated Framingham Stroke Risk Profile equation
    // (see lib/fsrp.ts) rather than the ML model -- it's a published clinical
    // score, runs on-device, and degrades gracefully when inputs are missing.
    const fsrp =
      type.key === 'stroke'
        ? computeFsrp({
            age: healthInfo.age as number,
            sex: healthInfo.gender === 'male' || healthInfo.gender === 'female' ? healthInfo.gender : null,
            systolicBp: healthInfo.bp_systolic ?? null,
            onBpMedication: healthInfo.on_bp_medication ?? null,
            // Personal diabetes proxied from a fasting glucose at/above the
            // diagnostic threshold when no explicit diagnosis is on file.
            diabetes:
              healthInfo.fasting_glucose_mgdl != null ? healthInfo.fasting_glucose_mgdl >= 126 : null,
            smoker: healthInfo.smoking ?? null,
            cardiovascularDisease: healthInfo.heart_disease ?? null,
            atrialFibrillation: healthInfo.atrial_fibrillation ?? null,
          })
        : null;

    // Hypertension uses the combined NiDRS + risk-factor assessment (see
    // lib/hypertensionRisk.ts): the validated Nigerian diet score plus the
    // recognised non-dietary factors, reported as a band.
    const htn =
      type.key === 'hypertension'
        ? computeHypertensionRisk({
            age: healthInfo.age as number,
            bmi: healthInfo.bmi as number,
            smoking: healthInfo.smoking ?? null,
            exerciseDaysPerWeek: healthInfo.exercise_days_per_week ?? null,
            sleepHours: healthInfo.sleep_hours ?? null,
            familyHypertension: healthInfo.family_hypertension ?? null,
            toldHypertension: healthInfo.hypertension ?? null,
            systolicBp: healthInfo.bp_systolic ?? null,
            onBpMedication: healthInfo.on_bp_medication ?? null,
            diet: (healthInfo.diet_frequencies as DietFrequencies | null) ?? null,
          })
        : null;

    // Diabetes AND High Blood Sugar share one engine: they are the same
    // question (is your sugar high / heading that way?). FINDRISC in its IDF
    // 0–26 form (see lib/findrisc.ts) is a no-blood-test risk score validated
    // in Africans (AUC 0.86) and used in Nigeria; it reaches every user and
    // reports a band.
    const isSugarType = type.key === 'diabetes';
    const dia = isSugarType
      ? computeFindrisc({
            age: healthInfo.age as number,
            bmi: healthInfo.bmi as number,
            waistCm: healthInfo.waist_cm ?? null,
            sex: healthInfo.gender === 'male' || healthInfo.gender === 'female' ? healthInfo.gender : null,
            // At least 30 min most days — proxied from weekly exercise days.
            physicallyActive:
              healthInfo.exercise_days_per_week != null ? healthInfo.exercise_days_per_week >= 5 : null,
            dailyFruitVeg: healthInfo.daily_fruit_veg ?? null,
            onBpMedication: healthInfo.on_bp_medication ?? null,
            // A prior high reading counts; a known fasting glucose at/above the
            // pre-diabetes threshold also does.
            everHighGlucose:
              healthInfo.ever_high_glucose === true ||
              (healthInfo.fasting_glucose_mgdl != null && healthInfo.fasting_glucose_mgdl >= 100)
                ? true
                : healthInfo.ever_high_glucose === false || healthInfo.fasting_glucose_mgdl != null
                  ? false
                  : null,
            // The app collects family diabetes as yes/no; a positive answer
            // usually means a first-degree relative, the higher-weight case.
            familyDiabetes: (healthInfo.family_diabetes == null
              ? null
              : healthInfo.family_diabetes
                ? 'first'
                : 'none') as FamilyDiabetesDegree | null,
          })
        : null;

    // Two-track: if the patient KNOWS a blood-sugar number (fasting or random
    // glucose, or HbA1c), that direct clinical reading leads — a value in the
    // diabetes range must never be softened into a "future risk" band. When
    // there's no number (or it's normal), FINDRISC's future-risk score leads.
    const reading = isSugarType
      ? interpretKnownReadings({
            glucoseMgdl: healthInfo.fasting_glucose_mgdl ?? null,
            glucoseFasting: healthInfo.glucose_is_fasting ?? null,
            hba1cPercent: healthInfo.hba1c_percent ?? null,
          })
        : null;

    const findriscFactors = dia
      ? dia.factors.map((f) => ({
          key: f.key,
          name: f.name,
          detail: f.detail,
          category: 'increase' as const,
          impact: f.points,
          icon: f.icon,
          tip: f.tip,
        }))
      : [];
    const readingFactor = reading
      ? {
          key: 'reading',
          name: reading.name,
          detail: reading.detail,
          category: (reading.category === 'normal' ? 'protective' : 'increase') as 'protective' | 'increase',
          impact: reading.category === 'diabetes_range' ? 10 : reading.category === 'prediabetes' ? 6 : 0,
          icon: 'water',
          tip: reading.tip,
        }
      : null;

    // Combined outcome (fires for both the Diabetes and High Blood Sugar tiles).
    const diaOutcome = dia
      ? (() => {
          const abnormal = reading != null && reading.category !== 'normal';
          const b = abnormal
            ? bandForReading(reading!.category)
            : { band: dia.band, score: dia.score100 };
          const factors = readingFactor ? [readingFactor, ...findriscFactors] : findriscFactors;
          return {
            band: b.band,
            score: b.score,
            source: abnormal ? ('glucose_reading' as const) : ('findrisc' as const),
            factors,
            readingCategory: reading?.category ?? null,
          };
        })()
      : null;

    // Kidney health risk: rising fast in Nigeria and driven mostly by lifestyle
    // and diet (see lib/kidneyRisk.ts). Reports a band from the known risk
    // factors, never a fabricated percentage.
    const kidney =
      type.key === 'kidney'
        ? computeKidneyRisk({
            age: healthInfo.age ?? null,
            sex: healthInfo.gender === 'male' || healthInfo.gender === 'female' ? healthInfo.gender : null,
            bmi: healthInfo.bmi ?? null,
            smoking: healthInfo.smoking ?? null,
            hypertension: healthInfo.hypertension ?? null,
            onBpMedication: healthInfo.on_bp_medication ?? null,
            systolicBp: healthInfo.bp_systolic ?? null,
            // Any personal sign of diabetes from what we already collect.
            diabetes:
              healthInfo.ever_high_glucose === true ||
              (healthInfo.fasting_glucose_mgdl != null && healthInfo.fasting_glucose_mgdl >= 126) ||
              (healthInfo.hba1c_percent != null && healthInfo.hba1c_percent >= 6.5)
                ? true
                : null,
            heartDisease: healthInfo.heart_disease ?? null,
            familyKidneyDisease: healthInfo.family_kidney_disease ?? null,
            frequentPainkillers: healthInfo.frequent_painkiller_use ?? null,
            herbalRemedies: healthInfo.herbal_remedy_use ?? null,
            // Heavy salt is read from the diet answers already collected.
            highSalt:
              (healthInfo.diet_frequencies as DietFrequencies | null)?.salt === 'daily' ? true : null,
            waterCupsPerDay: healthInfo.water_cups_per_day ?? null,
            chronicInfection: healthInfo.chronic_infection_history ?? null,
          })
        : null;

    // Liver health risk: hepatitis B, alcohol, herbal mixtures, and fatty liver
    // are the big Nigerian drivers (see lib/liverRisk.ts). Reports a band.
    const diabetesSignal =
      healthInfo.ever_high_glucose === true ||
      (healthInfo.fasting_glucose_mgdl != null && healthInfo.fasting_glucose_mgdl >= 126) ||
      (healthInfo.hba1c_percent != null && healthInfo.hba1c_percent >= 6.5);
    const softDrinks = (healthInfo.diet_frequencies as DietFrequencies | null)?.soft_drinks;
    const liver =
      type.key === 'liver'
        ? computeLiverRisk({
            viralHepatitis: healthInfo.viral_hepatitis ?? null,
            neverTestedHepatitis:
              healthInfo.hepatitis_tested === false ? true : healthInfo.hepatitis_tested === true ? false : null,
            alcohol: healthInfo.alcohol ?? null,
            frequentPainkillers: healthInfo.frequent_painkiller_use ?? null,
            herbalRemedies: healthInfo.herbal_remedy_use ?? null,
            smoking: healthInfo.smoking ?? null,
            bmi: healthInfo.bmi ?? null,
            diabetes: diabetesSignal ? true : null,
            sugaryDiet: softDrinks === 'daily' || softDrinks === 'w35' ? true : null,
            familyLiverDisease: healthInfo.family_liver_disease ?? null,
            riskyBloodExposure: healthInfo.risky_blood_exposure ?? null,
          })
        : null;

    const apiResult = fsrp || htn || dia || kidney || liver ? null : await predictCondition(type.key, apiInput);

    const score = fsrp?.tenYearRiskPercent ?? htn?.score ?? diaOutcome?.score ?? kidney?.score ?? liver?.score ?? apiResult?.score ?? computeScore(healthInfo);
    const level = fsrp?.riskLevel ?? htn?.band ?? diaOutcome?.band ?? kidney?.band ?? liver?.band ?? apiResult?.riskLevel ?? levelForScore(score, type.key);

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
          model_tier: fsrp || htn || dia || kidney || liver ? 'equation' : apiResult?.modelTier ?? (healthInfo.fasting_glucose_mgdl != null ? 'full' : 'core'),
          source: fsrp ? 'fsrp' : htn ? 'nidrs' : diaOutcome ? diaOutcome.source : kidney ? 'kidney' : liver ? 'liver' : apiResult ? 'api' : 'heuristic',
          ...(htn
            ? {
                factors: htn.factors,
                nidrs_score: htn.nidrsScore,
                nidrs_category: htn.nidrsCategory,
              }
            : {}),
          ...(diaOutcome && dia
            ? {
                factors: diaOutcome.factors,
                findrisc_score: dia.score,
                findrisc_category: dia.findriscCategory,
                findrisc_answered: dia.answered,
                reading_category: diaOutcome.readingCategory,
              }
            : {}),
          ...(kidney
            ? {
                factors: kidney.factors,
                kidney_points: kidney.points,
              }
            : {}),
          ...(liver
            ? {
                factors: liver.factors,
                liver_points: liver.points,
              }
            : {}),
          ...(fsrp
            ? {
                factors: fsrp.factors.map((f) => ({
                  key: f.key,
                  name: f.name,
                  detail: f.detail,
                  category: f.points > 0 ? 'increase' : 'protective',
                  impact: f.points,
                  icon: FSRP_ICONS[f.key] ?? 'alert-circle-outline',
                  tip: null,
                })),
                fsrp_points: fsrp.totalPoints,
                fsrp_used_fallback: fsrp.usedFallback,
              }
            : apiResult
              ? { factors: apiResult.factors }
              : {}),
          ...(type.key === 'high_blood_sugar' ? { shares_model_with: 'diabetes' } : {}),
        },
        created_at: new Date().toISOString(),
      });
      if (insertError) {
        setRunning(false);
        setError(friendlyError(insertError));
        return;
      }
    }
    setRunning(false);
    successHaptic();
    setResult({ type, score, level });
    setAssessedTypes((prev) => new Set(prev).add(type.key));
    // If this condition is now a risk and reminders are on, switch on its daily
    // reminder automatically (self-guards; won't re-enable a removed one).
    void autoEnableRelevantReminders();
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
