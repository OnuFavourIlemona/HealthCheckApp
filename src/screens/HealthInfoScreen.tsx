import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateOfBirthField } from '../components/forms/DateOfBirthField';
import { PatternBackground } from '../components/ui/PatternBackground';
import { ageFromDob, dobPartsFromIso, dobToIso, parseDob } from '../lib/dateOfBirth';
import { friendlyError } from '../lib/errors';
import { NIDRS_FOODS, type FoodFrequency } from '../lib/nidrs';
import { supabase } from '../lib/supabase';
import { clearBirthdayReminder } from '../lib/wellnessReminders';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'HealthInfo'>;

type YesNo = boolean | null;

function YesNoField({ label, value, onChange }: { label: string; value: YesNo; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.yesNoRow}>
        <Pressable
          style={[styles.yesNoButton, value === true && styles.yesNoActive]}
          onPress={() => onChange(true)}
        >
          <Text style={[styles.yesNoText, value === true && styles.yesNoTextActive]}>Yes</Text>
        </Pressable>
        <Pressable
          style={[styles.yesNoButton, value === false && styles.yesNoActive]}
          onPress={() => onChange(false)}
        >
          <Text style={[styles.yesNoText, value === false && styles.yesNoTextActive]}>No</Text>
        </Pressable>
      </View>
    </View>
  );
}

const MMOL_TO_MGDL = 18.0182;

function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Healthy weight';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

export function HealthInfoScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [gender, setGender] = useState<'female' | 'male' | null>(null);
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [smoking, setSmoking] = useState<YesNo>(null);
  const [familyDiabetes, setFamilyDiabetes] = useState<YesNo>(null);
  const [hypertension, setHypertension] = useState<YesNo>(null);
  const [knowsGlucose, setKnowsGlucose] = useState<YesNo>(null);
  const [glucoseValue, setGlucoseValue] = useState('');
  const [glucoseUnit, setGlucoseUnit] = useState<'mgdl' | 'mmol'>('mgdl');
  const [glucoseFasting, setGlucoseFasting] = useState<YesNo>(null);
  const [hba1c, setHba1c] = useState('');
  // Extra history — optional, but improves how well a practitioner (and, once
  // retrained, the models) can read the patient's risk.
  const [familyStroke, setFamilyStroke] = useState<YesNo>(null);
  const [heartDisease, setHeartDisease] = useState<YesNo>(null);
  const [alcohol, setAlcohol] = useState<YesNo>(null);
  const [knowsBP, setKnowsBP] = useState<YesNo>(null);
  const [bpSystolic, setBpSystolic] = useState('');
  const [bpDiastolic, setBpDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [exerciseDays, setExerciseDays] = useState('');
  const [carbIntake, setCarbIntake] = useState<'low' | 'moderate' | 'high' | null>(null);
  const [atrialFib, setAtrialFib] = useState<YesNo>(null);
  const [onBpMeds, setOnBpMeds] = useState<YesNo>(null);
  const [familyHypertension, setFamilyHypertension] = useState<YesNo>(null);
  const [waistCm, setWaistCm] = useState('');
  const [dailyFruitVeg, setDailyFruitVeg] = useState<YesNo>(null);
  const [everHighGlucose, setEverHighGlucose] = useState<YesNo>(null);
  const [familyKidney, setFamilyKidney] = useState<YesNo>(null);
  const [frequentPainkillers, setFrequentPainkillers] = useState<YesNo>(null);
  const [herbalRemedies, setHerbalRemedies] = useState<YesNo>(null);
  const [chronicInfection, setChronicInfection] = useState<YesNo>(null);
  const [waterCups, setWaterCups] = useState('');
  const [viralHepatitis, setViralHepatitis] = useState<YesNo>(null);
  const [hepatitisTested, setHepatitisTested] = useState<YesNo>(null);
  const [familyLiver, setFamilyLiver] = useState<YesNo>(null);
  const [riskyBloodExposure, setRiskyBloodExposure] = useState<YesNo>(null);
  const [dietFreq, setDietFreq] = useState<Record<string, FoodFrequency>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select(
          'date_of_birth, gender, height_cm, weight_kg, sleep_hours, smoking, family_diabetes, hypertension, fasting_glucose_mgdl, family_stroke, heart_disease, alcohol, bp_systolic, bp_diastolic, pulse_bpm, exercise_days_per_week, carb_intake, atrial_fibrillation, on_bp_medication, family_hypertension, waist_cm, daily_fruit_veg, ever_high_glucose, glucose_is_fasting, hba1c_percent, family_kidney_disease, frequent_painkiller_use, herbal_remedy_use, chronic_infection_history, water_cups_per_day, viral_hepatitis, hepatitis_tested, family_liver_disease, risky_blood_exposure, diet_frequencies',
        )
        .eq('id', userId)
        .maybeSingle();
      if (data) {
        if (data.date_of_birth) {
          const parts = dobPartsFromIso(data.date_of_birth);
          setDobDay(parts.day);
          setDobMonth(parts.month);
          setDobYear(parts.year);
        }
        if (data.gender === 'female' || data.gender === 'male') setGender(data.gender);
        if (data.height_cm != null) setHeightCm(String(data.height_cm));
        if (data.weight_kg != null) setWeightKg(String(data.weight_kg));
        if (data.sleep_hours != null) setSleepHours(String(data.sleep_hours));
        if (data.smoking != null) setSmoking(data.smoking);
        if (data.family_diabetes != null) setFamilyDiabetes(data.family_diabetes);
        if (data.hypertension != null) setHypertension(data.hypertension);
        if (data.fasting_glucose_mgdl != null) {
          setKnowsGlucose(true);
          setGlucoseValue(String(data.fasting_glucose_mgdl));
          setGlucoseUnit('mgdl');
        }
        if (data.glucose_is_fasting != null) setGlucoseFasting(data.glucose_is_fasting);
        if (data.hba1c_percent != null) setHba1c(String(data.hba1c_percent));
        if (data.family_stroke != null) setFamilyStroke(data.family_stroke);
        if (data.heart_disease != null) setHeartDisease(data.heart_disease);
        if (data.alcohol != null) setAlcohol(data.alcohol);
        if (data.bp_systolic != null || data.bp_diastolic != null) {
          setKnowsBP(true);
          if (data.bp_systolic != null) setBpSystolic(String(data.bp_systolic));
          if (data.bp_diastolic != null) setBpDiastolic(String(data.bp_diastolic));
        }
        if (data.pulse_bpm != null) setPulse(String(data.pulse_bpm));
        if (data.exercise_days_per_week != null) setExerciseDays(String(data.exercise_days_per_week));
        if (data.carb_intake === 'low' || data.carb_intake === 'moderate' || data.carb_intake === 'high') {
          setCarbIntake(data.carb_intake);
        }
        if (data.atrial_fibrillation != null) setAtrialFib(data.atrial_fibrillation);
        if (data.on_bp_medication != null) setOnBpMeds(data.on_bp_medication);
        if (data.family_hypertension != null) setFamilyHypertension(data.family_hypertension);
        if (data.waist_cm != null) setWaistCm(String(data.waist_cm));
        if (data.daily_fruit_veg != null) setDailyFruitVeg(data.daily_fruit_veg);
        if (data.ever_high_glucose != null) setEverHighGlucose(data.ever_high_glucose);
        if (data.family_kidney_disease != null) setFamilyKidney(data.family_kidney_disease);
        if (data.frequent_painkiller_use != null) setFrequentPainkillers(data.frequent_painkiller_use);
        if (data.herbal_remedy_use != null) setHerbalRemedies(data.herbal_remedy_use);
        if (data.chronic_infection_history != null) setChronicInfection(data.chronic_infection_history);
        if (data.water_cups_per_day != null) setWaterCups(String(data.water_cups_per_day));
        if (data.viral_hepatitis != null) setViralHepatitis(data.viral_hepatitis);
        if (data.hepatitis_tested != null) setHepatitisTested(data.hepatitis_tested);
        if (data.family_liver_disease != null) setFamilyLiver(data.family_liver_disease);
        if (data.risky_blood_exposure != null) setRiskyBloodExposure(data.risky_blood_exposure);
        if (data.diet_frequencies && typeof data.diet_frequencies === 'object') {
          setDietFreq(data.diet_frequencies as Record<string, FoodFrequency>);
        }
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (saving) return;
    setMessage(null);
    setFieldErrors({});

    const heightNum = Number(heightCm);
    const weightNum = Number(weightKg);
    const sleepNum = Number(sleepHours);
    const dob = parseDob(dobDay, dobMonth, dobYear);

    const errors: Record<string, string> = {};

    if (!dob) {
      errors.dob = 'Please enter your full date of birth.';
    } else {
      const age = ageFromDob(dob);
      if (age < 1 || age > 120) errors.dob = 'Please double-check your date of birth.';
    }
    if (!heightNum || heightNum < 100 || heightNum > 250) {
      errors.height = 'Enter a height between 100 and 250 cm.';
    }
    if (!weightNum || weightNum < 20 || weightNum > 300) {
      errors.weight = 'Enter a weight between 20 and 300 kg.';
    }
    if (!sleepNum || sleepNum < 1 || sleepNum > 16) {
      errors.sleep = 'Enter your average sleep between 1 and 16 hours.';
    }

    let fastingGlucoseMgdl: number | null = null;
    if (knowsGlucose) {
      const raw = Number(glucoseValue);
      const mgdl = glucoseUnit === 'mmol' ? raw * MMOL_TO_MGDL : raw;
      const validRange = glucoseUnit === 'mmol' ? raw >= 2 && raw <= 33 : raw >= 40 && raw <= 600;
      if (!raw || !validRange) {
        errors.glucose =
          glucoseUnit === 'mmol'
            ? 'Enter a blood sugar reading between 2 and 33 mmol/L, or choose "I don\'t know".'
            : 'Enter a blood sugar reading between 40 and 600 mg/dL, or choose "I don\'t know".';
      } else {
        fastingGlucoseMgdl = Math.round(mgdl * 10) / 10;
      }
    }

    let hba1cPercent: number | null = null;
    if (hba1c.trim()) {
      const raw = Number(hba1c);
      if (!raw || raw < 3 || raw > 20) {
        errors.hba1c = 'Enter an HbA1c between 3 and 20%, or leave it blank.';
      } else {
        hba1cPercent = Math.round(raw * 10) / 10;
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setMessage({ kind: 'error', text: 'Please fix the highlighted fields above.' });
      return;
    }

    if (smoking === null || familyDiabetes === null || hypertension === null) {
      setMessage({
        kind: 'error',
        text: 'Please answer the Yes/No questions about smoking, family diabetes, and blood pressure.',
      });
      return;
    }

    if (!dob) return; // Guarded above; keeps the type non-null below.
    const ageNum = ageFromDob(dob);
    const bmiNum = Math.round((weightNum / (heightNum / 100) ** 2) * 10) / 10;

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setMessage({ kind: 'error', text: 'You must be signed in to save your health info.' });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        age: ageNum,
        date_of_birth: dobToIso(dob),
        gender,
        height_cm: heightNum,
        weight_kg: weightNum,
        bmi: bmiNum,
        sleep_hours: sleepNum,
        smoking,
        family_diabetes: familyDiabetes,
        hypertension,
        fasting_glucose_mgdl: fastingGlucoseMgdl,
        glucose_is_fasting: knowsGlucose ? glucoseFasting : null,
        hba1c_percent: hba1cPercent,
        family_stroke: familyStroke,
        heart_disease: heartDisease,
        alcohol,
        bp_systolic: knowsBP && bpSystolic ? Number(bpSystolic) : null,
        bp_diastolic: knowsBP && bpDiastolic ? Number(bpDiastolic) : null,
        pulse_bpm: pulse ? Number(pulse) : null,
        exercise_days_per_week: exerciseDays ? Number(exerciseDays) : null,
        carb_intake: carbIntake,
        atrial_fibrillation: atrialFib,
        on_bp_medication: onBpMeds,
        family_hypertension: familyHypertension,
        waist_cm: waistCm ? Number(waistCm) : null,
        daily_fruit_veg: dailyFruitVeg,
        ever_high_glucose: everHighGlucose,
        family_kidney_disease: familyKidney,
        frequent_painkiller_use: frequentPainkillers,
        herbal_remedy_use: herbalRemedies,
        chronic_infection_history: chronicInfection,
        water_cups_per_day: waterCups ? Number(waterCups) : null,
        viral_hepatitis: viralHepatitis,
        hepatitis_tested: hepatitisTested,
        family_liver_disease: familyLiver,
        risky_blood_exposure: riskyBloodExposure,
        diet_frequencies: Object.keys(dietFreq).length > 0 ? dietFreq : null,
      })
      .eq('id', userId);
    setSaving(false);

    if (error) {
      setMessage({ kind: 'error', text: friendlyError(error) });
      return;
    }
    // A changed date of birth means any already-armed birthday alarm is now
    // on the wrong date -- clear it so it re-arms correctly next app open.
    void clearBirthdayReminder();
    setMessage({ kind: 'success', text: 'Health info saved.' });
    setTimeout(() => navigation.goBack(), 700);
  };

  const heightNumLive = Number(heightCm);
  const weightNumLive = Number(weightKg);
  const computedBmi =
    heightNumLive > 0 && weightNumLive > 0
      ? weightNumLive / (heightNumLive / 100) ** 2
      : null;
  const liveDob = parseDob(dobDay, dobMonth, dobYear);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.loader} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <PatternBackground />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.headerTitle}>My Health Info</Text>
            <View style={{ width: 24 }} />
          </View>

          <Text style={styles.sectionHint}>
            This information powers your risk predictions. Keep it accurate and up to date, and
            change any value whenever it changes in real life, like a new blood pressure reading.
          </Text>

          <DateOfBirthField
            day={dobDay}
            month={dobMonth}
            year={dobYear}
            onChangeDay={(v) => {
              setDobDay(v);
              clearFieldError('dob');
            }}
            onChangeMonth={(v) => {
              setDobMonth(v);
              clearFieldError('dob');
            }}
            onChangeYear={(v) => {
              setDobYear(v);
              clearFieldError('dob');
            }}
            ageHint={liveDob ? `Age ${ageFromDob(liveDob)}` : null}
          />
          {fieldErrors.dob ? (
            <View style={styles.inlineErrorRow}>
              <Ionicons name="alert-circle" size={15} color={colors.danger} />
              <Text style={styles.inlineErrorText}>{fieldErrors.dob}</Text>
            </View>
          ) : null}

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Gender</Text>
            <View style={styles.yesNoRow}>
              <Pressable
                style={[styles.yesNoButton, gender === 'female' && styles.yesNoActive]}
                onPress={() => setGender('female')}
              >
                <Text style={[styles.yesNoText, gender === 'female' && styles.yesNoTextActive]}>
                  Female
                </Text>
              </Pressable>
              <Pressable
                style={[styles.yesNoButton, gender === 'male' && styles.yesNoActive]}
                onPress={() => setGender('male')}
              >
                <Text style={[styles.yesNoText, gender === 'male' && styles.yesNoTextActive]}>
                  Male
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Height and weight</Text>
            <View style={styles.heightWeightRow}>
              <View style={styles.heightWeightField}>
                <TextInput
                  style={[styles.input, fieldErrors.height ? styles.inputError : null]}
                  placeholder="Height in cm"
                  placeholderTextColor={colors.inputPlaceholder}
                  keyboardType="numeric"
                  value={heightCm}
                  onChangeText={(v) => {
                    setHeightCm(v);
                    clearFieldError('height');
                  }}
                />
              </View>
              <View style={styles.heightWeightField}>
                <TextInput
                  style={[styles.input, fieldErrors.weight ? styles.inputError : null]}
                  placeholder="Weight in kg"
                  placeholderTextColor={colors.inputPlaceholder}
                  keyboardType="numeric"
                  value={weightKg}
                  onChangeText={(v) => {
                    setWeightKg(v);
                    clearFieldError('weight');
                  }}
                />
              </View>
            </View>
            {fieldErrors.height ? (
              <View style={styles.inlineErrorRow}>
                <Ionicons name="alert-circle" size={15} color={colors.danger} />
                <Text style={styles.inlineErrorText}>{fieldErrors.height}</Text>
              </View>
            ) : null}
            {fieldErrors.weight ? (
              <View style={styles.inlineErrorRow}>
                <Ionicons name="alert-circle" size={15} color={colors.danger} />
                <Text style={styles.inlineErrorText}>{fieldErrors.weight}</Text>
              </View>
            ) : null}
            {computedBmi != null ? (
              <Text style={styles.fieldHint}>
                Your BMI: {computedBmi.toFixed(1)} ({bmiCategory(computedBmi)})
              </Text>
            ) : (
              <Text style={styles.fieldHint}>
                We'll work out your BMI from this automatically.
              </Text>
            )}
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Average sleep per night (hours)</Text>
            <TextInput
              style={[styles.input, fieldErrors.sleep ? styles.inputError : null]}
              placeholder="e.g. 7"
              placeholderTextColor={colors.inputPlaceholder}
              keyboardType="numeric"
              value={sleepHours}
              onChangeText={(v) => {
                setSleepHours(v);
                clearFieldError('sleep');
              }}
            />
            {fieldErrors.sleep ? (
              <View style={styles.inlineErrorRow}>
                <Ionicons name="alert-circle" size={15} color={colors.danger} />
                <Text style={styles.inlineErrorText}>{fieldErrors.sleep}</Text>
              </View>
            ) : null}
          </View>

          <YesNoField label="Do you smoke?" value={smoking} onChange={setSmoking} />
          <YesNoField
            label="Family history of diabetes?"
            value={familyDiabetes}
            onChange={setFamilyDiabetes}
          />
          <YesNoField
            label="Have you been told you have high blood pressure?"
            value={hypertension}
            onChange={setHypertension}
          />

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Do you know your recent blood sugar level?</Text>
            <Text style={styles.fieldHint}>
              From a past lab test, a home glucose meter, or a blood sugar test booked in this
              app. This is optional, but it makes your diabetes prediction noticeably more
              accurate if you have a number handy.
            </Text>
            <View style={[styles.yesNoRow, styles.glucoseChoiceRow]}>
              <Pressable
                style={[styles.yesNoButton, knowsGlucose === true && styles.yesNoActive]}
                onPress={() => setKnowsGlucose(true)}
              >
                <Text style={[styles.yesNoText, knowsGlucose === true && styles.yesNoTextActive]}>
                  Yes, I have a number
                </Text>
              </Pressable>
              <Pressable
                style={[styles.yesNoButton, knowsGlucose === false && styles.yesNoActive]}
                onPress={() => {
                  setKnowsGlucose(false);
                  setGlucoseValue('');
                }}
              >
                <Text
                  style={[styles.yesNoText, knowsGlucose === false && styles.yesNoTextActive]}
                >
                  I don't know
                </Text>
              </Pressable>
            </View>

            {knowsGlucose ? (
              <View style={styles.glucoseInputRow}>
                <TextInput
                  style={[styles.input, styles.glucoseInput, fieldErrors.glucose ? styles.inputError : null]}
                  placeholder={glucoseUnit === 'mmol' ? 'e.g. 5.4' : 'e.g. 95'}
                  placeholderTextColor={colors.inputPlaceholder}
                  keyboardType="numeric"
                  value={glucoseValue}
                  onChangeText={(v) => {
                    setGlucoseValue(v);
                    clearFieldError('glucose');
                  }}
                />
                <View style={styles.unitToggle}>
                  <Pressable
                    style={[styles.unitChip, glucoseUnit === 'mgdl' && styles.unitChipActive]}
                    onPress={() => setGlucoseUnit('mgdl')}
                  >
                    <Text
                      style={[
                        styles.unitChipText,
                        glucoseUnit === 'mgdl' && styles.unitChipTextActive,
                      ]}
                    >
                      mg/dL
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.unitChip, glucoseUnit === 'mmol' && styles.unitChipActive]}
                    onPress={() => setGlucoseUnit('mmol')}
                  >
                    <Text
                      style={[
                        styles.unitChipText,
                        glucoseUnit === 'mmol' && styles.unitChipTextActive,
                      ]}
                    >
                      mmol/L
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            {fieldErrors.glucose ? (
              <View style={styles.inlineErrorRow}>
                <Ionicons name="alert-circle" size={15} color={colors.danger} />
                <Text style={styles.inlineErrorText}>{fieldErrors.glucose}</Text>
              </View>
            ) : null}

            {knowsGlucose ? (
              <View style={styles.fastingBlock}>
                <Text style={styles.fieldLabel}>Was this a fasting test?</Text>
                <Text style={styles.fieldHint}>
                  Fasting means you had not eaten for about 8 hours (usually a morning lab test). If
                  it was a random check (for example a pharmacy finger-prick after eating), choose
                  "After eating."
                </Text>
                <View style={[styles.yesNoRow, styles.glucoseChoiceRow]}>
                  <Pressable
                    style={[styles.yesNoButton, glucoseFasting === true && styles.yesNoActive]}
                    onPress={() => setGlucoseFasting(true)}
                  >
                    <Text style={[styles.yesNoText, glucoseFasting === true && styles.yesNoTextActive]}>
                      Fasting
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.yesNoButton, glucoseFasting === false && styles.yesNoActive]}
                    onPress={() => setGlucoseFasting(false)}
                  >
                    <Text style={[styles.yesNoText, glucoseFasting === false && styles.yesNoTextActive]}>
                      After eating
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Do you know your HbA1c? (optional)</Text>
            <Text style={styles.fieldHint}>
              HbA1c is a lab test showing your average blood sugar over about 3 months. It is the most
              reliable single number and does not need fasting. Leave blank if you do not have it.
            </Text>
            <TextInput
              style={[styles.input, fieldErrors.hba1c ? styles.inputError : null]}
              placeholder="e.g. 5.6 %"
              placeholderTextColor={colors.inputPlaceholder}
              keyboardType="numeric"
              maxLength={4}
              value={hba1c}
              onChangeText={(v) => {
                setHba1c(v);
                clearFieldError('hba1c');
              }}
            />
            {fieldErrors.hba1c ? (
              <View style={styles.inlineErrorRow}>
                <Ionicons name="alert-circle" size={15} color={colors.danger} />
                <Text style={styles.inlineErrorText}>{fieldErrors.hba1c}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.subsectionTitle}>A bit more history</Text>
          <Text style={styles.sectionHint}>
            All optional, but the more you share, the better your practitioner can advise you.
          </Text>

          <YesNoField
            label="Any family history of stroke?"
            value={familyStroke}
            onChange={setFamilyStroke}
          />
          <YesNoField
            label="Have you ever had a heart attack or heart disease?"
            value={heartDisease}
            onChange={setHeartDisease}
          />
          <YesNoField label="Do you drink alcohol?" value={alcohol} onChange={setAlcohol} />

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>How many days a week do you exercise?</Text>
            <TextInput
              style={styles.input}
              placeholder="0 to 7"
              placeholderTextColor={colors.inputPlaceholder}
              keyboardType="number-pad"
              maxLength={1}
              value={exerciseDays}
              onChangeText={setExerciseDays}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>How much starchy food (rice, garri, yam, bread) do you eat?</Text>
            <View style={styles.yesNoRow}>
              {(['low', 'moderate', 'high'] as const).map((level) => (
                <Pressable
                  key={level}
                  style={[styles.yesNoButton, carbIntake === level && styles.yesNoActive]}
                  onPress={() => setCarbIntake(level)}
                >
                  <Text style={[styles.yesNoText, carbIntake === level && styles.yesNoTextActive]}>
                    {level === 'low' ? 'A little' : level === 'moderate' ? 'Moderate' : 'A lot'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Do you know your latest blood pressure?</Text>
            <View style={[styles.yesNoRow, styles.glucoseChoiceRow]}>
              <Pressable
                style={[styles.yesNoButton, knowsBP === true && styles.yesNoActive]}
                onPress={() => setKnowsBP(true)}
              >
                <Text style={[styles.yesNoText, knowsBP === true && styles.yesNoTextActive]}>
                  Yes, I have it
                </Text>
              </Pressable>
              <Pressable
                style={[styles.yesNoButton, knowsBP === false && styles.yesNoActive]}
                onPress={() => {
                  setKnowsBP(false);
                  setBpSystolic('');
                  setBpDiastolic('');
                }}
              >
                <Text style={[styles.yesNoText, knowsBP === false && styles.yesNoTextActive]}>
                  I don't know
                </Text>
              </Pressable>
            </View>
            {knowsBP ? (
              <View style={styles.glucoseInputRow}>
                <TextInput
                  style={[styles.input, styles.glucoseInput]}
                  placeholder="Systolic (e.g. 120)"
                  placeholderTextColor={colors.inputPlaceholder}
                  keyboardType="number-pad"
                  maxLength={3}
                  value={bpSystolic}
                  onChangeText={setBpSystolic}
                />
                <TextInput
                  style={[styles.input, styles.glucoseInput]}
                  placeholder="Diastolic (e.g. 80)"
                  placeholderTextColor={colors.inputPlaceholder}
                  keyboardType="number-pad"
                  maxLength={3}
                  value={bpDiastolic}
                  onChangeText={setBpDiastolic}
                />
              </View>
            ) : null}
          </View>

          <YesNoField
            label="Are you on blood pressure medication?"
            value={onBpMeds}
            onChange={setOnBpMeds}
          />
          <YesNoField
            label="Have you been diagnosed with atrial fibrillation (an irregular heartbeat)?"
            value={atrialFib}
            onChange={setAtrialFib}
          />

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Resting pulse rate (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 72 beats per minute"
              placeholderTextColor={colors.inputPlaceholder}
              keyboardType="number-pad"
              maxLength={3}
              value={pulse}
              onChangeText={setPulse}
            />
          </View>

          <YesNoField
            label="Does a parent or sibling have high blood pressure?"
            value={familyHypertension}
            onChange={setFamilyHypertension}
          />

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Waist size (optional)</Text>
            <Text style={styles.sectionHint}>
              Measure around your belly button, midway between your lowest rib and your hip bone. Belly fat
              is one of the strongest warning signs for diabetes.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 90 cm"
              placeholderTextColor={colors.inputPlaceholder}
              keyboardType="number-pad"
              maxLength={3}
              value={waistCm}
              onChangeText={setWaistCm}
            />
          </View>

          <YesNoField
            label="Do you eat fruits or vegetables every day?"
            value={dailyFruitVeg}
            onChange={setDailyFruitVeg}
          />
          <YesNoField
            label="Have you ever been told your blood sugar was high (at a check-up, during pregnancy, or an illness)?"
            value={everHighGlucose}
            onChange={setEverHighGlucose}
          />

          <Text style={styles.subsectionTitle}>Kidney health</Text>
          <Text style={styles.sectionHint}>
            Kidney trouble is rising fast in Nigeria and often shows no signs early. These few
            questions help us spot it before it becomes serious.
          </Text>

          <YesNoField
            label="Does a close relative have kidney disease, or are they on dialysis?"
            value={familyKidney}
            onChange={setFamilyKidney}
          />
          <YesNoField
            label="Do you take pain medicine (like ibuprofen, diclofenac, APC, or tramadol) more than once or twice a week?"
            value={frequentPainkillers}
            onChange={setFrequentPainkillers}
          />
          <YesNoField
            label="Do you regularly drink herbal mixtures like agbo or paraga?"
            value={herbalRemedies}
            onChange={setHerbalRemedies}
          />
          <YesNoField
            label="Have you been told you have hepatitis B, hepatitis C, HIV, or repeated urinary infections?"
            value={chronicInfection}
            onChange={setChronicInfection}
          />

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>About how many cups of water do you drink a day?</Text>
            <Text style={styles.fieldHint}>
              A rough number is fine. Drinking too little, especially in hot weather, is hard on
              the kidneys.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 6"
              placeholderTextColor={colors.inputPlaceholder}
              keyboardType="number-pad"
              maxLength={2}
              value={waterCups}
              onChangeText={setWaterCups}
            />
          </View>

          <Text style={styles.subsectionTitle}>Liver health</Text>
          <Text style={styles.sectionHint}>
            Hepatitis B alone affects about 1 in 10 Nigerians, and most never know. A few questions
            help us flag liver risk early, while it can still be treated.
          </Text>

          <YesNoField
            label="Have you been told you have hepatitis B or C?"
            value={viralHepatitis}
            onChange={setViralHepatitis}
          />
          <YesNoField
            label="Have you ever been tested for hepatitis B or C?"
            value={hepatitisTested}
            onChange={setHepatitisTested}
          />
          <YesNoField
            label="Does a close relative have liver disease or liver cancer?"
            value={familyLiver}
            onChange={setFamilyLiver}
          />
          <YesNoField
            label="Have you had a blood transfusion, tribal marks, a tattoo, shared blades, or injections from an unqualified person?"
            value={riskyBloodExposure}
            onChange={setRiskyBloodExposure}
          />

          <Text style={styles.subsectionTitle}>Your typical diet</Text>
          <Text style={styles.sectionHint}>
            How often do you usually eat these? This powers your hypertension risk, using a score
            built and validated in Nigeria.
          </Text>

          {NIDRS_FOODS.map((food) => (
            <View key={food.key} style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{food.label}</Text>
              <Text style={styles.fieldHint}>{food.examples}</Text>
              <View style={styles.dietRow}>
                {(
                  [
                    ['rarely', 'Rarely'],
                    ['w12', '1-2/wk'],
                    ['w35', '3-5/wk'],
                    ['daily', 'Daily+'],
                  ] as const
                ).map(([value, label]) => (
                  <Pressable
                    key={value}
                    style={[styles.dietChip, dietFreq[food.key] === value && styles.yesNoActive]}
                    onPress={() => setDietFreq((prev) => ({ ...prev, [food.key]: value }))}
                  >
                    <Text
                      style={[styles.dietChipText, dietFreq[food.key] === value && styles.yesNoTextActive]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}

          {message ? (
            <Text style={message.kind === 'error' ? styles.errorText : styles.successText}>
              {message.text}
            </Text>
          ) : null}

          {saving ? (
            <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.spinner} />
          ) : (
            <Pressable style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save Health Info</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  loader: {
    marginTop: 80,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
  },
  sectionHint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textSecondary,
    marginTop: 10,
    marginBottom: 16,
  },
  subsectionTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  fieldBlock: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontFamily: fonts.headingMedium,
    fontSize: 14,
    lineHeight: 19.6,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.textPrimary,
  },
  inputError: {
    borderColor: colors.danger,
  },
  inlineErrorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
  },
  inlineErrorText: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.danger,
  },
  fieldHint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textMuted,
    marginTop: 6,
  },
  heightWeightRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dietRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  dietChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  dietChipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  heightWeightField: {
    flex: 1,
  },
  yesNoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  glucoseChoiceRow: {
    marginTop: 4,
  },
  glucoseInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  fastingBlock: {
    marginTop: 16,
  },
  glucoseInput: {
    flex: 1,
  },
  unitToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  unitChip: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  unitChipActive: {
    backgroundColor: colors.pillGreenBg,
  },
  unitChipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  unitChipTextActive: {
    color: colors.darkAccentGreen,
  },
  yesNoButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  yesNoActive: {
    borderColor: colors.primaryGreen,
    backgroundColor: colors.pillGreenBg,
  },
  yesNoText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  yesNoTextActive: {
    color: colors.darkAccentGreen,
  },
  errorText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 14,
  },
  successText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.darkAccentGreen,
    textAlign: 'center',
    marginBottom: 14,
  },
  spinner: {
    height: 56,
  },
  saveButton: {
    backgroundColor: colors.primaryGreen,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveButtonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.white,
  },
});
