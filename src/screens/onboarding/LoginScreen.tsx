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
import { getSessionRole, supabase } from '../../lib/supabase';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (submitting) return;
    setError(null);

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setSubmitting(false);
      setError(signInError.message);
      return;
    }

    const role = await getSessionRole();
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
            onChangeText={setEmail}
          />
          <FormField
            label="Password"
            placeholder="********"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

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
