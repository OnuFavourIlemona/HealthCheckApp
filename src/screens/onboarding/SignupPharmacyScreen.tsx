import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { SignupFormScreen, type SignupField } from './SignupFormScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'SignupPharmacy'>;

const fields: SignupField[] = [
  {
    key: 'pharmacyName',
    label: 'Name of Pharmacy',
    placeholder: 'Benjamin Idahosa',
    helperText: "Please make sure you use the name on the company's licence.",
  },
  {
    key: 'branch',
    label: 'Branch',
    placeholder: 'Bauchi branch',
    helperText: 'Please include the location of the pharmacy',
  },
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

export function SignupPharmacyScreen({ navigation }: Props) {
  return (
    <SignupFormScreen
      title="Pharmacy"
      subtitle="Please tell us more about your pharmacy. Give details that would make it easy to find and verify."
      fields={fields}
      role="pharmacy"
      nameFieldKey="pharmacyName"
      onBack={() => navigation.goBack()}
      onProceed={() => navigation.navigate('PharmacyTabs')}
    />
  );
}
