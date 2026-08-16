import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
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
import { createConsultationRequest } from '../lib/consultations';
import { friendlyError } from '../lib/errors';
import { hasProvidedNin } from '../lib/nin';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'RequestConsultation'>;

const COMMON_SYMPTOMS = [
  'Fever',
  'Headache',
  'Fatigue',
  'Dizziness',
  'Frequent urination',
  'Excessive thirst',
  'Blurred vision',
  'Chest pain',
  'Shortness of breath',
  'Cough',
  'Stomach pain',
  'Nausea',
  'Body pain',
  'Weight loss',
];

const DURATIONS = ['Today', 'A few days', 'A week+', 'A month+'];

const SEVERITIES: { key: 'mild' | 'moderate' | 'severe'; label: string; color: string }[] = [
  { key: 'mild', label: 'Mild', color: colors.primaryGreen },
  { key: 'moderate', label: 'Moderate', color: '#F59E0B' },
  { key: 'severe', label: 'Severe', color: colors.danger },
];

export function RequestConsultationScreen({ navigation }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState<string | null>(null);
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [ninOk, setNinOk] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      hasProvidedNin().then((ok) => {
        if (active) setNinOk(ok);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const toggleSymptom = (symptom: string) => {
    setSelected((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom],
    );
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setError(null);

    if (selected.length === 0 && !notes.trim()) {
      setError('Please select at least one symptom or describe how you feel.');
      return;
    }
    if (!duration) {
      setError('Please say how long you have felt this way.');
      return;
    }
    if (!severity) {
      setError('Please choose how severe it feels.');
      return;
    }

    const symptomText = [selected.join(', '), notes.trim()].filter(Boolean).join('. ');

    setSubmitting(true);
    const { error: requestError } = await createConsultationRequest({
      symptoms: symptomText,
      severity,
      duration,
    });
    setSubmitting(false);

    if (requestError) {
      setError(friendlyError(requestError));
      return;
    }
    setSent(true);
  };

  if (ninOk === false) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <PatternBackground />
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Talk to a Doctor</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.successWrap}>
          <View style={styles.gateIcon}>
            <MaterialCommunityIcons name="shield-lock-outline" size={40} color={colors.darkAccentGreen} />
          </View>
          <Text style={styles.successTitle}>Verify your identity first</Text>
          <Text style={styles.successBody}>
            Before you can chat with a professional, we need your NIN on file. It stays encrypted
            and private, and keeps everyone accountable if a problem is ever reported.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('VerifyNin')}>
            <Text style={styles.primaryButtonText}>Verify with NIN</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (sent) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <PatternBackground />
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={44} color={colors.white} />
          </View>
          <Text style={styles.successTitle}>Request sent</Text>
          <Text style={styles.successBody}>
            Verified medical practitioners can now see your request. You'll be notified as soon as
            one accepts and opens a secure chat with you.
          </Text>
          <View style={styles.emergencyNote}>
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.emergencyText}>
              If this is an emergency, call 112 or go to the nearest hospital now. Do not wait.
            </Text>
          </View>
          <Pressable style={styles.primaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryButtonText}>Done</Text>
          </Pressable>
        </View>
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
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Talk to a Doctor</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.intro}>
            Tell us how you feel. Your request goes to verified practitioners, and whoever accepts
            first will start a private chat with you.
          </Text>

          <Text style={styles.sectionTitle}>What are you feeling?</Text>
          <View style={styles.chipsWrap}>
            {COMMON_SYMPTOMS.map((symptom) => {
              const active = selected.includes(symptom);
              return (
                <Pressable
                  key={symptom}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleSymptom(symptom)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{symptom}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Anything else? (optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Describe what you're experiencing in your own words..."
            placeholderTextColor={colors.inputPlaceholder}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={notes}
            onChangeText={setNotes}
          />

          <Text style={styles.sectionTitle}>How long have you felt this way?</Text>
          <View style={styles.chipsWrap}>
            {DURATIONS.map((option) => {
              const active = duration === option;
              return (
                <Pressable
                  key={option}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setDuration(option)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>How severe does it feel?</Text>
          <View style={styles.severityRow}>
            {SEVERITIES.map((option) => {
              const active = severity === option.key;
              return (
                <Pressable
                  key={option.key}
                  style={[
                    styles.severityButton,
                    active && { borderColor: option.color, backgroundColor: `${option.color}18` },
                  ]}
                  onPress={() => setSeverity(option.key)}
                >
                  <Text style={[styles.severityText, active && { color: option.color }]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {severity === 'severe' ? (
            <View style={styles.severeWarning}>
              <MaterialCommunityIcons name="alert-circle" size={20} color={colors.danger} />
              <Text style={styles.severeWarningText}>
                If you have danger signs like chest pain, trouble breathing, heavy bleeding, or
                fainting, call 112 or go to the nearest hospital immediately instead of waiting for
                a reply.
              </Text>
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {submitting ? (
            <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.spinner} />
          ) : (
            <Pressable style={styles.primaryButton} onPress={handleSubmit}>
              <Text style={styles.primaryButtonText}>Send Request</Text>
            </Pressable>
          )}

          <Text style={styles.disclaimer}>
            HealthCheck does not replace professional medical advice, diagnosis or treatment.
          </Text>
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
  content: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  intro: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  sectionTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15.5,
    color: colors.textPrimary,
    marginTop: 22,
    marginBottom: 10,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipActive: {
    backgroundColor: colors.primaryGreen,
    borderColor: colors.primaryGreen,
  },
  chipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.white,
  },
  notesInput: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 100,
    fontFamily: fonts.bodyRegular,
    fontSize: 14.5,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  severityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  severityButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  severityText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  severeWarning: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FDE8E8',
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
  },
  severeWarningText: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#A33',
  },
  errorText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.danger,
    textAlign: 'center',
    marginTop: 18,
  },
  spinner: {
    height: 56,
    marginTop: 22,
  },
  primaryButton: {
    backgroundColor: colors.primaryGreen,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingHorizontal: 32,
    marginTop: 22,
  },
  primaryButtonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.white,
  },
  disclaimer: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 14,
  },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  successIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primaryGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.textPrimary,
    marginTop: 18,
  },
  successBody: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  emergencyNote: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FDE8E8',
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
  },
  emergencyText: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#A33',
  },
});
