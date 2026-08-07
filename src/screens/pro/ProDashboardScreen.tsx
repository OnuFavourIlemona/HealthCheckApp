import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import {
  acceptConsultation,
  fetchPendingRequests,
  subscribeToPendingRequests,
  type Consultation,
} from '../../lib/consultations';
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
import { PatternBackground } from '../../components/ui/PatternBackground';
import { colors, fonts } from '../../theme';

type ProDashboardNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<ProTabsParamList, 'Dashboard'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function ProDashboardScreen() {
  const navigation = useNavigation<ProDashboardNavigation>();
  const [requests, setRequests] = useState<Consultation[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [submittedForReview, setSubmittedForReview] = useState(false);
  const [displayName, setDisplayName] = useState('Practitioner');
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
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
      .select('full_name, specialty, is_verified, license_submitted_at')
      .eq('id', userId)
      .maybeSingle();
    setIsVerified(data?.is_verified ?? false);
    setSubmittedForReview(!!data?.license_submitted_at);
    if (data?.full_name) setDisplayName(data.full_name);
    setSpecialty(data?.specialty ?? null);
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
          role={specialty ?? (isVerified ? 'Verified practitioner' : 'Medical practitioner')}
          verified={!!isVerified}
          notificationCount={unreadCount}
          onPressNotifications={() => navigation.navigate('Notifications')}
          onPressAvatar={() => navigation.navigate('Profile')}
        />

        <View style={styles.sectionSpacing}>
          <EarningsCard
            amount={formatNaira(stats.earnings)}
            growthLabel={`${stats.completedConsultations} completed consultation${
              stats.completedConsultations === 1 ? '' : 's'
            }`}
            tier={tierFor(stats.completedConsultations).name}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statsScroll}
          contentContainerStyle={styles.statsRow}
        >
          <StatTile label="Patients Attended" value={String(stats.patientsAttended)} />
          <StatTile
            label="Avg. Rating"
            value={stats.averageRating != null ? stats.averageRating.toFixed(1) : '—'}
            valueEmoji={stats.averageRating != null ? '⭐' : undefined}
            trendLabel={
              stats.ratingCount > 0
                ? `${stats.ratingCount} rating${stats.ratingCount === 1 ? '' : 's'}`
                : 'No ratings yet'
            }
          />
          <StatTile label="Active Chats" value={String(stats.activeConsultations)} />
          <StatTile label="Completed" value={String(stats.completedConsultations)} />
        </ScrollView>

        <View style={styles.sectionSpacing}>
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
        </View>

        <View style={styles.sectionSpacing}>
          <PerformanceOverview
            dailyCounts={stats.dailyCounts}
            ratingTrend={stats.ratingTrend}
            totalConsultations={stats.patientsAttended > 0 ? stats.completedConsultations + stats.activeConsultations : 0}
            averageRating={stats.averageRating}
          />
        </View>
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
  statsScroll: {
    marginTop: 20,
    marginHorizontal: -24,
  },
  statsRow: {
    paddingHorizontal: 24,
    gap: 12,
  },
});
