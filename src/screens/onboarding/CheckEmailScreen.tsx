import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PatternBackground } from '../../components/ui/PatternBackground';
import { friendlyError } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CheckEmail'>;

const RESEND_COOLDOWN_SECONDS = 30;

export function CheckEmailScreen({ navigation, route }: Props) {
  const { email } = route.params;
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const handleResend = async () => {
    if (resending || cooldown > 0) return;
    setMessage(null);
    setResending(true);

    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setResending(false);

    if (error) {
      setMessage({ kind: 'error', text: friendlyError(error) });
      return;
    }
    setMessage({ kind: 'success', text: 'Confirmation email resent.' });
    setCooldown(RESEND_COOLDOWN_SECONDS);
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <PatternBackground height={360} />
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="mail-outline" size={40} color={colors.darkAccentGreen} />
        </View>

        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.body}>
          We sent a confirmation link to{'\n'}
          <Text style={styles.emailText}>{email}</Text>
          {'\n\n'}Tap the link to activate your account, then come back here and log in.
        </Text>

        {message ? (
          <Text style={message.kind === 'error' ? styles.errorText : styles.successText}>
            {message.text}
          </Text>
        ) : null}

        {resending ? (
          <ActivityIndicator size="small" color={colors.primaryGreen} style={styles.spinner} />
        ) : (
          <Pressable
            style={[styles.resendButton, cooldown > 0 && styles.resendButtonDisabled]}
            onPress={handleResend}
            disabled={cooldown > 0}
          >
            <Text style={styles.resendButtonText}>
              {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend Email'}
            </Text>
          </Pressable>
        )}

        <Pressable
          style={styles.loginRow}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
        >
          <Text style={styles.loginText}>Back to Log In</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.textPrimary,
    marginTop: 20,
  },
  body: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14.5,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },
  emailText: {
    fontFamily: fonts.bodySemiBold,
    color: colors.textPrimary,
  },
  errorText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.danger,
    textAlign: 'center',
    marginTop: 20,
  },
  successText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.darkAccentGreen,
    textAlign: 'center',
    marginTop: 20,
  },
  spinner: {
    marginTop: 28,
  },
  resendButton: {
    marginTop: 28,
    borderWidth: 1,
    borderColor: colors.primaryGreen,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  resendButtonDisabled: {
    borderColor: colors.border,
  },
  resendButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14.5,
    color: colors.darkAccentGreen,
  },
  loginRow: {
    marginTop: 24,
  },
  loginText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
