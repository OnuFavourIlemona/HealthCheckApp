import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProceedButton } from '../../components/forms/ProceedButton';
import { colors, fonts } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const slides = [
  {
    image: require('../../../assets/images/onboarding/onboarding-1.jpg'),
    title: 'Your Health, Always Checked',
    description:
      'Most health risks go unnoticed until it is too late. HealthCheck helps you stay ahead- tracking your lifestyle, predicting risks, and keeping you informed before small issues becomes big ones.',
  },
  {
    image: require('../../../assets/images/onboarding/onboarding-2.jpg'),
    title: 'Smart Health, in Your Pocket',
    description:
      'Get a personalized health risk score for medical conditions. Use our symptom checker, find nearby hospitals and pharmacies instantly, and chat with verified medical professionals-all in one place.',
  },
  {
    image: require('../../../assets/images/onboarding/onboarding-3.jpg'),
    title: 'Built for Everyone in Healthcare',
    description:
      "Whether you're seeking care, providing it, or dispensing it-HealthCheck connects patients, practitioners, and pharmacies on one powerful platform. Everyone plays a role in better health",
  },
];

export function OnboardingScreen({ navigation }: Props) {
  const [index, setIndex] = useState(0);
  const slide = slides[index];

  function handleProceed() {
    if (index < slides.length - 1) {
      setIndex(index + 1);
    } else {
      navigation.replace('SelectRole');
    }
  }

  return (
    <View style={styles.container}>
      <Image source={slide.image} style={styles.hero} resizeMode="cover" />
      <SafeAreaView style={styles.content} edges={['bottom']}>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.description}>{slide.description}</Text>
        <View style={styles.buttonSpacing}>
          <ProceedButton onPress={handleProceed} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  hero: {
    width: '100%',
    flex: 1.15,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 24,
    color: colors.textPrimary,
  },
  description: {
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 12,
    lineHeight: 22,
  },
  buttonSpacing: {
    marginTop: 24,
  },
});
