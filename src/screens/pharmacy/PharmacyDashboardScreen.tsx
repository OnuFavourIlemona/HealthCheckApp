import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PatternBackground } from '../../components/ui/PatternBackground';
import { fetchUnreadCount, subscribeToNotifications } from '../../lib/notifications';
import { supabase } from '../../lib/supabase';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts } from '../../theme';

type PharmacySummary = {
  id: string;
  name: string;
  address: string | null;
  is_verified: boolean;
  license_path: string | null;
  latitude: number | null;
  offers_lab_tests: boolean;
};

type LabBooking = {
  id: string;
  test_type: string;
  mode: string;
  status: string;
  created_at: string;
};

const TEST_LABELS: Record<string, string> = {
  blood_sugar: 'Blood Sugar (Fasting)',
  full_blood_count: 'Full Blood Count',
  lipid_panel: 'Lipid Panel',
  malaria_typhoid: 'Malaria + Typhoid',
  blood_pressure: 'Blood Pressure Check',
  kidney_function: 'Kidney Function',
};

export function PharmacyDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [pharmacy, setPharmacy] = useState<PharmacySummary | null>(null);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [bookings, setBookings] = useState<LabBooking[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnread = useCallback(async () => {
    setUnreadCount(await fetchUnreadCount());
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUnread();
    }, [loadUnread]),
  );

  useEffect(() => subscribeToNotifications(loadUnread), [loadUnread]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;
        if (!user) return;

        const [{ data: profile }, { data: store }] = await Promise.all([
          supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
          supabase
            .from('pharmacies')
            .select('id, name, address, is_verified, license_path, latitude, offers_lab_tests')
            .eq('owner_id', user.id)
            .maybeSingle(),
        ]);
        if (cancelled) return;
        setOwnerName(profile?.full_name ?? user.user_metadata?.full_name ?? null);
        setPharmacy(store ?? null);

        if (store?.id) {
          const { data: labBookings } = await supabase
            .from('lab_bookings')
            .select('id, test_type, mode, status, created_at')
            .eq('pharmacy_id', store.id)
            .order('created_at', { ascending: false });
          if (!cancelled) setBookings((labBookings ?? []) as LabBooking[]);
        }
        setLoaded(true);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const setupSteps = [
    { label: 'Add pharmacy details', done: !!pharmacy },
    { label: 'Pin your store location', done: pharmacy?.latitude != null },
    { label: 'Upload government license', done: !!pharmacy?.license_path },
    { label: 'Get verified', done: !!pharmacy?.is_verified },
  ];
  const completed = setupSteps.filter((s) => s.done).length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <PatternBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextColumn}>
            <Text style={styles.greeting} numberOfLines={1}>
              {pharmacy?.name ?? ownerName ?? 'Your Pharmacy'}
            </Text>
            <Text style={styles.subtitle}>
              {pharmacy?.address ?? 'Complete your store setup to appear in patient searches.'}
            </Text>
          </View>
          <Pressable
            style={styles.bellButton}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* Verification status */}
        <View style={[styles.statusCard, pharmacy?.is_verified ? styles.statusVerified : styles.statusPending]}>
          <MaterialCommunityIcons
            name={pharmacy?.is_verified ? 'check-decagram' : 'progress-clock'}
            size={26}
            color={pharmacy?.is_verified ? colors.white : '#C77B00'}
          />
          <View style={styles.statusTextColumn}>
            <Text style={[styles.statusTitle, pharmacy?.is_verified && styles.statusTitleVerified]}>
              {pharmacy?.is_verified ? 'Verified Pharmacy' : 'Not verified yet'}
            </Text>
            <Text style={[styles.statusBody, pharmacy?.is_verified && styles.statusBodyVerified]}>
              {pharmacy?.is_verified
                ? 'Patients can find and trust your store.'
                : 'Finish setting up below. Verification unlocks patient referrals.'}
            </Text>
          </View>
        </View>

        {/* Setup checklist */}
        <View style={styles.checklistCard}>
          <View style={styles.checklistHeader}>
            <Text style={styles.checklistTitle}>Store Setup</Text>
            <Text style={styles.checklistProgress}>
              {completed}/{setupSteps.length}
            </Text>
          </View>
          {setupSteps.map((step) => (
            <View key={step.label} style={styles.stepRow}>
              <Ionicons
                name={step.done ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={step.done ? colors.primaryGreen : colors.textMuted}
              />
              <Text style={[styles.stepLabel, step.done && styles.stepLabelDone]}>{step.label}</Text>
            </View>
          ))}
          {loaded && !pharmacy ? (
            <Text style={styles.checklistHint}>
              Head to the My Store tab to add your pharmacy details.
            </Text>
          ) : null}
        </View>

        {/* Real lab-booking figures */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Lab Bookings</Text>
            <Text style={styles.statValue}>{bookings.length}</Text>
            <Text style={styles.statHint}>All time</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Pending</Text>
            <Text style={styles.statValue}>
              {bookings.filter((b) => b.status === 'pending').length}
            </Text>
            <Text style={styles.statHint}>Awaiting your response</Text>
          </View>
        </View>

        {/* Incoming lab bookings */}
        <Text style={styles.sectionTitle}>Lab Test Bookings</Text>
        {!pharmacy?.offers_lab_tests ? (
          <View style={styles.infoCard}>
            <Ionicons name="flask-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.infoText}>
              Turn on “We offer lab tests” in My Store to start receiving bookings from patients
              near you.
            </Text>
          </View>
        ) : bookings.length === 0 ? (
          <View style={styles.infoCard}>
            <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.infoText}>
              No bookings yet. Patients booking lab tests nearby will see your pharmacy.
            </Text>
          </View>
        ) : (
          bookings.map((booking) => (
            <View key={booking.id} style={styles.bookingCard}>
              <View style={styles.bookingIcon}>
                <MaterialCommunityIcons name="test-tube" size={20} color={colors.darkAccentGreen} />
              </View>
              <View style={styles.bookingBody}>
                <Text style={styles.bookingTitle}>
                  {TEST_LABELS[booking.test_type] ?? booking.test_type}
                </Text>
                <Text style={styles.bookingMeta}>
                  {booking.mode === 'home' ? 'Home collection' : 'Walk-in'} ·{' '}
                  {new Date(booking.created_at).toLocaleDateString()}
                </Text>
              </View>
              <View
                style={[
                  styles.bookingStatus,
                  booking.status === 'pending' ? styles.bookingPending : styles.bookingDone,
                ]}
              >
                <Text
                  style={[
                    styles.bookingStatusText,
                    booking.status === 'pending'
                      ? styles.bookingTextPending
                      : styles.bookingTextDone,
                  ]}
                >
                  {booking.status}
                </Text>
              </View>
            </View>
          ))
        )}
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerTextColumn: {
    flex: 1,
  },
  bellButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    color: colors.white,
  },
  greeting: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 16,
    marginTop: 18,
  },
  statusVerified: {
    backgroundColor: colors.cardDark,
  },
  statusPending: {
    backgroundColor: '#FFF4E0',
  },
  statusTextColumn: {
    flex: 1,
  },
  statusTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15.5,
    color: '#C77B00',
  },
  statusTitleVerified: {
    color: colors.white,
  },
  statusBody: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    color: '#9A6A10',
    marginTop: 2,
  },
  statusBodyVerified: {
    color: colors.cardDarkMutedText,
  },
  checklistCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  checklistTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  checklistProgress: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.primaryGreen,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  stepLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  stepLabelDone: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  checklistHint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 13,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  statLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  statValue: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 24,
    color: colors.textPrimary,
    marginTop: 4,
  },
  statHint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: 24,
  },
  infoCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 12,
  },
  infoText: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  bookingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  bookingIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingBody: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  bookingTitle: {
    fontFamily: fonts.headingMedium,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  bookingMeta: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bookingStatus: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  bookingPending: {
    backgroundColor: '#FFF4E0',
  },
  bookingDone: {
    backgroundColor: colors.pillGreenBg,
  },
  bookingStatusText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    textTransform: 'capitalize',
  },
  bookingTextPending: {
    color: '#C77B00',
  },
  bookingTextDone: {
    color: colors.darkAccentGreen,
  },
});
