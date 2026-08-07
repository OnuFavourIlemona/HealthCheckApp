import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Login: undefined;
  SelectRole: undefined;
  SignupMedicalPractitioner: undefined;
  SignupPharmacy: undefined;
  SignupPatient: undefined;
  CheckEmail: { email: string };
  MainTabs: NavigatorScreenParams<MainTabsParamList> | undefined;
  ProTabs: undefined;
  PharmacyTabs: undefined;
  ProConnect: { consultationId?: string } | undefined;
  RequestConsultation: undefined;
  ProCredentials: undefined;
  RiskPrediction: { assessmentType: string };
  BookLabTest: undefined;
  HealthInfo: undefined;
  HealthTips: undefined;
  RiskHistory: undefined;
  Notifications: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
  RecommendationDetail: { key: string };
};

export type MainTabsParamList = {
  Home: undefined;
  Assess: undefined;
  Messages: undefined;
  'Find Care': { category?: 'hospitals' | 'pharmacies' } | undefined;
  Profile: undefined;
};

export type ProTabsParamList = {
  Dashboard: undefined;
  Patients: undefined;
  Schedule: undefined;
  Payments: undefined;
  Profile: undefined;
};
