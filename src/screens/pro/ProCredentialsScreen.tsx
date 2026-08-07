import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PatternBackground } from '../../components/ui/PatternBackground';
import { supabase } from '../../lib/supabase';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ProCredentials'>;

const SPECIALTIES = ['Physician', 'Dentist', 'Nurse', 'Pharmacist', 'Physiotherapist', 'Other'];

export function ProCredentialsScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [currentlyPracticing, setCurrentlyPracticing] = useState<boolean | null>(null);
  const [workplace, setWorkplace] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licensePath, setLicensePath] = useState<string | null>(null);
  const [workIdPath, setWorkIdPath] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);
  const [uploadingLicense, setUploadingLicense] = useState(false);
  const [uploadingWorkId, setUploadingWorkId] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select(
          'professional_id, license_path, license_submitted_at, is_verified, verification_notes, specialty, currently_practicing, workplace, work_id_path, years_of_experience',
        )
        .eq('id', userId)
        .maybeSingle();
      if (data) {
        setLicenseNumber(data.professional_id ?? '');
        setLicensePath(data.license_path ?? null);
        setSubmittedAt(data.license_submitted_at ?? null);
        setIsVerified(data.is_verified ?? false);
        setNotes(data.verification_notes ?? null);
        setSpecialty(data.specialty ?? null);
        setCurrentlyPracticing(data.currently_practicing ?? null);
        setWorkplace(data.workplace ?? '');
        setWorkIdPath(data.work_id_path ?? null);
        setYearsOfExperience(data.years_of_experience != null ? String(data.years_of_experience) : '');
      }
      setLoading(false);
    })();
  }, []);

  const uploadDocument = async (
    kind: 'license' | 'work_id',
    setPath: (path: string) => void,
    setUploading: (v: boolean) => void,
  ) => {
    setMessage(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setMessage({ kind: 'error', text: 'Please sign in first.' });
      return;
    }

    setUploading(true);
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const extension = asset.name?.split('.').pop() ?? 'pdf';
      const path = `${userId}/${kind}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('practitioner-licenses')
        .upload(path, blob, {
          upsert: true,
          contentType: asset.mimeType ?? 'application/octet-stream',
        });

      if (uploadError) {
        setMessage({ kind: 'error', text: uploadError.message });
        return;
      }
      setPath(path);
      setMessage({
        kind: 'success',
        text: kind === 'license' ? 'Licence uploaded. Submit when ready.' : 'Work ID uploaded. Submit when ready.',
      });
    } catch {
      setMessage({ kind: 'error', text: 'The upload failed. Please try again.' });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (saving) return;
    setMessage(null);

    if (!specialty) {
      setMessage({ kind: 'error', text: 'Please choose your medical line.' });
      return;
    }
    if (currentlyPracticing === null) {
      setMessage({ kind: 'error', text: 'Please let us know if you are currently practicing.' });
      return;
    }
    if (currentlyPracticing && !workplace.trim()) {
      setMessage({ kind: 'error', text: 'Please tell us where you currently practice.' });
      return;
    }
    const yearsNum = Number(yearsOfExperience);
    if (!yearsOfExperience.trim() || !Number.isFinite(yearsNum) || yearsNum < 0 || yearsNum > 70) {
      setMessage({ kind: 'error', text: 'Please enter a valid number of years of experience.' });
      return;
    }
    if (!licenseNumber.trim()) {
      setMessage({ kind: 'error', text: 'Please enter your practising licence number.' });
      return;
    }
    if (!licensePath) {
      setMessage({ kind: 'error', text: 'Please upload a copy of your licence.' });
      return;
    }
    if (!workIdPath) {
      setMessage({ kind: 'error', text: 'Please upload a photo of your work ID.' });
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setMessage({ kind: 'error', text: 'Please sign in first.' });
      return;
    }

    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('profiles')
      .update({
        specialty,
        currently_practicing: currentlyPracticing,
        workplace: workplace.trim() || null,
        years_of_experience: yearsNum,
        professional_id: licenseNumber.trim(),
        license_path: licensePath,
        work_id_path: workIdPath,
        license_submitted_at: now,
      })
      .eq('id', userId);
    setSaving(false);

    if (error) {
      setMessage({ kind: 'error', text: error.message });
      return;
    }
    setSubmittedAt(now);
    setMessage({ kind: 'success', text: 'Sent for review.' });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.loader} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <PatternBackground />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.headerTitle}>Verification</Text>
            <View style={{ width: 24 }} />
          </View>

          {isVerified ? (
            <View style={styles.verifiedBanner}>
              <MaterialCommunityIcons name="check-decagram" size={22} color={colors.white} />
              <View style={styles.bannerTextColumn}>
                <Text style={styles.verifiedTitle}>You're verified</Text>
                <Text style={styles.verifiedBody}>
                  You can now accept patient requests and consult through ProConnect.
                </Text>
              </View>
            </View>
          ) : submittedAt ? (
            <View style={styles.pendingBanner}>
              <Ionicons name="time-outline" size={22} color="#C77B00" />
              <View style={styles.bannerTextColumn}>
                <Text style={styles.pendingTitle}>Under review</Text>
                <Text style={styles.pendingBody}>
                  Sent on {new Date(submittedAt).toLocaleDateString()}. We'll let you know as soon as
                  it's checked.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.pendingBanner}>
              <Ionicons name="shield-outline" size={22} color="#C77B00" />
              <View style={styles.bannerTextColumn}>
                <Text style={styles.pendingTitle}>Verification required</Text>
                <Text style={styles.pendingBody}>
                  Patient requests contain private medical information, so only verified
                  practitioners can see them.
                </Text>
              </View>
            </View>
          )}

          {notes ? (
            <View style={styles.notesCard}>
              <Text style={styles.notesTitle}>Reviewer note</Text>
              <Text style={styles.notesText}>{notes}</Text>
            </View>
          ) : null}

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>What's your medical line?</Text>
            <View style={styles.chipsWrap}>
              {SPECIALTIES.map((option) => (
                <Pressable
                  key={option}
                  style={[styles.chip, specialty === option && styles.chipActive]}
                  onPress={() => !isVerified && setSpecialty(option)}
                >
                  <Text style={[styles.chipText, specialty === option && styles.chipTextActive]}>
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Years of experience</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 8"
              placeholderTextColor={colors.inputPlaceholder}
              keyboardType="numeric"
              value={yearsOfExperience}
              onChangeText={setYearsOfExperience}
              editable={!isVerified}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Are you currently practicing?</Text>
            <View style={styles.yesNoRow}>
              <Pressable
                style={[styles.yesNoButton, currentlyPracticing === true && styles.yesNoActive]}
                onPress={() => !isVerified && setCurrentlyPracticing(true)}
              >
                <Text
                  style={[styles.yesNoText, currentlyPracticing === true && styles.yesNoTextActive]}
                >
                  Yes
                </Text>
              </Pressable>
              <Pressable
                style={[styles.yesNoButton, currentlyPracticing === false && styles.yesNoActive]}
                onPress={() => !isVerified && setCurrentlyPracticing(false)}
              >
                <Text
                  style={[styles.yesNoText, currentlyPracticing === false && styles.yesNoTextActive]}
                >
                  No
                </Text>
              </Pressable>
            </View>
          </View>

          {currentlyPracticing ? (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Where do you currently practice?</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Lagos University Teaching Hospital"
                placeholderTextColor={colors.inputPlaceholder}
                value={workplace}
                onChangeText={setWorkplace}
                editable={!isVerified}
              />
            </View>
          ) : null}

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Practising Licence Number</Text>
            <TextInput
              style={styles.input}
              placeholder="MDCN/12345 or PCN/REG/12345"
              placeholderTextColor={colors.inputPlaceholder}
              autoCapitalize="characters"
              value={licenseNumber}
              onChangeText={setLicenseNumber}
              editable={!isVerified}
            />
            <Text style={styles.fieldHint}>
              This is the number given by your regulatory body, such as MDCN, NMCN, or PCN.
            </Text>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Licence Document</Text>
            <Pressable
              style={[styles.actionButton, isVerified && styles.actionButtonDisabled]}
              onPress={() => uploadDocument('license', setLicensePath, setUploadingLicense)}
              disabled={isVerified}
            >
              {uploadingLicense ? (
                <ActivityIndicator size="small" color={colors.darkAccentGreen} />
              ) : (
                <Ionicons name="document-attach-outline" size={18} color={colors.darkAccentGreen} />
              )}
              <Text style={styles.actionButtonText}>
                {licensePath ? 'Licence uploaded. Tap to replace' : 'Upload licence (PDF or photo)'}
              </Text>
            </Pressable>
            <Text style={styles.fieldHint}>We keep this private and only use it to check your credentials.</Text>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Work ID</Text>
            <Pressable
              style={[styles.actionButton, isVerified && styles.actionButtonDisabled]}
              onPress={() => uploadDocument('work_id', setWorkIdPath, setUploadingWorkId)}
              disabled={isVerified}
            >
              {uploadingWorkId ? (
                <ActivityIndicator size="small" color={colors.darkAccentGreen} />
              ) : (
                <Ionicons name="id-card-outline" size={18} color={colors.darkAccentGreen} />
              )}
              <Text style={styles.actionButtonText}>
                {workIdPath ? 'Work ID uploaded. Tap to replace' : 'Upload your work ID (PDF or photo)'}
              </Text>
            </Pressable>
            <Text style={styles.fieldHint}>
              A photo of your hospital, clinic, or staff ID card. This helps us confirm you're
              currently practising.
            </Text>
          </View>

          {message ? (
            <Text style={message.kind === 'error' ? styles.errorText : styles.successText}>
              {message.text}
            </Text>
          ) : null}

          {!isVerified ? (
            saving ? (
              <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.spinner} />
            ) : (
              <Pressable style={styles.submitButton} onPress={handleSubmit}>
                <Text style={styles.submitButtonText}>
                  {submittedAt ? 'Send Again for Review' : 'Send for Review'}
                </Text>
              </Pressable>
            )
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  loader: {
    marginTop: 80,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
  },
  verifiedBanner: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.darkAccentGreen,
    borderRadius: 14,
    padding: 16,
  },
  pendingBanner: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFF4E0',
    borderRadius: 14,
    padding: 16,
  },
  bannerTextColumn: {
    flex: 1,
  },
  verifiedTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15.5,
    color: colors.white,
  },
  verifiedBody: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 3,
  },
  pendingTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15.5,
    color: '#C77B00',
  },
  pendingBody: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: '#9A6A10',
    marginTop: 3,
  },
  notesCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 14,
  },
  notesTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  notesText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textSecondary,
    marginTop: 4,
  },
  fieldBlock: {
    marginTop: 20,
  },
  fieldLabel: {
    fontFamily: fonts.headingMedium,
    fontSize: 14,
    lineHeight: 19.6,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipActive: {
    backgroundColor: colors.primaryGreen,
    borderColor: colors.primaryGreen,
  },
  chipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.white,
  },
  yesNoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  yesNoButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  yesNoActive: {
    borderColor: colors.primaryGreen,
    backgroundColor: colors.pillGreenBg,
  },
  yesNoText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  yesNoTextActive: {
    color: colors.darkAccentGreen,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.textPrimary,
  },
  fieldHint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textMuted,
    marginTop: 6,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primaryGreen,
    paddingVertical: 13,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.darkAccentGreen,
  },
  errorText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.danger,
    textAlign: 'center',
    marginTop: 18,
  },
  successText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.darkAccentGreen,
    textAlign: 'center',
    marginTop: 18,
  },
  spinner: {
    height: 56,
    marginTop: 20,
  },
  submitButton: {
    backgroundColor: colors.primaryGreen,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  submitButtonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.white,
  },
});
