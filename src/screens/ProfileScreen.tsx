import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../components/ui/Avatar';
import { FadeInUp } from '../components/ui/FadeInUp';
import { PatternBackground } from '../components/ui/PatternBackground';
import { Tappable } from '../components/ui/Tappable';
import { pickAndUploadAvatar, removeAvatar } from '../lib/avatar';
import { fetchAssessmentHistory } from '../lib/dashboard';
import { friendlyError } from '../lib/errors';
import { fetchProStats } from '../lib/proStats';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';

type StatTile = { label: string; value: string };

function formatMemberSince(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [fullName, setFullName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<StatTile[]>([]);
  const [signingOut, setSigningOut] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;
        if (!user) return;
        if (cancelled) return;
        setEmail(user.email ?? null);

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role, is_verified, avatar_url')
          .eq('id', user.id)
          .maybeSingle();
        if (cancelled) return;

        const resolvedRole = profile?.role ?? user.user_metadata?.role ?? null;
        setFullName(profile?.full_name ?? user.user_metadata?.full_name ?? null);
        setRole(resolvedRole);
        setIsVerified(profile?.is_verified ?? false);
        setAvatarUrl(profile?.avatar_url ?? null);

        const memberSince = formatMemberSince(user.created_at);

        if (resolvedRole === 'medical_practitioner') {
          const pro = await fetchProStats();
          if (cancelled) return;
          setStats([
            { label: 'Patients', value: String(pro.patientsAttended) },
            { label: 'Rating', value: pro.averageRating != null ? pro.averageRating.toFixed(1) : '—' },
            { label: 'Member Since', value: memberSince },
          ]);
        } else if (resolvedRole === 'pharmacy') {
          const { data: pharmacy } = await supabase
            .from('pharmacies')
            .select('id, is_verified')
            .eq('owner_id', user.id)
            .maybeSingle();
          let bookingCount = 0;
          if (pharmacy?.id) {
            const { count } = await supabase
              .from('lab_bookings')
              .select('id', { count: 'exact', head: true })
              .eq('pharmacy_id', pharmacy.id);
            bookingCount = count ?? 0;
          }
          if (cancelled) return;
          // A pharmacy's verification lives on the pharmacies row (same source
          // the dashboard uses), so the two screens always agree.
          setIsVerified(pharmacy?.is_verified ?? false);
          setStats([
            { label: 'Bookings', value: String(bookingCount) },
            { label: 'Status', value: pharmacy?.is_verified ? 'Verified' : 'Pending' },
            { label: 'Member Since', value: memberSince },
          ]);
        } else {
          const [history, { count: consultationCount }] = await Promise.all([
            fetchAssessmentHistory(),
            supabase
              .from('consultations')
              .select('id', { count: 'exact', head: true })
              .eq('patient_id', user.id),
          ]);
          if (cancelled) return;
          setStats([
            { label: 'Assessments', value: String(history.length) },
            { label: 'Consultations', value: String(consultationCount ?? 0) },
            { label: 'Member Since', value: memberSince },
          ]);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Splash' }] });
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete your account?',
      'There is no going back from this. You will be signed out for good and will not be able to log back in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => navigation.navigate('DeleteAccount'),
        },
      ],
    );
  };

  const handleChangePhoto = async () => {
    if (uploadingPhoto) return;
    setUploadingPhoto(true);
    const { url, error } = await pickAndUploadAvatar();
    setUploadingPhoto(false);
    if (error) {
      Alert.alert('Could not update photo', friendlyError(error));
      return;
    }
    if (url) setAvatarUrl(url);
  };

  const handleRemovePhoto = async () => {
    if (uploadingPhoto) return;
    setUploadingPhoto(true);
    const { error } = await removeAvatar();
    setUploadingPhoto(false);
    if (error) {
      Alert.alert('Could not remove photo', friendlyError(error));
      return;
    }
    setAvatarUrl(null);
  };

  const handleAvatarPress = () => {
    const options: Parameters<typeof Alert.alert>[2] = avatarUrl
      ? [
          { text: 'Change Photo', onPress: handleChangePhoto },
          { text: 'Remove Photo', style: 'destructive', onPress: handleRemovePhoto },
          { text: 'Cancel', style: 'cancel' },
        ]
      : [
          { text: 'Add Photo', onPress: handleChangePhoto },
          { text: 'Cancel', style: 'cancel' },
        ];
    Alert.alert('Profile Picture', 'This photo shows next to your name everywhere in the app.', options);
  };

  const roleLabel =
    role === 'medical_practitioner'
      ? 'Medical Practitioner'
      : role === 'pharmacy'
        ? 'Pharmacy'
        : 'Patient';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <PatternBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[colors.primaryGreen, colors.darkAccentGreen]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Tappable onPress={handleAvatarPress} disabled={uploadingPhoto}>
            <View>
              <Avatar
                email={email}
                name={fullName}
                avatarUrl={avatarUrl}
                size={76}
                style={styles.avatar}
                backgroundColor="rgba(255,255,255,0.22)"
                textColor={colors.white}
              />
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={13} color={colors.darkAccentGreen} />
              </View>
            </View>
          </Tappable>
          <Text style={styles.name}>{fullName ?? 'Your account'}</Text>
          {email ? <Text style={styles.email}>{email}</Text> : null}
          <View style={styles.roleBadge}>
            {role === 'medical_practitioner' && isVerified ? (
              <MaterialCommunityIcons name="check-decagram" size={13} color={colors.white} />
            ) : null}
            <Text style={styles.roleBadgeText}>{roleLabel}</Text>
          </View>
        </LinearGradient>

        {stats.length > 0 ? (
          <View style={styles.statsRow}>
            {stats.map((stat, index) => (
              <FadeInUp key={stat.label} index={index} style={styles.statTile}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </FadeInUp>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <FadeInUp index={0}>
            <Tappable style={styles.rowButton} onPress={handleAvatarPress} disabled={uploadingPhoto}>
              <View style={styles.rowIcon}>
                <Ionicons name="image-outline" size={19} color={colors.darkAccentGreen} />
              </View>
              <View style={styles.rowTextColumn}>
                <Text style={styles.rowLabel}>Profile Picture</Text>
                <Text style={styles.rowValue}>
                  {avatarUrl ? 'Change or remove your photo' : 'Add a photo so people recognise you'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Tappable>
          </FadeInUp>

          <FadeInUp index={0}>
            <Tappable style={styles.rowButton} onPress={() => navigation.navigate('EditProfile')}>
              <View style={styles.rowIcon}>
                <Ionicons name="person-outline" size={19} color={colors.darkAccentGreen} />
              </View>
              <View style={styles.rowTextColumn}>
                <Text style={styles.rowLabel}>Edit Profile</Text>
                <Text style={styles.rowValue}>Update your name and phone number</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Tappable>
          </FadeInUp>

          <FadeInUp index={0}>
            <Tappable style={styles.rowButton} onPress={() => navigation.navigate('ChangePassword')}>
              <View style={styles.rowIcon}>
                <Ionicons name="lock-closed-outline" size={19} color={colors.darkAccentGreen} />
              </View>
              <View style={styles.rowTextColumn}>
                <Text style={styles.rowLabel}>Change Password</Text>
                <Text style={styles.rowValue}>Update the password you log in with</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Tappable>
          </FadeInUp>

          {role === 'patient' ? (
            <FadeInUp index={0}>
              <Tappable style={styles.rowButton} onPress={() => navigation.navigate('HealthInfo')}>
                <View style={styles.rowIcon}>
                  <Ionicons name="clipboard-outline" size={19} color={colors.darkAccentGreen} />
                </View>
                <View style={styles.rowTextColumn}>
                  <Text style={styles.rowLabel}>Health Info</Text>
                  <Text style={styles.rowValue}>Update the details behind your predictions</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Tappable>
            </FadeInUp>
          ) : null}

          {role === 'patient' ? (
            <FadeInUp index={0}>
              <Tappable style={styles.rowButton} onPress={() => navigation.navigate('Reminders')}>
                <View style={styles.rowIcon}>
                  <Ionicons name="alarm-outline" size={19} color={colors.darkAccentGreen} />
                </View>
                <View style={styles.rowTextColumn}>
                  <Text style={styles.rowLabel}>Reminders</Text>
                  <Text style={styles.rowValue}>Turn your daily health reminders on or off</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Tappable>
            </FadeInUp>
          ) : null}

          {role === 'patient' ? (
            <FadeInUp index={0}>
              <Tappable style={styles.rowButton} onPress={() => navigation.navigate('DrugReminders')}>
                <View style={styles.rowIcon}>
                  <Ionicons name="medical-outline" size={19} color={colors.darkAccentGreen} />
                </View>
                <View style={styles.rowTextColumn}>
                  <Text style={styles.rowLabel}>Medicine Reminders</Text>
                  <Text style={styles.rowValue}>Get an alarm when it is time to take your drugs</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Tappable>
            </FadeInUp>
          ) : null}

          {role === 'medical_practitioner' ? (
            <FadeInUp index={0}>
              <Tappable style={styles.rowButton} onPress={() => navigation.navigate('ProCredentials')}>
                <View style={styles.rowIcon}>
                  <Ionicons
                    name={isVerified ? 'shield-checkmark' : 'shield-outline'}
                    size={19}
                    color={isVerified ? colors.primaryGreen : '#C77B00'}
                  />
                </View>
                <View style={styles.rowTextColumn}>
                  <Text style={styles.rowLabel}>Verification</Text>
                  <Text style={styles.rowValue}>
                    {isVerified ? 'Verified practitioner' : 'Not verified yet. Tap to submit your licence'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Tappable>
            </FadeInUp>
          ) : null}

          <FadeInUp index={1}>
            <Tappable style={styles.rowButton} onPress={() => navigation.navigate('Notifications')}>
              <View style={styles.rowIcon}>
                <Ionicons name="notifications-outline" size={19} color={colors.darkAccentGreen} />
              </View>
              <View style={styles.rowTextColumn}>
                <Text style={styles.rowLabel}>Notifications</Text>
                <Text style={styles.rowValue}>View your activity feed</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Tappable>
          </FadeInUp>

          <FadeInUp index={2}>
            <Tappable style={styles.rowButton} onPress={() => setAboutOpen((open) => !open)}>
              <View style={styles.rowIcon}>
                <Ionicons name="information-circle-outline" size={19} color={colors.darkAccentGreen} />
              </View>
              <View style={styles.rowTextColumn}>
                <Text style={styles.rowLabel}>About HealthCheck</Text>
                {aboutOpen ? (
                  <Text style={styles.rowValue}>
                    HealthCheck helps you understand your risk for conditions like diabetes,
                    hypertension and stroke, and connects you with verified practitioners.
                    {'\n'}Version 1.0.0
                  </Text>
                ) : (
                  <Text style={styles.rowValue}>App version and info</Text>
                )}
              </View>
              <Ionicons
                name={aboutOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textMuted}
              />
            </Tappable>
          </FadeInUp>

          <FadeInUp index={3}>
            <Tappable style={styles.rowButton} onPress={handleDeleteAccount}>
              <View style={styles.rowIcon}>
                <Ionicons name="trash-outline" size={19} color={colors.danger} />
              </View>
              <View style={styles.rowTextColumn}>
                <Text style={styles.rowLabel}>Delete Account</Text>
                <Text style={styles.rowValue}>Permanently close your account</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Tappable>
          </FadeInUp>
        </View>

        <FadeInUp index={3}>
          <Tappable style={styles.signOutButton} onPress={handleSignOut} disabled={signingOut}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={styles.signOutText}>{signingOut ? 'Signing out...' : 'Sign Out'}</Text>
          </Tappable>
        </FadeInUp>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 28,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  avatar: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primaryGreen,
  },
  name: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 19,
    color: colors.white,
    marginTop: 12,
  },
  email: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 12,
  },
  roleBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.white,
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginTop: -20,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  statTile: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  statLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 3,
  },
  section: {
    paddingHorizontal: 24,
    marginTop: 24,
    gap: 12,
  },
  rowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextColumn: {
    flex: 1,
  },
  rowLabel: {
    fontFamily: fonts.headingMedium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  rowValue: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: 2,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 12,
    marginHorizontal: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signOutText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.danger,
  },
});
