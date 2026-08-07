import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormField } from '../components/forms/FormField';
import { PatternBackground } from '../components/ui/PatternBackground';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ChangePassword'>;

export function ChangePasswordScreen({ navigation }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const handleSave = async () => {
    if (saving) return;
    setMessage(null);

    if (!currentPassword) {
      setMessage({ kind: 'error', text: 'Please enter your current password.' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ kind: 'error', text: 'Your new password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ kind: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const email = sessionData.session?.user.email;
    if (!email) {
      setMessage({ kind: 'error', text: 'You must be signed in to change your password.' });
      return;
    }

    setSaving(true);

    // Re-verify identity with the current password before allowing a change,
    // so someone who picks up an unlocked, still-logged-in phone can't
    // silently lock the real owner out.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (signInError) {
      setSaving(false);
      setMessage({ kind: 'error', text: 'Your current password is incorrect.' });
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);

    if (error) {
      setMessage({ kind: 'error', text: error.message });
      return;
    }
    setMessage({ kind: 'success', text: 'Password changed.' });
    setTimeout(() => navigation.goBack(), 700);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <PatternBackground height={380} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.headerTitle}>Change Password</Text>
            <View style={{ width: 24 }} />
          </View>

          <FormField
            label="Current password"
            placeholder="********"
            secureTextEntry
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />
          <FormField
            label="New password"
            placeholder="At least 6 characters"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <FormField
            label="Confirm new password"
            placeholder="********"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          {message ? (
            <Text style={message.kind === 'error' ? styles.errorText : styles.successText}>{message.text}</Text>
          ) : null}

          {saving ? (
            <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.spinner} />
          ) : (
            <Pressable style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Update Password</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 20,
  },
  headerTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
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
  spinner: { height: 56 },
  saveButton: {
    backgroundColor: colors.primaryGreen,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.white,
  },
});
