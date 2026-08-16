import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BounceIn } from '../components/ui/BounceIn';
import { FadeInUp } from '../components/ui/FadeInUp';
import { PatternBackground } from '../components/ui/PatternBackground';
import {
  fetchMyMedicineReservations,
  reservationCode,
  type MyMedicineReservation,
  type ReservationStatus,
} from '../lib/medicineReservations';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'MyMedicineHolds'>;

const STATUS_META: Record<ReservationStatus, { label: string; bg: string; color: string }> = {
  pending: { label: 'Requested', bg: '#FFF4E0', color: '#C77B00' },
  ready: { label: 'Ready for pickup', bg: colors.pillGreenBg, color: colors.darkAccentGreen },
  collected: { label: 'Collected', bg: colors.pillGreenBg, color: colors.darkAccentGreen },
  cancelled: { label: 'Cancelled', bg: '#FDEBE4', color: colors.danger },
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

/** Puts the reservation a notification pointed to first, so it's visible without scrolling to find it. */
function withHighlightedFirst(
  reservations: MyMedicineReservation[],
  highlightId: string | undefined,
): MyMedicineReservation[] {
  if (!highlightId) return reservations;
  const target = reservations.find((r) => r.id === highlightId);
  if (!target) return reservations;
  return [target, ...reservations.filter((r) => r.id !== highlightId)];
}

export function MyMedicineHoldsScreen({ navigation, route }: Props) {
  const highlightId = route.params?.reservationId;
  const [reservations, setReservations] = useState<MyMedicineReservation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setReservations(withHighlightedFirst(await fetchMyMedicineReservations(), highlightId));
    setLoading(false);
  }, [highlightId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const callPharmacy = (phone: string) => {
    Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <PatternBackground />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>My Medicine Holds</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.loader} />
      ) : reservations.length === 0 ? (
        <View style={styles.emptyState}>
          <BounceIn style={styles.emptyIcon}>
            <MaterialCommunityIcons name="pill" size={28} color={colors.primaryGreen} />
          </BounceIn>
          <Text style={styles.emptyTitle}>No medicine holds yet</Text>
          <Text style={styles.emptyBody}>
            Ask a pharmacy to hold a medicine for you and track it here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {reservations.map((reservation, index) => {
            const meta = STATUS_META[reservation.status];
            return (
              <FadeInUp key={reservation.id} index={index}>
                <View style={[styles.card, reservation.id === highlightId && styles.cardHighlighted]}>
                  <View style={styles.cardTop}>
                    <View style={styles.cardIcon}>
                      <MaterialCommunityIcons name="pill" size={20} color={colors.darkAccentGreen} />
                    </View>
                    <View style={styles.cardTextColumn}>
                      <Text style={styles.pharmacyName}>{reservation.pharmacy_name}</Text>
                      <Text style={styles.medicineName}>{reservation.medicine_name}</Text>
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

                  {reservation.status === 'ready' ? (
                    <View style={styles.readyBox}>
                      <Ionicons name="checkmark-circle" size={15} color={colors.darkAccentGreen} />
                      <View style={styles.readyTextColumn}>
                        <Text style={styles.readyText}>
                          Show code {reservationCode(reservation.id)} at the counter to collect it.
                        </Text>
                        {reservation.pharmacy_address ? (
                          <Text style={styles.readyAddress}>{reservation.pharmacy_address}</Text>
                        ) : null}
                        {reservation.pharmacy_phone ? (
                          <Pressable onPress={() => callPharmacy(reservation.pharmacy_phone as string)} hitSlop={6}>
                            <Text style={styles.callLink}>Call the pharmacy</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
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
  medicineName: {
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
  readyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.pillGreenBg,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  readyTextColumn: {
    flex: 1,
  },
  readyText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.darkAccentGreen,
  },
  readyAddress: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.darkAccentGreen,
    marginTop: 4,
  },
  callLink: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.primaryGreen,
    marginTop: 4,
  },
});
