import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SplashScreen } from '../screens/onboarding/SplashScreen';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { LoginScreen } from '../screens/onboarding/LoginScreen';
import { SelectRoleScreen } from '../screens/onboarding/SelectRoleScreen';
import { SignupMedicalPractitionerScreen } from '../screens/onboarding/SignupMedicalPractitionerScreen';
import { SignupPharmacyScreen } from '../screens/onboarding/SignupPharmacyScreen';
import { SignupPatientScreen } from '../screens/onboarding/SignupPatientScreen';
import { CheckEmailScreen } from '../screens/onboarding/CheckEmailScreen';
import { RootTabs } from './RootTabs';
import { ProTabs } from './ProTabs';
import { PharmacyTabs } from './PharmacyTabs';
import { ProConnectScreen } from '../screens/pro/ProConnectScreen';
import { RiskPredictionScreen } from '../screens/RiskPredictionScreen';
import { BookLabTestScreen } from '../screens/BookLabTestScreen';
import { HealthInfoScreen } from '../screens/HealthInfoScreen';
import { HealthTipsScreen } from '../screens/HealthTipsScreen';
import { RiskHistoryScreen } from '../screens/RiskHistoryScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { RequestConsultationScreen } from '../screens/RequestConsultationScreen';
import { ProCredentialsScreen } from '../screens/pro/ProCredentialsScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { ChangePasswordScreen } from '../screens/ChangePasswordScreen';
import { RecommendationDetailScreen } from '../screens/RecommendationDetailScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SelectRole" component={SelectRoleScreen} />
      <Stack.Screen name="SignupMedicalPractitioner" component={SignupMedicalPractitionerScreen} />
      <Stack.Screen name="SignupPharmacy" component={SignupPharmacyScreen} />
      <Stack.Screen name="SignupPatient" component={SignupPatientScreen} />
      <Stack.Screen name="CheckEmail" component={CheckEmailScreen} />
      <Stack.Screen name="MainTabs" component={RootTabs} />
      <Stack.Screen name="ProTabs" component={ProTabs} />
      <Stack.Screen name="PharmacyTabs" component={PharmacyTabs} />
      <Stack.Screen name="ProConnect" component={ProConnectScreen} />
      <Stack.Screen name="RiskPrediction" component={RiskPredictionScreen} />
      <Stack.Screen name="BookLabTest" component={BookLabTestScreen} />
      <Stack.Screen name="HealthInfo" component={HealthInfoScreen} />
      <Stack.Screen name="HealthTips" component={HealthTipsScreen} />
      <Stack.Screen name="RiskHistory" component={RiskHistoryScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="RequestConsultation" component={RequestConsultationScreen} />
      <Stack.Screen name="ProCredentials" component={ProCredentialsScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="RecommendationDetail" component={RecommendationDetailScreen} />
    </Stack.Navigator>
  );
}
