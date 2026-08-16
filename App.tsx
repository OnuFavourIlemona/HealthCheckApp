import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import {
  Poppins_500Medium,
  Poppins_600SemiBold,
  useFonts as usePoppinsFonts,
} from '@expo-google-fonts/poppins';
import {
  SourceSans3_400Regular,
  SourceSans3_600SemiBold,
  useFonts as useSourceSansFonts,
} from '@expo-google-fonts/source-sans-3';
import * as Notifications from 'expo-notifications';
import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { registerForPushNotifications } from './src/lib/pushNotifications';
import { supabase } from './src/lib/supabase';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/theme';

const navigationRef = createNavigationContainerRef();

export default function App() {
  const [poppinsLoaded] = usePoppinsFonts({
    Poppins_500Medium,
    Poppins_600SemiBold,
  });
  const [sourceSansLoaded] = useSourceSansFonts({
    SourceSans3_400Regular,
    SourceSans3_600SemiBold,
  });

  useEffect(() => {
    // Edge-to-edge means the OS nav bar is transparent, so our own white
    // screens show through behind it instead of a mismatched system bar --
    // this just keeps its icons dark so they stay visible against that white.
    if (Platform.OS === 'android') {
      try {
        NavigationBar.setStyle('dark');
      } catch {
        // Non-fatal -- purely cosmetic.
      }
    }

    // Register for push whenever a session is (or becomes) active.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) registerForPushNotifications();
    });
    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') registerForPushNotifications();
    });

    // Tapping a push notification opens the relevant screen when possible.
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { screen?: string } | undefined;
      if (data?.screen && navigationRef.isReady()) {
        try {
          navigationRef.navigate(data.screen as never);
        } catch {
          // Unknown screen name — just leave the app on wherever it opened.
        }
      }
    });

    return () => {
      authSub.subscription.unsubscribe();
      responseSub.remove();
    };
  }, []);

  if (!poppinsLoaded || !sourceSansLoaded) {
    return <View style={styles.loading} />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef}>
        <RootNavigator />
      </NavigationContainer>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
