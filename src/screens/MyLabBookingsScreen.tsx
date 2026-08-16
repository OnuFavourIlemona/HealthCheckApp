import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BounceIn } from '../components/ui/BounceIn';
import { FadeInUp } from '../components/ui/FadeInUp';
import { PatternBackground } from '../components/ui/PatternBackground';
import { labTestLabel } from '../lib/pharmacyBookings';
import {
  disableBookingReminder,
  enableBookingReminder,
  fetchMyLabBookings,
  submitBookingAddress,
  type MyLabBooking,
} from '../lib/myLabBookings';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'MyLabBookings'>;

/** Puts the booking a notification pointed to first, so it's visible without scrolling to find it. */
function withHighlightedFirst(bookings: MyLabBooking[], highlightId: string | undefined): MyLabBooking[] {
  if (!highlightId) return bookings;
  const target = bookings.find((b) => b.id === highlightId);
  if (!target) return bookings;
  return [target, ...bookings.filter((b) => b.id !== highlightId)];
}

const STATUS_META: Record<MyLabBooking['status'], { label: string; bg: string; color: string }> = {
  pending: { label: 'Pending', bg: '#FFF4E0', color: '#C77B00' },
  accepted: { label: 'Accepted', bg: colors.pillGreenBg, color: colors.darkAccentGreen },
  completed: { label: 'Done', bg: colors.pillGreenBg, color: colors.darkAccentGreen },
  declined: { label: 'Declined', bg: '#FDEBE4', color: colors.danger },
};

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
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

export function MyLabBookingsScreen({ navigation, route }: Props) {
  const highlightId = route.params?.bookingId;
  const [bookings, setBookings] = useState<MyLabBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [addressDrafts, setAddressDrafts] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reminderBusyId, setReminderBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBookings(withHighlightedFirst(await fetchMyLabBookings(), highlightId));
    setLoading(false);
  }, [highlightId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openDirections = (booking: MyLabBooking) => {
    if (booking.pharmacy_latitude == null || booking.pharmacy_longitude == null) return;
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${booking.pharmacy_latitude},${booking.pharmacy_longitude}`,
    );
  };

  const handleSubmitAddress = async (booking: MyLabBooking) => {
    const address = (addressDrafts[booking.id] ?? '').trim();
    if (!address || submittingId) return;
    setSubmittingId(booking.id);
    setError(null);
    const { ok, error: err } = await submitBookingAddress(booking.id, address);
    setSubmittingId(null);
    if (!ok) {
      setError(err ?? 'Could not send your address. Please try again.');
      return;
    }
    setBookings((prev) =>
      prev.map((b) => (b.id === booking.id ? { ...b, patient_address: address } : b)),
    );
  };

  const handleToggleReminder = async (booking: MyLabBooking) => {
    if (reminderBusyId) return;
    setReminderBusyId(booking.id);
    setError(null);
    const result = booking.reminder_notification_id
      ? await disableBookingReminder(booking)
      : await enableBookingReminder(booking);
    setReminderBusyId(null);
    if (!result.ok) {
      setError(result.error ?? 'Could not update your reminder. Please try again.');
      return;
    }
    void load();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <PatternBackground />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>My Lab Bookings</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.loader} />
      ) : bookings.length === 0 ? (
        <View style={styles.emptyState}>
          <BounceIn style={styles.emptyIcon}>
            <MaterialCommunityIcons name="test-tube-empty" size={28} color={colors.primaryGreen} />
          </BounceIn>
          <Text style={styles.emptyTitle}>No lab bookings yet</Text>
          <Text style={styles.emptyBody}>
            Book a test with a nearby pharmacy and track it here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {bookings.map((booking, index) => {
            const meta = STATUS_META[booking.status];
            const needsAddress =
              booking.mode === 'home' &&
              booking.status === 'accepted' &&
              booking.address_requested_at &&
              !booking.patient_address;
            return (
              <FadeInUp key={booking.id} index={index}>
                <View style={[styles.card, booking.id === highlightId && styles.cardHighlighted]}>
                  <View style={styles.cardTop}>
                    <View style={styles.cardIcon}>
                      <MaterialCommunityIcons name="test-tube" size={20} color={colors.darkAccentGreen} />
                    </View>
                    <View style={styles.cardTextColumn}>
                      <Text style={styles.pharmacyName}>{booking.pharmacy_name}</Text>
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

                  {/* Walk-in: show where the pharmacy actually is, once they've accepted. */}
                  {booking.mode === 'walk_in' &&
                  (booking.status === 'accepted' || booking.status === 'completed') ? (
                    <View style={styles.addressBox}>
                      <Ionicons name="location" size={15} color={colors.darkAccentGreen} />
                      <View style={styles.addressTextColumn}>
                        <Text style={styles.addressText}>
                          {booking.pharmacy_address ?? 'Address not provided'}
                        </Text>
                        {booking.pharmacy_latitude != null ? (
                          <Pressable onPress={() => openDirections(booking)} hitSlop={6}>
                            <Text style={styles.directionsLink}>Get directions</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  ) : null}

                  {/* Walk-in: the slot the pharmacist offered, plus an optional reminder. */}
                  {booking.mode === 'walk_in' && booking.status === 'accepted' && booking.appointment_time ? (
                    <View style={styles.confirmedBox}>
                      <Ionicons name="calendar" size={15} color={colors.darkAccentGreen} />
                      <View style={styles.addressTextColumn}>
                        <Text style={styles.confirmedText}>
                          Your appointment: {formatAppointment(booking.appointment_time)}
                        </Text>
                        <Pressable
                          style={styles.reminderButton}
                          onPress={() => handleToggleReminder(booking)}
                          disabled={reminderBusyId === booking.id}
                        >
                          {reminderBusyId === booking.id ? (
                            <ActivityIndicator size="small" color={colors.darkAccentGreen} />
                          ) : (
                            <>
                              <Ionicons
                                name={booking.reminder_notification_id ? 'notifications' : 'notifications-outline'}
                                size={14}
                                color={colors.darkAccentGreen}
                              />
                              <Text style={styles.reminderButtonText}>
                                {booking.reminder_notification_id ? 'Reminder on' : 'Remind me'}
                              </Text>
                            </>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  ) : null}

                  {/* Home collection: waiting, ask, or confirmed states. */}
                  {booking.mode === 'home' && booking.status === 'accepted' ? (
                    booking.patient_address ? (
                      <View style={styles.confirmedBox}>
                        <Ionicons name="checkmark-circle" size={15} color={colors.darkAccentGreen} />
                        <Text style={styles.confirmedText}>
                          Your address has been sent to the pharmacy.
                        </Text>
                      </View>
                    ) : needsAddress ? (
                      <View style={styles.addressForm}>
                        <Text style={styles.addressFormLabel}>
                          {booking.pharmacy_name} needs your address to come collect your sample.
                        </Text>
                        <TextInput
                          style={styles.addressInput}
                          placeholder="e.g. 12 Adeola Street, Ikeja, Lagos"
                          placeholderTextColor={colors.inputPlaceholder}
                          value={addressDrafts[booking.id] ?? ''}
                          onChangeText={(v) => setAddressDrafts((prev) => ({ ...prev, [booking.id]: v }))}
                          multiline
                        />
                        {submittingId === booking.id ? (
                          <ActivityIndicator size="small" color={colors.primaryGreen} style={styles.addressSpinner} />
                        ) : (
                          <Pressable
                            style={[
                              styles.addressSubmitButton,
                              !(addressDrafts[booking.id] ?? '').trim() && styles.addressSubmitDisabled,
                            ]}
                            onPress={() => handleSubmitAddress(booking)}
                            disabled={!(addressDrafts[booking.id] ?? '').trim()}
                          >
                            <Text style={styles.addressSubmitText}>Send Address</Text>
                          </Pressable>
                        )}
                      </View>
                    ) : (
                      <View style={styles.addressWaitingRow}>
                        <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                        <Text style={styles.addressWaitingText}>
                          Confirmed. The pharmacy will ask for your address when ready to collect.
                        </Text>
                      </View>
                    )
                  ) : null}
                </View>
              </FadeInUp>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
  },
  loader: { marginTop: 80 },
  content: { paddingHorizontal: 24, paddingBottom: 32 },
  errorText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextColumn: { flex: 1 },
  pharmacyName: {
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
  addressBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.pillGreenBg,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  addressTextColumn: {
    flex: 1,
  },
  addressText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.darkAccentGreen,
  },
  directionsLink: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.primaryGreen,
    marginTop: 4,
  },
  confirmedBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.pillGreenBg,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  confirmedText: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.darkAccentGreen,
  },
  reminderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  reminderButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.darkAccentGreen,
  },
  addressWaitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },
  addressWaitingText: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.textMuted,
  },
  addressForm: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addressFormLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  addressInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    color: colors.textPrimary,
    minHeight: 56,
  },
  addressSpinner: {
    marginTop: 10,
  },
  addressSubmitButton: {
    backgroundColor: colors.primaryGreen,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  addressSubmitDisabled: {
    opacity: 0.4,
  },
  addressSubmitText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.white,
  },
});
