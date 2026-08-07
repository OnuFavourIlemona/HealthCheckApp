import { NavigationContainer } from '@react-navigation/native';
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
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/theme';

export default function App() {
  const [poppinsLoaded] = usePoppinsFonts({
    Poppins_500Medium,
    Poppins_600SemiBold,
  });
  const [sourceSansLoaded] = useSourceSansFonts({
    SourceSans3_400Regular,
    SourceSans3_600SemiBold,
  });

  if (!poppinsLoaded || !sourceSansLoaded) {
    return <View style={styles.loading} />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
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
