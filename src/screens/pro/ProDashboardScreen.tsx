import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import {
  acceptConsultation,
  fetchPendingRequests,
  subscribeToPendingRequests,
  type Consultation,
} from '../../lib/consultations';
import { hasProvidedNin } from '../../lib/nin';
import { fetchUnreadCount, subscribeToNotifications } from '../../lib/notifications';
import {
  EMPTY_PRO_STATS,
  fetchProStats,
  formatNaira,
  tierFor,
  type ProStats,
} from '../../lib/proStats';
import type { ProTabsParamList, RootStackParamList } from '../../navigation/types';
import {
  EarningsCard,
  IncomingRequestsCard,
  PerformanceOverview,
  ProDashboardHeader,
  StatTile,
} from '../../components/proDashboard';
import { FadeInUp } from '../../components/ui/FadeInUp';
import { PatternBackground } from '../../components/ui/PatternBackground';
import { Tappable } from '../../components/ui/Tappable';
import { colors, fonts } from '../../theme';

type ProDashboardNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<ProTabsParamList, 'Dashboard'>,
  NativeStackNavigationProp<RootStackParamList>
>;

// The stats grid content area is the screen width minus the ScrollView's
// horizontal padding (24 each side) and the gap between the two columns.
const CONTENT_PADDING = 24;
const GRID_GAP = 12;

export function ProDashboardScreen() {
  const navigation = useNavigation<ProDashboardNavigation>();
  // Tappable only forwards `style` to its inner Animated.View, whose own
  // parent (Pressable) has no explicit size -- so a percentage width can't
  // resolve there and silently collapses to shrink-to-content instead. A
  // computed pixel width sidesteps that entirely.
  const { width: windowWidth } = useWindowDimensions();
  const statTileWidth = (windowWidth - CONTENT_PADDING * 2 - GRID_GAP) / 2;
  const [requests, setRequests] = useState<Consultation[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [submittedForReview, setSubmittedForReview] = useState(false);
  const [displayName, setDisplayName] = useState('Practitioner');
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<ProStats>(EMPTY_PRO_STATS);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadRequests = useCallback(async () => {
    const pending = await fetchPendingRequests();
    setRequests(pending);
  }, []);

  const loadVerification = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    setEmail(sessionData.session?.user.email ?? null);
    if (!userId) {
      setIsVerified(false);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('full_name, specialty, is_verified, license_submitted_at, avatar_url')
      .eq('id', userId)
      .maybeSingle();
    setIsVerified(data?.is_verified ?? false);
    setSubmittedForReview(!!data?.license_submitted_at);
    if (data?.full_name) setDisplayName(data.full_name);
    setSpecialty(data?.specialty ?? null);
    setAvatarUrl(data?.avatar_url ?? null);
  }, []);

  const loadStats = useCallback(async () => {
    setStats(await fetchProStats());
  }, []);

  const loadUnread = useCallback(async () => {
    setUnreadCount(await fetchUnreadCount());
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadVerification();
      loadRequests();
      loadStats();
      loadUnread();
    }, [loadVerification, loadRequests, loadStats, loadUnread]),
  );

  // New requests (and ones claimed by others) update the list instantly.
  useEffect(() => subscribeToPendingRequests(loadRequests), [loadRequests]);
  useEffect(() => subscribeToNotifications(loadUnread), [loadUnread]);

  const handleAccept = async (id: string) => {
    if (acceptingId) return;
    setAcceptError(null);

    // A practitioner must have their own NIN on file before taking a patient,
    // so both sides are accountable if a consultation is ever disputed.
    if (!(await hasProvidedNin())) {
      navigation.navigate('VerifyNin');
      return;
    }

    setAcceptingId(id);
    const { consultation, error } = await acceptConsultation(id);
    setAcceptingId(null);

    if (error || !consultation) {
      setAcceptError(error ?? 'Could not accept this request.');
      loadRequests();
      return;
    }
    setRequests((prev) => prev.filter((r) => r.id !== id));
    navigation.navigate('ProConnect', { consultationId: consultation.id });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <PatternBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ProDashboardHeader
          name={displayName}
          email={email}
          avatarUrl={avatarUrl}
          role={specialty ?? (isVerified ? 'Verified practitioner' : 'Medical practitioner')}
          verified={!!isVerified}
          notificationCount={unreadCount}
          onPressNotifications={() => navigation.navigate('Notifications')}
          onPressAvatar={() => navigation.navigate('Profile')}
        />

        <FadeInUp index={0} style={styles.sectionSpacing}>
          <Tappable onPress={() => navigation.navigate('Payments')}>
            <EarningsCard
              amount={formatNaira(stats.earnings)}
              growthLabel={`${stats.completedConsultations} completed consultation${
                stats.completedConsultations === 1 ? '' : 's'
              }`}
              tier={tierFor(stats.completedConsultations).name}
            />
          </Tappable>
        </FadeInUp>

        <View style={styles.statsGrid}>
          <Tappable style={{ width: statTileWidth }} onPress={() => navigation.navigate('Patients')}>
            <StatTile label="Patients Attended" value={String(stats.patientsAttended)} tinted fill />
          </Tappable>
          <Tappable style={{ width: statTileWidth }} onPress={() => navigation.navigate('Payments')}>
            <StatTile
              label="Avg. Rating"
              value={stats.averageRating != null ? stats.averageRating.toFixed(1) : '—'}
              valueEmoji={stats.averageRating != null ? '⭐' : undefined}
              trendLabel={
                stats.ratingCount > 0
                  ? `${stats.ratingCount} rating${stats.ratingCount === 1 ? '' : 's'}`
                  : 'No ratings yet'
              }
              tinted
              fill
            />
          </Tappable>
          <Tappable style={{ width: statTileWidth }} onPress={() => navigation.navigate('Schedule')}>
            <StatTile label="Active Chats" value={String(stats.activeConsultations)} tinted fill />
          </Tappable>
          <Tappable style={{ width: statTileWidth }} onPress={() => navigation.navigate('Patients')}>
            <StatTile label="Completed" value={String(stats.completedConsultations)} tinted fill />
          </Tappable>
        </View>

        <FadeInUp index={1} style={styles.sectionSpacing}>
          {isVerified === false ? (
            <Pressable
              style={styles.verifyCard}
              onPress={() => navigation.navigate('ProCredentials')}
            >
              <View style={styles.verifyIcon}>
                <MaterialCommunityIcons name="shield-alert-outline" size={22} color="#C77B00" />
              </View>
              <View style={styles.verifyTextColumn}>
                <Text style={styles.verifyTitle}>
                  {submittedForReview ? 'Verification under review' : 'Get verified to see requests'}
                </Text>
                <Text style={styles.verifyBody}>
                  {submittedForReview
                    ? "We're checking your licence. You'll be able to accept patient requests once approved."
                    : 'Patient requests contain confidential medical information, so only licence-verified practitioners can view them.'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#C77B00" />
            </Pressable>
          ) : (
            <IncomingRequestsCard
              requests={requests}
              acceptingId={acceptingId}
              error={acceptError}
              onAccept={handleAccept}
            />
          )}
        </FadeInUp>

        <FadeInUp index={2} style={styles.sectionSpacing}>
          <PerformanceOverview
            dailyCounts={stats.dailyCounts}
            ratingTrend={stats.ratingTrend}
            totalConsultations={stats.patientsAttended > 0 ? stats.completedConsultations + stats.activeConsultations : 0}
            averageRating={stats.averageRating}
          />
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 32,
  },
  sectionSpacing: {
    marginTop: 20,
  },
  verifyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF4E0',
    borderRadius: 16,
    padding: 16,
  },
  verifyIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(199,123,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyTextColumn: {
    flex: 1,
  },
  verifyTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: '#C77B00',
  },
  verifyBody: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#9A6A10',
    marginTop: 3,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 20,
  },
});
