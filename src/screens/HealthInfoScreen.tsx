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
import { PatternBackground } from '../components/ui/PatternBackground';
import { supabase } from '../lib/supabase';
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
  const [age, setAge] = useState('');
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
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

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
          'age, gender, height_cm, weight_kg, sleep_hours, smoking, family_diabetes, hypertension, fasting_glucose_mgdl',
        )
        .eq('id', userId)
        .maybeSingle();
      if (data) {
        if (data.age != null) setAge(String(data.age));
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
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (saving) return;
    setMessage(null);

    const ageNum = Number(age);
    const heightNum = Number(heightCm);
    const weightNum = Number(weightKg);
    const sleepNum = Number(sleepHours);
    if (!ageNum || ageNum < 1 || ageNum > 120) {
      setMessage({ kind: 'error', text: 'Please enter a valid age.' });
      return;
    }
    if (!heightNum || heightNum < 100 || heightNum > 250) {
      setMessage({ kind: 'error', text: 'Please enter a valid height in centimetres (100-250).' });
      return;
    }
    if (!weightNum || weightNum < 20 || weightNum > 300) {
      setMessage({ kind: 'error', text: 'Please enter a valid weight in kilograms (20-300).' });
      return;
    }
    const bmiNum = Math.round((weightNum / (heightNum / 100) ** 2) * 10) / 10;
    if (!sleepNum || sleepNum < 1 || sleepNum > 16) {
      setMessage({ kind: 'error', text: 'Please enter valid average sleep hours.' });
      return;
    }
    if (smoking === null || familyDiabetes === null || hypertension === null) {
      setMessage({ kind: 'error', text: 'Please answer all Yes/No questions.' });
      return;
    }

    let fastingGlucoseMgdl: number | null = null;
    if (knowsGlucose) {
      const raw = Number(glucoseValue);
      const mgdl = glucoseUnit === 'mmol' ? raw * MMOL_TO_MGDL : raw;
      const validRange = glucoseUnit === 'mmol' ? raw >= 2 && raw <= 33 : raw >= 40 && raw <= 600;
      if (!raw || !validRange) {
        setMessage({
          kind: 'error',
          text:
            glucoseUnit === 'mmol'
              ? 'Please enter a valid blood sugar reading (2-33 mmol/L), or switch to "I don\'t know."'
              : 'Please enter a valid blood sugar reading (40-600 mg/dL), or switch to "I don\'t know."',
        });
        return;
      }
      fastingGlucoseMgdl = Math.round(mgdl * 10) / 10;
    }

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
        gender,
        height_cm: heightNum,
        weight_kg: weightNum,
        bmi: bmiNum,
        sleep_hours: sleepNum,
        smoking,
        family_diabetes: familyDiabetes,
        hypertension,
        fasting_glucose_mgdl: fastingGlucoseMgdl,
      })
      .eq('id', userId);
    setSaving(false);

    if (error) {
      setMessage({ kind: 'error', text: error.message });
      return;
    }
    setMessage({ kind: 'success', text: 'Health info saved.' });
    setTimeout(() => navigation.goBack(), 700);
  };

  const heightNumLive = Number(heightCm);
  const weightNumLive = Number(weightKg);
  const computedBmi =
    heightNumLive > 0 && weightNumLive > 0
      ? weightNumLive / (heightNumLive / 100) ** 2
      : null;

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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Age</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 34"
              placeholderTextColor={colors.inputPlaceholder}
              keyboardType="numeric"
              value={age}
              onChangeText={setAge}
            />
          </View>

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
                  style={styles.input}
                  placeholder="Height in cm"
                  placeholderTextColor={colors.inputPlaceholder}
                  keyboardType="numeric"
                  value={heightCm}
                  onChangeText={setHeightCm}
                />
              </View>
              <View style={styles.heightWeightField}>
                <TextInput
                  style={styles.input}
                  placeholder="Weight in kg"
                  placeholderTextColor={colors.inputPlaceholder}
                  keyboardType="numeric"
                  value={weightKg}
                  onChangeText={setWeightKg}
                />
              </View>
            </View>
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
              style={styles.input}
              placeholder="e.g. 7"
              placeholderTextColor={colors.inputPlaceholder}
              keyboardType="numeric"
              value={sleepHours}
              onChangeText={setSleepHours}
            />
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
                  style={[styles.input, styles.glucoseInput]}
                  placeholder={glucoseUnit === 'mmol' ? 'e.g. 5.4' : 'e.g. 95'}
                  placeholderTextColor={colors.inputPlaceholder}
                  keyboardType="numeric"
                  value={glucoseValue}
                  onChangeText={setGlucoseValue}
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
          </View>

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
