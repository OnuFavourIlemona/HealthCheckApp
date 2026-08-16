import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PatternBackground } from '../components/ui/PatternBackground';
import { friendlyError } from '../lib/errors';
import { storeNin } from '../lib/nin';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyNin'>;

export function VerifyNinScreen({ navigation }: Props) {
  const [nin, setNin] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const handleSave = async () => {
    if (saving) return;
    setMessage(null);
    if (!/^\d{11}$/.test(nin.trim())) {
      setMessage({ kind: 'error', text: 'Your NIN is exactly 11 digits.' });
      return;
    }
    setSaving(true);
    const { error } = await storeNin(nin);
    setSaving(false);
    if (error) {
      setMessage({ kind: 'error', text: friendlyError(error) });
      return;
    }
    setMessage({ kind: 'success', text: 'Identity confirmed. You can now use ProConnect.' });
    setTimeout(() => navigation.goBack(), 900);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <PatternBackground height={360} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.back}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>

          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="shield-lock-outline" size={34} color={colors.darkAccentGreen} />
          </View>

          <Text style={styles.title}>Verify your identity</Text>
          <Text style={styles.subtitle}>
            Enter your National Identification Number (NIN). We use it only to confirm you are a real
            person, so everyone stays accountable if a dispute is ever reported. It is needed once,
            before you can chat with a professional on ProConnect.
          </Text>

          <Text style={styles.label}>NIN</Text>
          <TextInput
            style={styles.input}
            placeholder="11 digits"
            placeholderTextColor={colors.inputPlaceholder}
            keyboardType="number-pad"
            maxLength={11}
            value={nin}
            onChangeText={setNin}
          />

          <View style={styles.privacyCard}>
            <View style={styles.privacyHeaderRow}>
              <Ionicons name="shield-checkmark" size={16} color={colors.darkAccentGreen} />
              <Text style={styles.privacyTitle}>Your NIN is safe with us</Text>
            </View>
            <View style={styles.privacyLine}>
              <Ionicons name="lock-closed" size={14} color={colors.darkAccentGreen} />
              <Text style={styles.privacyLineText}>
                It is encrypted the moment you enter it, so it is never kept as plain text.
              </Text>
            </View>
            <View style={styles.privacyLine}>
              <Ionicons name="eye-off" size={14} color={colors.darkAccentGreen} />
              <Text style={styles.privacyLineText}>
                No one can see it. Not the doctor you chat with, not other users, not even our staff.
              </Text>
            </View>
            <View style={styles.privacyLine}>
              <Ionicons name="document-text-outline" size={14} color={colors.darkAccentGreen} />
              <Text style={styles.privacyLineText}>
                It is only ever used to confirm your identity if a dispute is reported, the way
                trusted apps and banks do it.
              </Text>
            </View>
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
              <Text style={styles.saveButtonText}>Confirm Identity</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 },
  back: { marginBottom: 12 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    marginTop: 8,
    marginBottom: 22,
  },
  label: {
    fontFamily: fonts.headingMedium,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontFamily: fonts.bodyRegular,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.textPrimary,
  },
  privacyCard: {
    backgroundColor: colors.pillGreenBg,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    gap: 10,
  },
  privacyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  privacyTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 13.5,
    color: colors.darkAccentGreen,
  },
  privacyLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  privacyLineText: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  errorText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.danger,
    textAlign: 'center',
    marginTop: 16,
  },
  successText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.darkAccentGreen,
    textAlign: 'center',
    marginTop: 16,
  },
  spinner: { height: 56, marginTop: 16 },
  saveButton: {
    backgroundColor: colors.primaryGreen,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.white,
  },
});
