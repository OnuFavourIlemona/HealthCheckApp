import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { SignupFormScreen, type SignupField } from './SignupFormScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'SignupPatient'>;

const fields: SignupField[] = [
  { key: 'fullName', label: 'Full Name', placeholder: 'Benjamin Idahosa' },
  { key: 'email', label: 'Email', placeholder: 'Bhosa@gmail.com', keyboardType: 'email-address' },
  {
    key: 'password',
    label: 'Password',
    placeholder: '********',
    secureTextEntry: true,
    helperText: 'Password must be at least eight(8) characters long',
  },
  { key: 'confirmPassword', label: 'Confirm Password', placeholder: '********', secureTextEntry: true },
];

export function SignupPatientScreen({ navigation }: Props) {
  return (
    <SignupFormScreen
      title="Patient"
      subtitle="Please tell us more about your self."
      fields={fields}
      role="patient"
      nameFieldKey="fullName"
      onBack={() => navigation.goBack()}
      onProceed={() => navigation.navigate('MainTabs')}
    />
  );
}
