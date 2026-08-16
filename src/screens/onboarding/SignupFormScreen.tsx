import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthHeader } from '../../components/forms/AuthHeader';
import { FormField } from '../../components/forms/FormField';
import { ProceedButton } from '../../components/forms/ProceedButton';
import { PatternBackground } from '../../components/ui/PatternBackground';
import { friendlyError } from '../../lib/errors';
import { signUpWithRole, type UserRole } from '../../lib/supabase';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts } from '../../theme';

export type SignupField = {
  key: string;
  label: string;
  placeholder: string;
  helperText?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
};

type Props = {
  title: string;
  subtitle: string;
  fields: SignupField[];
  role: UserRole;
  /** Which field key holds the person/company name to store on the profile. */
  nameFieldKey: string;
  onBack: () => void;
  onProceed: () => void;
};

export function SignupFormScreen({ title, subtitle, fields, role, nameFieldKey, onBack, onProceed }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const setValue = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Clear a field's error as soon as the user starts fixing it.
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleProceed = async () => {
    if (submitting) return;
    setError(null);

    const email = values.email?.trim() ?? '';
    const password = values.password ?? '';
    const confirmPassword = values.confirmPassword ?? '';
    const fullName = values[nameFieldKey]?.trim() ?? '';

    const errors: Record<string, string> = {};
    if (!fullName) {
      const nameLabel = fields.find((f) => f.key === nameFieldKey)?.label ?? 'name';
      errors[nameFieldKey] = `Please enter the ${nameLabel.toLowerCase()}.`;
    }
    if (!email) {
      errors.email = 'Please enter your email.';
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      errors.email = 'That email does not look right. Please check it, e.g. name@gmail.com';
    }
    if (!password) {
      errors.password = 'Please create a password.';
    } else if (password.length < 8) {
      errors.password = 'Your password should be at least 8 characters.';
    }
    if (!confirmPassword) {
      errors.confirmPassword = 'Please type your password again.';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'The two passwords do not match.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setSubmitting(true);
    const { data, error: signUpError } = await signUpWithRole({ email, password, fullName, role });
    setSubmitting(false);

    if (signUpError) {
      setError(friendlyError(signUpError));
      return;
    }
    // No session back means the project requires email confirmation before
    // sign-in — send them to wait for it instead of straight into the app.
    if (!data.session) {
      navigation.navigate('CheckEmail', { email });
      return;
    }
    onProceed();
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
          <AuthHeader onBack={onBack} />

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {fields.map((field) => (
            <FormField
              key={field.key}
              label={field.label}
              placeholder={field.placeholder}
              helperText={field.helperText}
              secureTextEntry={field.secureTextEntry}
              keyboardType={field.keyboardType}
              autoCapitalize={field.keyboardType === 'email-address' ? 'none' : 'words'}
              value={values[field.key] ?? ''}
              onChangeText={(text) => setValue(field.key, text)}
              error={fieldErrors[field.key]}
            />
          ))}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {submitting ? (
            <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.spinner} />
          ) : (
            <ProceedButton onPress={handleProceed} />
          )}
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
  // Real values from Figma inspector: title is Poppins SemiBold 18/28, not 22.
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
});
