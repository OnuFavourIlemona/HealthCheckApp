import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormField } from '../components/forms/FormField';
import { Avatar } from '../components/ui/Avatar';
import { PatternBackground } from '../components/ui/PatternBackground';
import { pickAndUploadAvatar } from '../lib/avatar';
import { friendlyError } from '../lib/errors';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export function EditProfileScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
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
      setEmail(sessionData.session?.user.email ?? null);
      const { data } = await supabase
        .from('profiles')
        .select('full_name, phone, avatar_url')
        .eq('id', userId)
        .maybeSingle();
      if (data) {
        setFullName(data.full_name ?? '');
        setPhone(data.phone ?? '');
        setAvatarUrl(data.avatar_url ?? null);
      }
      setLoading(false);
    })();
  }, []);

  const handlePickPhoto = async () => {
    if (uploadingPhoto) return;
    setMessage(null);
    setUploadingPhoto(true);
    const { url, error } = await pickAndUploadAvatar();
    setUploadingPhoto(false);
    if (error) {
      setMessage({ kind: 'error', text: friendlyError(error) });
      return;
    }
    if (url) {
      setAvatarUrl(url);
      setMessage({ kind: 'success', text: 'Photo updated.' });
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setMessage(null);

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setMessage({ kind: 'error', text: 'Please enter your full name.' });
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setMessage({ kind: 'error', text: 'You must be signed in to update your profile.' });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: trimmedName, phone: phone.trim() || null })
      .eq('id', userId);
    setSaving(false);

    if (error) {
      setMessage({ kind: 'error', text: friendlyError(error) });
      return;
    }
    setMessage({ kind: 'success', text: 'Profile updated.' });
    setTimeout(() => navigation.goBack(), 700);
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
      <PatternBackground height={380} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.photoBlock}>
            <Avatar email={email} name={fullName} avatarUrl={avatarUrl} size={96} />
            <Pressable style={styles.photoButton} onPress={handlePickPhoto} disabled={uploadingPhoto}>
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color={colors.darkAccentGreen} />
              ) : (
                <Text style={styles.photoButtonText}>
                  {avatarUrl ? 'Change photo' : 'Add photo'}
                </Text>
              )}
            </Pressable>
          </View>

          <FormField label="Full name" placeholder="e.g. Amaka Okafor" value={fullName} onChangeText={setFullName} />
          <FormField
            label="Phone number"
            placeholder="e.g. 0803 123 4567"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          {message ? (
            <Text style={message.kind === 'error' ? styles.errorText : styles.successText}>{message.text}</Text>
          ) : null}

          {saving ? (
            <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.spinner} />
          ) : (
            <Pressable style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  loader: { marginTop: 80 },
  content: { paddingHorizontal: 24, paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 20,
  },
  headerTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
  },
  photoBlock: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 10,
  },
  photoButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: colors.pillGreenBg,
  },
  photoButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.darkAccentGreen,
  },
  errorText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 14,
  },
  successText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.darkAccentGreen,
    textAlign: 'center',
    marginBottom: 14,
  },
  spinner: { height: 56 },
  saveButton: {
    backgroundColor: colors.primaryGreen,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.white,
  },
});
