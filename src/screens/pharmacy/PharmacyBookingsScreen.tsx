import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BounceIn } from '../../components/ui/BounceIn';
import { FadeInUp } from '../../components/ui/FadeInUp';
import { PatternBackground } from '../../components/ui/PatternBackground';
import { SetAppointmentSheet } from '../../components/SetAppointmentSheet';
import {
  fetchPharmacyReservations,
  reservationCode,
  setReservationStatus,
  type PharmacyReservation,
  type ReservationStatus,
} from '../../lib/medicineReservations';
import {
  fetchPharmacyBookings,
  labTestLabel,
  requestBookingAddress,
  setBookingAppointmentTime,
  setLabBookingStatus,
  type PharmacyBooking,
  type PharmacyBookingStatus,
} from '../../lib/pharmacyBookings';
import { successHaptic } from '../../lib/haptics';
import type { PharmacyTabsParamList } from '../../navigation/types';
import { colors, fonts } from '../../theme';

type Props = BottomTabScreenProps<PharmacyTabsParamList, 'Bookings'>;

type FilterKey = 'all' | 'pending' | 'accepted' | 'completed';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'completed', label: 'Done' },
  { key: 'all', label: 'All' },
];

const STATUS_META: Record<PharmacyBookingStatus, { label: string; bg: string; color: string }> = {
  pending: { label: 'Pending', bg: '#FFF4E0', color: '#C77B00' },
  accepted: { label: 'Accepted', bg: colors.pillGreenBg, color: colors.darkAccentGreen },
  completed: { label: 'Done', bg: colors.pillGreenBg, color: colors.darkAccentGreen },
  declined: { label: 'Declined', bg: '#FDEBE4', color: colors.danger },
};

const RES_STATUS_META: Record<ReservationStatus, { label: string; bg: string; color: string }> = {
  pending: { label: 'New', bg: '#FFF4E0', color: '#C77B00' },
  ready: { label: 'Ready', bg: colors.pillGreenBg, color: colors.darkAccentGreen },
  collected: { label: 'Collected', bg: colors.pillGreenBg, color: colors.darkAccentGreen },
  cancelled: { label: 'Cancelled', bg: '#FDEBE4', color: colors.danger },
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
}

function formatAppointment(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Puts the item a notification pointed to first, so it's visible without scrolling to find it. */
function withHighlightedFirst<T extends { id: string }>(items: T[], highlightId: string | undefined): T[] {
  if (!highlightId) return items;
  const target = items.find((i) => i.id === highlightId);
  if (!target) return items;
  return [target, ...items.filter((i) => i.id !== highlightId)];
}

export function PharmacyBookingsScreen({ route }: Props) {
  const highlightId = route.params?.bookingId;
  const highlightReservationId = route.params?.reservationId;
  const [section, setSection] = useState<'labs' | 'holds'>(route.params?.section ?? 'labs');
  const [bookings, setBookings] = useState<PharmacyBooking[]>([]);
  const [reservations, setReservations] = useState<PharmacyReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [schedulingBooking, setSchedulingBooking] = useState<PharmacyBooking | null>(null);
  const [schedulingSubmitting, setSchedulingSubmitting] = useState(false);
  const [schedulingError, setSchedulingError] = useState<string | null>(null);
  // A ref, not just the busyId state: state set inside a handler doesn't
  // take effect until the next render, so a fast double-tap can fire the
  // same action twice before `busyId` would have blocked the second one.
  const busyRef = useRef<string | null>(null);

  // A notification can point at a booking that isn't 'pending' (e.g. the
  // patient just sent their address for an already-accepted one), so make
  // sure the filter that's showing can actually reveal it.
  useEffect(() => {
    if (highlightId) setFilter('all');
  }, [highlightId]);

  useEffect(() => {
    if (route.params?.section) setSection(route.params.section);
  }, [route.params?.section]);

  const load = useCallback(async () => {
    const [labs, holds] = await Promise.all([
      fetchPharmacyBookings(),
      fetchPharmacyReservations(),
    ]);
    setBookings(withHighlightedFirst(labs, highlightId));
    setReservations(withHighlightedFirst(holds, highlightReservationId));
    setLoading(false);
  }, [highlightId, highlightReservationId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const counts = {
    pending: bookings.filter((b) => b.status === 'pending').length,
    accepted: bookings.filter((b) => b.status === 'accepted').length,
    completed: bookings.filter((b) => b.status === 'completed').length,
    all: bookings.length,
  };

  const visible =
    filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);

  const pendingHolds = reservations.filter((r) => r.status === 'pending').length;

  const act = async (booking: PharmacyBooking, status: Exclude<PharmacyBookingStatus, 'pending'>) => {
    if (busyRef.current) return;
    busyRef.current = booking.id;
    setBusyId(booking.id);
    setError(null);
    // Optimistic update so the UI feels instant.
    const previous = bookings;
    setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status } : b)));
    const { ok, error: err } = await setLabBookingStatus(booking.id, status);
    if (!ok) {
      setBookings(previous);
      setError(err ?? 'Could not update the booking. Please try again.');
    } else {
      successHaptic();
    }
    busyRef.current = null;
    setBusyId(null);
  };

  const requestAddress = async (booking: PharmacyBooking) => {
    if (busyRef.current) return;
    busyRef.current = booking.id;
    setBusyId(booking.id);
    setError(null);
    const previous = bookings;
    setBookings((prev) =>
      prev.map((b) =>
        b.id === booking.id ? { ...b, address_requested_at: new Date().toISOString() } : b,
      ),
    );
    const { ok, error: err } = await requestBookingAddress(booking.id);
    if (!ok) {
      setBookings(previous);
      setError(err ?? 'Could not send that request. Please try again.');
    }
    busyRef.current = null;
    setBusyId(null);
  };

  const handleScheduleAppointment = async (time: Date) => {
    if (!schedulingBooking || schedulingSubmitting) return;
    setSchedulingSubmitting(true);
    setSchedulingError(null);
    const { ok, error: err } = await setBookingAppointmentTime(schedulingBooking.id, time);
    setSchedulingSubmitting(false);
    if (!ok) {
      setSchedulingError(err ?? 'Could not set that time. Please try again.');
      return;
    }
    setBookings((prev) =>
      prev.map((b) =>
        b.id === schedulingBooking.id ? { ...b, appointment_time: time.toISOString() } : b,
      ),
    );
    setSchedulingBooking(null);
  };

  const actReservation = async (
    reservation: PharmacyReservation,
    status: Exclude<ReservationStatus, 'pending'>,
  ) => {
    if (busyRef.current) return;
    busyRef.current = reservation.id;
    setBusyId(reservation.id);
    setError(null);
    const previous = reservations;
    setReservations((prev) => prev.map((r) => (r.id === reservation.id ? { ...r, status } : r)));
    const { ok, error: err } = await setReservationStatus(reservation.id, status);
    if (!ok) {
      setReservations(previous);
      setError(err ?? 'Could not update the reservation. Please try again.');
    } else {
      successHaptic();
    }
    busyRef.current = null;
    setBusyId(null);
  };

  const renderHolds = () => {
    if (reservations.length === 0) {
      return (
        <View style={styles.emptyCard}>
          <BounceIn style={styles.emptyIcon}>
            <MaterialCommunityIcons name="pill" size={26} color={colors.darkAccentGreen} />
          </BounceIn>
          <Text style={styles.emptyTitle}>No medicine holds yet</Text>
          <Text style={styles.emptyBody}>
            When a patient reserves a medicine you stock, it shows up here so you can set it aside.
          </Text>
        </View>
      );
    }
    return (
      <>
        {reservations.map((reservation, index) => {
          const meta = RES_STATUS_META[reservation.status];
          const busy = busyId === reservation.id;
          return (
            <FadeInUp key={reservation.id} index={index}>
              <View style={[styles.card, reservation.id === highlightReservationId && styles.cardHighlighted]}>
                <View style={styles.cardTop}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {reservation.patient_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.cardTextColumn}>
                    <Text style={styles.patientName}>{reservation.patient_name}</Text>
                    <Text style={styles.testName}>{reservation.medicine_name}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.statusPillText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Ionicons name="barcode-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.metaText}>Code {reservationCode(reservation.id)}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.metaText}>{timeAgo(reservation.created_at)}</Text>
                  </View>
                </View>

                {reservation.status === 'pending' ? (
                  <View style={styles.actionRow}>
                    <Pressable
                      style={[styles.primaryAction, busy && styles.actionDisabled]}
                      onPress={() => actReservation(reservation, 'ready')}
                      disabled={busy}
                    >
                      <Ionicons name="checkmark" size={16} color={colors.white} />
                      <Text style={styles.primaryActionText}>Mark ready</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.ghostAction, busy && styles.actionDisabled]}
                      onPress={() => actReservation(reservation, 'cancelled')}
                      disabled={busy}
                    >
                      <Text style={styles.ghostActionText}>Decline</Text>
                    </Pressable>
                  </View>
                ) : reservation.status === 'ready' ? (
                  <View style={styles.actionRow}>
                    <Pressable
                      style={[styles.primaryAction, busy && styles.actionDisabled]}
                      onPress={() => actReservation(reservation, 'collected')}
                      disabled={busy}
                    >
                      <Ionicons name="checkmark-done" size={16} color={colors.white} />
                      <Text style={styles.primaryActionText}>Mark collected</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </FadeInUp>
          );
        })}
      </>
    );
  };

  const renderActions = (booking: PharmacyBooking) => {
    const busy = busyId === booking.id;
    if (booking.status === 'pending') {
      return (
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.primaryAction, busy && styles.actionDisabled]}
            onPress={() => act(booking, 'accepted')}
            disabled={busy}
          >
            <Ionicons name="checkmark" size={16} color={colors.white} />
            <Text style={styles.primaryActionText}>Accept</Text>
          </Pressable>
          <Pressable
            style={[styles.ghostAction, busy && styles.actionDisabled]}
            onPress={() => act(booking, 'declined')}
            disabled={busy}
          >
            <Text style={styles.ghostActionText}>Decline</Text>
          </Pressable>
        </View>
      );
    }
    if (booking.status === 'accepted') {
      return (
        <>
          {booking.mode === 'home' ? (
            booking.patient_address ? (
              <View style={styles.addressBox}>
                <Ionicons name="location" size={15} color={colors.darkAccentGreen} />
                <Text style={styles.addressText}>{booking.patient_address}</Text>
              </View>
            ) : booking.address_requested_at ? (
              <View style={styles.addressWaitingRow}>
                <Ionicons name="time-outline" size={15} color={colors.textMuted} />
                <Text style={styles.addressWaitingText}>Waiting for the patient to send their address</Text>
              </View>
            ) : (
              <Pressable
                style={[styles.requestAddressButton, busy && styles.actionDisabled]}
                onPress={() => requestAddress(booking)}
                disabled={busy}
              >
                <Ionicons name="location-outline" size={15} color={colors.darkAccentGreen} />
                <Text style={styles.requestAddressText}>Request patient's address</Text>
              </Pressable>
            )
          ) : null}
          {booking.mode === 'walk_in' ? (
            booking.appointment_time ? (
              <View style={styles.addressBox}>
                <Ionicons name="calendar" size={15} color={colors.darkAccentGreen} />
                <Text style={styles.addressText}>
                  Appointment: {formatAppointment(booking.appointment_time)}
                </Text>
              </View>
            ) : (
              <Pressable
                style={[styles.requestAddressButton, busy && styles.actionDisabled]}
                onPress={() => {
                  setSchedulingError(null);
                  setSchedulingBooking(booking);
                }}
                disabled={busy}
              >
                <Ionicons name="calendar-outline" size={15} color={colors.darkAccentGreen} />
                <Text style={styles.requestAddressText}>Offer an appointment time</Text>
              </Pressable>
            )
          ) : null}
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.primaryAction, busy && styles.actionDisabled]}
              onPress={() => act(booking, 'completed')}
              disabled={busy}
            >
              <Ionicons name="checkmark-done" size={16} color={colors.white} />
              <Text style={styles.primaryActionText}>Mark as done</Text>
            </Pressable>
            <Pressable
              style={[styles.ghostAction, busy && styles.actionDisabled]}
              onPress={() => act(booking, 'declined')}
              disabled={busy}
            >
              <Text style={styles.ghostActionText}>Cancel</Text>
            </Pressable>
          </View>
        </>
      );
    }
    return null;
  };

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
        <Text style={styles.title}>Requests</Text>
        <Text style={styles.subtitle}>
          Respond to lab tests and medicine holds. Patients get a notification the moment you
          respond.
        </Text>

        {/* Section switch */}
        <View style={styles.segmentRow}>
          <Pressable
            style={[styles.segment, section === 'labs' && styles.segmentActive]}
            onPress={() => setSection('labs')}
          >
            <Text style={[styles.segmentText, section === 'labs' && styles.segmentTextActive]}>
              Lab tests{counts.pending > 0 ? ` (${counts.pending})` : ''}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segment, section === 'holds' && styles.segmentActive]}
            onPress={() => setSection('holds')}
          >
            <Text style={[styles.segmentText, section === 'holds' && styles.segmentTextActive]}>
              Medicine holds{pendingHolds > 0 ? ` (${pendingHolds})` : ''}
            </Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {loading ? (
          <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.loader} />
        ) : section === 'holds' ? (
          renderHolds()
        ) : (
          <>
            <View style={styles.chipsRow}>
              {FILTERS.map((f) => {
                const active = filter === f.key;
                const count = counts[f.key];
                return (
                  <Pressable
                    key={f.key}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setFilter(f.key)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {f.label}
                      {count > 0 ? ` ${count}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {visible.length === 0 ? (
          <View style={styles.emptyCard}>
            <BounceIn style={styles.emptyIcon}>
              <MaterialCommunityIcons name="test-tube-empty" size={26} color={colors.darkAccentGreen} />
            </BounceIn>
            <Text style={styles.emptyTitle}>
              {filter === 'pending' ? 'No new bookings' : 'Nothing here yet'}
            </Text>
            <Text style={styles.emptyBody}>
              {filter === 'pending'
                ? 'When a patient nearby books a lab test with you, it will appear here to accept.'
                : 'Bookings you have acted on will show up under their status.'}
            </Text>
          </View>
        ) : (
          visible.map((booking, index) => {
            const meta = STATUS_META[booking.status];
            return (
              <FadeInUp key={booking.id} index={index}>
                <View style={[styles.card, booking.id === highlightId && styles.cardHighlighted]}>
                  <View style={styles.cardTop}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {booking.patient_name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.cardTextColumn}>
                      <Text style={styles.patientName}>{booking.patient_name}</Text>
                      <Text style={styles.testName}>{labTestLabel(booking.test_type)}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.statusPillText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Ionicons
                        name={booking.mode === 'home' ? 'home-outline' : 'walk-outline'}
                        size={14}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.metaText}>
                        {booking.mode === 'home' ? 'Home collection' : 'Walk-in'}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                      <Text style={styles.metaText}>{timeAgo(booking.created_at)}</Text>
                    </View>
                  </View>

                  {renderActions(booking)}
                </View>
              </FadeInUp>
            );
          })
        )}
          </>
        )}
      </ScrollView>

      <SetAppointmentSheet
        visible={schedulingBooking != null}
        submitting={schedulingSubmitting}
        error={schedulingError}
        onSubmit={handleScheduleAppointment}
        onDismiss={() => setSchedulingBooking(null)}
      />
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
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 21,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textSecondary,
    marginTop: 6,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.pillGreenBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.pillGreenBorder,
    padding: 4,
    marginTop: 18,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 9,
  },
  segmentActive: {
    backgroundColor: colors.primaryGreen,
  },
  segmentText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.darkAccentGreen,
  },
  segmentTextActive: {
    color: colors.white,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
    marginBottom: 4,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: colors.pillGreenBg,
    borderWidth: 1,
    borderColor: colors.pillGreenBorder,
  },
  chipActive: {
    backgroundColor: colors.primaryGreen,
    borderColor: colors.primaryGreen,
  },
  chipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.darkAccentGreen,
  },
  chipTextActive: {
    color: colors.white,
  },
  errorText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.danger,
    marginTop: 14,
    textAlign: 'center',
  },
  loader: {
    marginTop: 60,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 28,
    marginTop: 24,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: 14,
  },
  emptyBody: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHighlighted: {
    borderColor: colors.primaryGreen,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    color: colors.darkAccentGreen,
  },
  cardTextColumn: {
    flex: 1,
  },
  patientName: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15.5,
    color: colors.textPrimary,
  },
  testName: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusPill: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.pillGreenBg,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  addressText: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.darkAccentGreen,
  },
  addressWaitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },
  addressWaitingText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textMuted,
  },
  requestAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.pillGreenBorder,
    backgroundColor: colors.pillGreenBg,
    borderRadius: 20,
    paddingVertical: 10,
    marginTop: 14,
  },
  requestAddressText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.darkAccentGreen,
  },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryGreen,
  },
  primaryActionText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.white,
  },
  ghostAction: {
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghostActionText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  actionDisabled: {
    opacity: 0.5,
  },
});
