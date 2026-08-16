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
import { DateOfBirthField } from '../../components/forms/DateOfBirthField';
import { PatternBackground } from '../../components/ui/PatternBackground';
import { ageFromDob, dobPartsFromIso, dobToIso, parseDob } from '../../lib/dateOfBirth';
import { friendlyError } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ProCredentials'>;

const SPECIALTIES = ['Physician', 'Dentist', 'Nurse', 'Pharmacist', 'Physiotherapist', 'Other'];

export function ProCredentialsScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

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
          'professional_id, license_path, license_submitted_at, is_verified, verification_notes, specialty, currently_practicing, workplace, work_id_path, years_of_experience, date_of_birth',
        )
        .eq('id', userId)
        .maybeSingle();
      if (data) {
        setLicenseNumber(data.professional_id ?? '');
        setLicensePath(data.license_path ?? null);
        setSubmittedAt(data.license_submitted_at ?? null);
        setIsVerified(data.is_verified ?? false);
        setNotes(data.verification_notes ?? null);
        if (data.specialty && !SPECIALTIES.includes(data.specialty)) {
          // A previously saved free-text field ("Other") isn't one of the
          // fixed chips -- select Other and prefill what they typed before.
          setSpecialty('Other');
          setCustomSpecialty(data.specialty);
        } else {
          setSpecialty(data.specialty ?? null);
        }
        setCurrentlyPracticing(data.currently_practicing ?? null);
        setWorkplace(data.workplace ?? '');
        setWorkIdPath(data.work_id_path ?? null);
        setYearsOfExperience(data.years_of_experience != null ? String(data.years_of_experience) : '');
        if (data.date_of_birth) {
          const parts = dobPartsFromIso(data.date_of_birth);
          setDobDay(parts.day);
          setDobMonth(parts.month);
          setDobYear(parts.year);
        }
      }
      setLoading(false);
    })();
  }, []);

  const uploadDocument = async (
    kind: 'license' | 'work_id',
    setPath: (path: string) => void,
    setUploading: (v: boolean) => void,
    errorKey: string,
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
        setMessage({ kind: 'error', text: friendlyError(uploadError) });
        return;
      }
      setPath(path);
      clearFieldError(errorKey);
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
    setFieldErrors({});

    const errors: Record<string, string> = {};

    if (!specialty) {
      errors.specialty = 'Please choose your medical line.';
    } else if (specialty === 'Other' && !customSpecialty.trim()) {
      errors.customSpecialty = 'Please tell us your specific medical field.';
    }

    const dob = parseDob(dobDay, dobMonth, dobYear);
    if (!dob) {
      errors.dob = 'Please enter your full date of birth.';
    } else {
      const age = ageFromDob(dob);
      if (age < 18 || age > 100) errors.dob = 'Please double-check your date of birth.';
    }

    const yearsNum = Number(yearsOfExperience);
    if (!yearsOfExperience.trim() || !Number.isFinite(yearsNum) || yearsNum < 0 || yearsNum > 70) {
      errors.years = 'Enter your years of experience (0 to 70).';
    }

    if (currentlyPracticing === null) {
      errors.practicing = 'Please let us know if you are currently practicing.';
    } else if (currentlyPracticing && !workplace.trim()) {
      errors.workplace = 'Please tell us where you currently practice.';
    }

    if (!licenseNumber.trim()) {
      errors.license = 'Please enter your practising licence number.';
    }
    if (!licensePath) {
      errors.licenseDoc = 'Please upload a copy of your licence.';
    }
    if (!workIdPath) {
      errors.workId = 'Please upload a photo of your work ID.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setMessage({ kind: 'error', text: 'Please fix the highlighted fields above.' });
      return;
    }
    if (!dob) return; // Guarded above; keeps the type non-null below.
    const ageNum = ageFromDob(dob);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setMessage({ kind: 'error', text: 'Please sign in first.' });
      return;
    }

    setSaving(true);
    const now = new Date().toISOString();
    const resolvedSpecialty = specialty === 'Other' ? customSpecialty.trim() : specialty;
    const { error } = await supabase
      .from('profiles')
      .update({
        specialty: resolvedSpecialty,
        age: ageNum,
        date_of_birth: dobToIso(dob),
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
      setMessage({ kind: 'error', text: friendlyError(error) });
      return;
    }
    setSubmittedAt(now);
    setMessage({ kind: 'success', text: 'Sent for review.' });
  };

  const liveDob = parseDob(dobDay, dobMonth, dobYear);

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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
                  onPress={() => {
                    if (isVerified) return;
                    setSpecialty(option);
                    clearFieldError('specialty');
                  }}
                >
                  <Text style={[styles.chipText, specialty === option && styles.chipTextActive]}>
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
            {specialty === 'Other' ? (
              <TextInput
                style={[
                  styles.input,
                  styles.customSpecialtyInput,
                  fieldErrors.customSpecialty ? styles.inputError : null,
                ]}
                placeholder="Tell us your specific medical field"
                placeholderTextColor={colors.inputPlaceholder}
                value={customSpecialty}
                onChangeText={(v) => {
                  setCustomSpecialty(v);
                  clearFieldError('customSpecialty');
                }}
                editable={!isVerified}
              />
            ) : null}
            {fieldErrors.specialty || fieldErrors.customSpecialty ? (
              <View style={styles.inlineErrorRow}>
                <Ionicons name="alert-circle" size={15} color={colors.danger} />
                <Text style={styles.inlineErrorText}>
                  {fieldErrors.specialty ?? fieldErrors.customSpecialty}
                </Text>
              </View>
            ) : null}
          </View>

          <DateOfBirthField
            day={dobDay}
            month={dobMonth}
            year={dobYear}
            onChangeDay={(v) => {
              setDobDay(v);
              clearFieldError('dob');
            }}
            onChangeMonth={(v) => {
              setDobMonth(v);
              clearFieldError('dob');
            }}
            onChangeYear={(v) => {
              setDobYear(v);
              clearFieldError('dob');
            }}
            ageHint={liveDob ? `Age ${ageFromDob(liveDob)}` : null}
            editable={!isVerified}
          />
          {fieldErrors.dob ? (
            <View style={styles.inlineErrorRow}>
              <Ionicons name="alert-circle" size={15} color={colors.danger} />
              <Text style={styles.inlineErrorText}>{fieldErrors.dob}</Text>
            </View>
          ) : null}

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Years of experience</Text>
            <TextInput
              style={[styles.input, fieldErrors.years ? styles.inputError : null]}
              placeholder="e.g. 8"
              placeholderTextColor={colors.inputPlaceholder}
              keyboardType="numeric"
              value={yearsOfExperience}
              onChangeText={(v) => {
                setYearsOfExperience(v);
                clearFieldError('years');
              }}
              editable={!isVerified}
            />
            {fieldErrors.years ? (
              <View style={styles.inlineErrorRow}>
                <Ionicons name="alert-circle" size={15} color={colors.danger} />
                <Text style={styles.inlineErrorText}>{fieldErrors.years}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Are you currently practicing?</Text>
            <View style={styles.yesNoRow}>
              <Pressable
                style={[styles.yesNoButton, currentlyPracticing === true && styles.yesNoActive]}
                onPress={() => {
                  if (isVerified) return;
                  setCurrentlyPracticing(true);
                  clearFieldError('practicing');
                }}
              >
                <Text
                  style={[styles.yesNoText, currentlyPracticing === true && styles.yesNoTextActive]}
                >
                  Yes
                </Text>
              </Pressable>
              <Pressable
                style={[styles.yesNoButton, currentlyPracticing === false && styles.yesNoActive]}
                onPress={() => {
                  if (isVerified) return;
                  setCurrentlyPracticing(false);
                  clearFieldError('practicing');
                }}
              >
                <Text
                  style={[styles.yesNoText, currentlyPracticing === false && styles.yesNoTextActive]}
                >
                  No
                </Text>
              </Pressable>
            </View>
            {fieldErrors.practicing ? (
              <View style={styles.inlineErrorRow}>
                <Ionicons name="alert-circle" size={15} color={colors.danger} />
                <Text style={styles.inlineErrorText}>{fieldErrors.practicing}</Text>
              </View>
            ) : null}
          </View>

          {currentlyPracticing ? (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Where do you currently practice?</Text>
              <TextInput
                style={[styles.input, fieldErrors.workplace ? styles.inputError : null]}
                placeholder="e.g. Lagos University Teaching Hospital"
                placeholderTextColor={colors.inputPlaceholder}
                value={workplace}
                onChangeText={(v) => {
                  setWorkplace(v);
                  clearFieldError('workplace');
                }}
                editable={!isVerified}
              />
              {fieldErrors.workplace ? (
                <View style={styles.inlineErrorRow}>
                  <Ionicons name="alert-circle" size={15} color={colors.danger} />
                  <Text style={styles.inlineErrorText}>{fieldErrors.workplace}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Practising Licence Number</Text>
            <TextInput
              style={[styles.input, fieldErrors.license ? styles.inputError : null]}
              placeholder="MDCN/12345 or PCN/REG/12345"
              placeholderTextColor={colors.inputPlaceholder}
              autoCapitalize="characters"
              value={licenseNumber}
              onChangeText={(v) => {
                setLicenseNumber(v);
                clearFieldError('license');
              }}
              editable={!isVerified}
            />
            {fieldErrors.license ? (
              <View style={styles.inlineErrorRow}>
                <Ionicons name="alert-circle" size={15} color={colors.danger} />
                <Text style={styles.inlineErrorText}>{fieldErrors.license}</Text>
              </View>
            ) : (
              <Text style={styles.fieldHint}>
                This is the number given by your regulatory body, such as MDCN, NMCN, or PCN.
              </Text>
            )}
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Licence Document</Text>
            <Pressable
              style={[
                styles.actionButton,
                isVerified && styles.actionButtonDisabled,
                fieldErrors.licenseDoc ? styles.actionButtonError : null,
              ]}
              onPress={() => uploadDocument('license', setLicensePath, setUploadingLicense, 'licenseDoc')}
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
            {fieldErrors.licenseDoc ? (
              <View style={styles.inlineErrorRow}>
                <Ionicons name="alert-circle" size={15} color={colors.danger} />
                <Text style={styles.inlineErrorText}>{fieldErrors.licenseDoc}</Text>
              </View>
            ) : (
              <Text style={styles.fieldHint}>We keep this private and only use it to check your credentials.</Text>
            )}
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Work ID</Text>
            <Pressable
              style={[
                styles.actionButton,
                isVerified && styles.actionButtonDisabled,
                fieldErrors.workId ? styles.actionButtonError : null,
              ]}
              onPress={() => uploadDocument('work_id', setWorkIdPath, setUploadingWorkId, 'workId')}
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
            {fieldErrors.workId ? (
              <View style={styles.inlineErrorRow}>
                <Ionicons name="alert-circle" size={15} color={colors.danger} />
                <Text style={styles.inlineErrorText}>{fieldErrors.workId}</Text>
              </View>
            ) : (
              <Text style={styles.fieldHint}>
                A photo of your hospital, clinic, or staff ID card. This helps us confirm you're
                currently practising.
              </Text>
            )}
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
  customSpecialtyInput: {
    marginTop: 10,
  },
  inputError: {
    borderColor: colors.danger,
  },
  inlineErrorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
  },
  inlineErrorText: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.danger,
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
  actionButtonError: {
    borderColor: colors.danger,
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
