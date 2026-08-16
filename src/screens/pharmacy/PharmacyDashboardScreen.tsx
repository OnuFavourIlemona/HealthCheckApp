import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PatternBackground } from '../../components/ui/PatternBackground';
import { greetingForNow } from '../../lib/dashboard';
import { fetchUnreadCount, subscribeToNotifications } from '../../lib/notifications';
import { fetchPharmacyBookings, labTestLabel, type PharmacyBooking } from '../../lib/pharmacyBookings';
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

export function PharmacyDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [pharmacy, setPharmacy] = useState<PharmacySummary | null>(null);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [bookings, setBookings] = useState<PharmacyBooking[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadUnread = useCallback(async () => {
    setUnreadCount(await fetchUnreadCount());
  }, []);

  const loadDashboard = useCallback(async () => {
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
    setOwnerName(profile?.full_name ?? user.user_metadata?.full_name ?? null);
    setPharmacy(store ?? null);
    setBookings(await fetchPharmacyBookings());
    setLoaded(true);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadDashboard(), loadUnread()]);
    setRefreshing(false);
  }, [loadDashboard, loadUnread]);

  const pendingCount = bookings.filter((b) => b.status === 'pending').length;

  useFocusEffect(
    useCallback(() => {
      loadUnread();
    }, [loadUnread]),
  );

  useEffect(() => subscribeToNotifications(loadUnread), [loadUnread]);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  const goToStore = () => navigation.navigate('My Store' as never);
  const goToBookings = () => navigation.navigate('Bookings' as never);

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
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primaryGreen}
            colors={[colors.primaryGreen]}
          />
        }
      >
        {/* Green hero header */}
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.headerTextColumn}>
              <Text style={styles.heroGreeting}>{greetingForNow()}</Text>
              <Text style={styles.heroName} numberOfLines={1}>
                {pharmacy?.name ?? ownerName ?? 'Your Pharmacy'}
              </Text>
            </View>
            <Pressable style={styles.bellButton} onPress={() => navigation.navigate('Notifications')}>
              <Ionicons name="notifications-outline" size={24} color={colors.white} />
              {unreadCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
          <View style={styles.heroPill}>
            <MaterialCommunityIcons
              name={pharmacy?.is_verified ? 'check-decagram' : 'progress-clock'}
              size={18}
              color={colors.white}
            />
            <Text style={styles.heroPillText}>
              {pharmacy?.is_verified
                ? 'Verified pharmacy. Patients can find and trust your store.'
                : 'Not verified yet. Finish your setup below to get verified.'}
            </Text>
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.quickRow}>
          <Pressable style={styles.quickCard} onPress={goToStore}>
            <View style={styles.quickIcon}>
              <Ionicons name="storefront-outline" size={22} color={colors.darkAccentGreen} />
            </View>
            <Text style={styles.quickLabel}>My Store</Text>
          </Pressable>
          <Pressable style={styles.quickCard} onPress={goToBookings}>
            <View style={styles.quickIcon}>
              <Ionicons name="clipboard-outline" size={22} color={colors.darkAccentGreen} />
              {pendingCount > 0 ? (
                <View style={styles.quickBadge}>
                  <Text style={styles.quickBadgeText}>{pendingCount > 9 ? '9+' : pendingCount}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.quickLabel}>Bookings</Text>
          </Pressable>
          <Pressable
            style={styles.quickCard}
            onPress={() => navigation.navigate('PharmacyMedicines')}
          >
            <View style={styles.quickIcon}>
              <MaterialCommunityIcons name="pill" size={22} color={colors.darkAccentGreen} />
            </View>
            <Text style={styles.quickLabel}>Medicines</Text>
          </Pressable>
        </View>

        {/* Setup checklist */}
        <Pressable style={styles.checklistCard} onPress={goToStore}>
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
              {!step.done ? (
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={styles.stepChevron} />
              ) : null}
            </View>
          ))}
          <Text style={styles.checklistHint}>
            {loaded && !pharmacy
              ? 'Tap here to add your pharmacy details in My Store.'
              : 'Tap to manage your store details and verification.'}
          </Text>
        </Pressable>

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
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Lab Test Bookings</Text>
          {bookings.length > 0 ? (
            <Pressable onPress={goToBookings} hitSlop={8}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          ) : null}
        </View>
        {!pharmacy?.offers_lab_tests ? (
          <Pressable style={styles.infoCard} onPress={goToStore}>
            <Ionicons name="flask-outline" size={20} color={colors.darkAccentGreen} />
            <Text style={styles.infoText}>
              Turn on “We offer lab tests” in My Store to start receiving bookings from patients
              near you.
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        ) : bookings.length === 0 ? (
          <View style={styles.infoCard}>
            <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.infoText}>
              No bookings yet. Patients booking lab tests nearby will see your pharmacy.
            </Text>
          </View>
        ) : (
          bookings.slice(0, 3).map((booking) => (
            <Pressable key={booking.id} style={styles.bookingCard} onPress={goToBookings}>
              <View style={styles.bookingIcon}>
                <MaterialCommunityIcons name="test-tube" size={20} color={colors.darkAccentGreen} />
              </View>
              <View style={styles.bookingBody}>
                <Text style={styles.bookingTitle}>{booking.patient_name}</Text>
                <Text style={styles.bookingMeta}>
                  {labTestLabel(booking.test_type)} ·{' '}
                  {booking.mode === 'home' ? 'Home collection' : 'Walk-in'}
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
            </Pressable>
          ))
        )}
        {bookings.length > 3 ? (
          <Pressable style={styles.viewAllButton} onPress={goToBookings}>
            <Text style={styles.viewAllText}>View all {bookings.length} bookings</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.darkAccentGreen} />
          </Pressable>
        ) : null}
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
  hero: {
    backgroundColor: colors.primaryGreen,
    borderRadius: 18,
    padding: 18,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroGreeting: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  heroName: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 21,
    color: colors.white,
    marginTop: 2,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 12,
    padding: 11,
    marginTop: 14,
  },
  heroPillText: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.white,
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
  quickRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  quickCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.textPrimary,
  },
  quickBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  quickBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    color: colors.white,
  },
  stepChevron: {
    marginLeft: 'auto',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  seeAll: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.primaryGreen,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.pillGreenBg,
    borderRadius: 12,
    height: 46,
    marginTop: 12,
  },
  viewAllText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.darkAccentGreen,
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
