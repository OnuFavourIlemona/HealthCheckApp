import { useEffect } from 'react';
import { Image, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getHasOnboarded } from '../../lib/onboardingState';
import { registerForPushNotifications } from '../../lib/pushNotifications';
import { rescheduleAllHealthReminders } from '../../lib/healthReminders';
import { refreshPeriodReminders } from '../../lib/periodTracker';
import { autoEnableRelevantReminders } from '../../lib/autoReminders';
import { getSessionRole } from '../../lib/supabase';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

const MIN_SPLASH_MS = 1800;

export function SplashScreen({ navigation }: Props) {
  useEffect(() => {
    let cancelled = false;

    const start = Date.now();
    (async () => {
      let role: Awaited<ReturnType<typeof getSessionRole>> = null;
      try {
        role = await getSessionRole();
      } catch {
        role = null;
      }

      // Already-logged-in users: make sure this device is registered for push
      // so alerts reach them even when the app is closed.
      if (role !== null) {
        void registerForPushNotifications();
        void rescheduleAllHealthReminders();
        void refreshPeriodReminders();
        void autoEnableRelevantReminders();
      }

      // Returning-but-logged-out users skip the onboarding carousel and go
      // straight to Login; only genuinely first-time users see the carousel.
      const hasOnboarded = role === null ? await getHasOnboarded() : false;

      const elapsed = Date.now() - start;
      const wait = Math.max(0, MIN_SPLASH_MS - elapsed);
      setTimeout(() => {
        if (cancelled) return;
        if (role === null) {
          navigation.replace(hasOnboarded ? 'Login' : 'Onboarding');
        } else if (role === 'pharmacy') {
          navigation.replace('PharmacyTabs');
        } else {
          navigation.replace(role === 'patient' ? 'MainTabs' : 'ProTabs');
        }
      }, wait);
    })();

    return () => {
      cancelled = true;
    };
  }, [navigation]);

  return (
    <Image
      source={require('../../../assets/images/onboarding/splash-bg.jpg')}
      style={styles.background}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
