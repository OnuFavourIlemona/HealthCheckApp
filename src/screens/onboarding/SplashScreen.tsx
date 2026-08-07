import { useEffect } from 'react';
import { Image, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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

      const elapsed = Date.now() - start;
      const wait = Math.max(0, MIN_SPLASH_MS - elapsed);
      setTimeout(() => {
        if (cancelled) return;
        if (role === null) {
          navigation.replace('Onboarding');
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
