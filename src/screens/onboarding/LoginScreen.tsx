import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthHeader } from '../../components/forms/AuthHeader';
import { FormField } from '../../components/forms/FormField';
import { ProceedButton } from '../../components/forms/ProceedButton';
import { PatternBackground } from '../../components/ui/PatternBackground';
import { friendlyError } from '../../lib/errors';
import { setHasOnboarded } from '../../lib/onboardingState';
import { registerForPushNotifications } from '../../lib/pushNotifications';
import { rescheduleAllHealthReminders } from '../../lib/healthReminders';
import { refreshPeriodReminders } from '../../lib/periodTracker';
import { autoEnableRelevantReminders } from '../../lib/autoReminders';
import { ensureBirthdayReminder } from '../../lib/wellnessReminders';
import { getSessionRole, supabase } from '../../lib/supabase';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (submitting) return;
    setError(null);
    setEmailError(null);
    setPasswordError(null);

    let hasFieldError = false;
    if (!email.trim()) {
      setEmailError('Please enter your email.');
      hasFieldError = true;
    } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setEmailError('That email does not look right. Please check it, e.g. name@gmail.com');
      hasFieldError = true;
    }
    if (!password) {
      setPasswordError('Please enter your password.');
      hasFieldError = true;
    }
    if (hasFieldError) return;

    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setSubmitting(false);
      setError(friendlyError(signInError));
      return;
    }

    // getSessionRole() signs a deactivated account straight back out, so check
    // it before doing any of the sign-in side effects below.
    const role = await getSessionRole();
    if (!role) {
      setSubmitting(false);
      setError('This account has been deleted. Contact support if this was not you.');
      return;
    }

    await setHasOnboarded();
    void registerForPushNotifications();
    void rescheduleAllHealthReminders();
    void refreshPeriodReminders();
    void autoEnableRelevantReminders();
    void ensureBirthdayReminder();
    setSubmitting(false);
    const destination =
      role === 'pharmacy' ? 'PharmacyTabs' : role === 'patient' ? 'MainTabs' : 'ProTabs';
    navigation.reset({
      index: 0,
      routes: [{ name: destination }],
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <PatternBackground height={380} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AuthHeader onBack={() => navigation.goBack()} />

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Log in to continue taking charge of your health.</Text>

          <FormField
            label="Email"
            placeholder="Bhosa@gmail.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (emailError) setEmailError(null);
            }}
            error={emailError}
          />
          <FormField
            label="Password"
            placeholder="********"
            secureTextEntry
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (passwordError) setPasswordError(null);
            }}
            error={passwordError}
          />

          <Pressable
            style={styles.forgotRow}
            onPress={() => navigation.navigate('ForgotPassword')}
            hitSlop={8}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {submitting ? (
            <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.spinner} />
          ) : (
            <ProceedButton label="Log In" onPress={handleLogin} />
          )}

          <Pressable style={styles.signupRow} onPress={() => navigation.navigate('SelectRole')}>
            <Text style={styles.signupText}>
              Don't have an account? <Text style={styles.signupLink}>Sign Up</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 18,
    lineHeight: 28,
    color: colors.textPrimary,
    marginTop: 28,
  },
  subtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 8,
    marginBottom: 28,
    lineHeight: 21,
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: 18,
  },
  forgotText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.primaryGreen,
  },
  errorText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.danger,
    marginBottom: 14,
    textAlign: 'center',
  },
  spinner: {
    height: 64,
  },
  signupRow: {
    alignItems: 'center',
    marginTop: 20,
  },
  signupText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  signupLink: {
    fontFamily: fonts.bodySemiBold,
    color: colors.primaryGreen,
  },
});
