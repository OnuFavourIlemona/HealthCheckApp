import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { SignupFormScreen, type SignupField } from './SignupFormScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'SignupMedicalPractitioner'>;

const fields: SignupField[] = [
  {
    key: 'fullName',
    label: 'Full Name',
    placeholder: 'Benjamin Idahosa',
    helperText: 'Please make sure you use the name on your government ID and practice licence(s).',
  },
  { key: 'lineOfPractice', label: 'Line of Practice', placeholder: 'Nurse, Doctor, Pharm. ...' },
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

export function SignupMedicalPractitionerScreen({ navigation }: Props) {
  return (
    <SignupFormScreen
      title="Medical Practitioner"
      subtitle="Please tell us more about yourself and the details of your line of practice."
      fields={fields}
      role="medical_practitioner"
      nameFieldKey="fullName"
      onBack={() => navigation.goBack()}
      onProceed={() => navigation.navigate('ProTabs')}
    />
  );
}
