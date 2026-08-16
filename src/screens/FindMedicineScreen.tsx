import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
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
import { successHaptic } from '../lib/haptics';
import { requestMedicineHold, reservationCode } from '../lib/medicineReservations';
import { searchMedicines, type MedicineSearchResult } from '../lib/pharmacyMedicines';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'FindMedicine'>;

function distanceLabel(km: number | null): string | null {
  if (km == null) return null;
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km.toFixed(1)} km away`;
}

export function FindMedicineScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MedicineSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [reservedCodes, setReservedCodes] = useState<Record<string, string>>({});
  const [reservingId, setReservingId] = useState<string | null>(null);
  const lastQuery = useRef('');

  const reserve = async (result: MedicineSearchResult) => {
    if (reservingId || reservedCodes[result.id]) return;
    setReservingId(result.id);
    const { id, error } = await requestMedicineHold(result.id);
    setReservingId(null);
    if (!error && id) {
      successHaptic();
      setReservedCodes((prev) => ({ ...prev, [result.id]: reservationCode(id) }));
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        }
      } catch {
        // Distance is a nice-to-have; search still works without it.
      }
    })();
  }, []);

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    lastQuery.current = q;
    setSearching(true);
    setHasSearched(true);
    const data = await searchMedicines(q, location);
    // Ignore a stale response if the user searched again in the meantime.
    if (lastQuery.current === q) {
      setResults(data);
      setSearching(false);
    }
  };

  const callPharmacy = (phone: string | null) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  const openDirections = (result: MedicineSearchResult) => {
    const { latitude, longitude, name, address } = result.pharmacy;
    let url: string;
    if (latitude != null && longitude != null) {
      url = Platform.select({
        ios: `http://maps.apple.com/?daddr=${latitude},${longitude}`,
        default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
      });
    } else {
      const q = encodeURIComponent(`${name} ${address ?? ''}`.trim());
      url = `https://www.google.com/maps/search/?api=1&query=${q}`;
    }
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <PatternBackground />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Find Medicine</Text>
        <Pressable onPress={() => navigation.navigate('MyMedicineHolds')} hitSlop={12}>
          <Ionicons name="receipt-outline" size={22} color={colors.darkAccentGreen} />
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search a medicine, e.g. Amoxicillin"
          placeholderTextColor={colors.inputPlaceholder}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={runSearch}
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <Pressable style={styles.searchButton} onPress={runSearch}>
        <Text style={styles.searchButtonText}>Search</Text>
      </Pressable>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {searching ? (
          <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.loader} />
        ) : !hasSearched ? (
          <View style={styles.hintCard}>
            <BounceIn style={styles.hintIcon}>
              <MaterialCommunityIcons name="pill" size={26} color={colors.darkAccentGreen} />
            </BounceIn>
            <Text style={styles.hintTitle}>Looking for a medicine?</Text>
            <Text style={styles.hintBody}>
              Type its name and we will show pharmacies near you that have it in stock, so you do not
              waste a trip.
            </Text>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.hintCard}>
            <BounceIn style={styles.hintIcon}>
              <Ionicons name="sad-outline" size={26} color={colors.darkAccentGreen} />
            </BounceIn>
            <Text style={styles.hintTitle}>No pharmacy has that in stock yet</Text>
            <Text style={styles.hintBody}>
              Try a different spelling or a shorter name. More pharmacies are joining and listing
              their medicines all the time.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.resultsCount}>
              {results.length} {results.length === 1 ? 'pharmacy has' : 'pharmacies have'} this
            </Text>
            {results.map((result, index) => (
              <FadeInUp key={result.id} index={index}>
                <View style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.cardTextColumn}>
                      <View style={styles.pharmacyNameRow}>
                        <Text style={styles.pharmacyName} numberOfLines={1}>
                          {result.pharmacy.name}
                        </Text>
                        {result.pharmacy.is_verified ? (
                          <MaterialCommunityIcons
                            name="check-decagram"
                            size={15}
                            color={colors.primaryGreen}
                          />
                        ) : null}
                      </View>
                      <Text style={styles.medicineLine}>
                        {result.name}
                        {result.form ? ` · ${result.form}` : ''}
                      </Text>
                    </View>
                    {result.price != null ? (
                      <View style={styles.pricePill}>
                        <Text style={styles.pricePillText}>₦{result.price.toLocaleString()}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.metaRow}>
                    {result.pharmacy.address ? (
                      <View style={styles.metaItem}>
                        <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                        <Text style={styles.metaText} numberOfLines={1}>
                          {result.pharmacy.address}
                        </Text>
                      </View>
                    ) : null}
                    {distanceLabel(result.distanceKm) ? (
                      <Text style={styles.distanceText}>{distanceLabel(result.distanceKm)}</Text>
                    ) : null}
                  </View>

                  {reservedCodes[result.id] ? (
                    <View style={styles.reservedRow}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.darkAccentGreen} />
                      <Text style={styles.reservedText}>
                        Reserved. Show code {reservedCodes[result.id]} at the counter.
                      </Text>
                    </View>
                  ) : (
                    <Pressable
                      style={[styles.reserveButton, reservingId === result.id && styles.actionDisabled]}
                      onPress={() => reserve(result)}
                      disabled={reservingId === result.id}
                    >
                      {reservingId === result.id ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <>
                          <Ionicons name="bookmark-outline" size={16} color={colors.white} />
                          <Text style={styles.reserveButtonText}>Ask them to hold this</Text>
                        </>
                      )}
                    </Pressable>
                  )}

                  <View style={styles.actionRow}>
                    <Pressable
                      style={[styles.action, !result.pharmacy.phone && styles.actionDisabled]}
                      onPress={() => callPharmacy(result.pharmacy.phone)}
                      disabled={!result.pharmacy.phone}
                    >
                      <Ionicons name="call-outline" size={16} color={colors.darkAccentGreen} />
                      <Text style={styles.actionText}>Call</Text>
                    </Pressable>
                    <Pressable style={styles.action} onPress={() => openDirections(result)}>
                      <Ionicons name="navigate-outline" size={16} color={colors.darkAccentGreen} />
                      <Text style={styles.actionText}>Directions</Text>
                    </Pressable>
                  </View>
                </View>
              </FadeInUp>
            ))}
            <Text style={styles.disclaimer}>
              Availability is set by each pharmacy and can change. It is worth a quick call before
              travelling far.
            </Text>
          </>
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 24,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.textPrimary,
  },
  searchButton: {
    marginHorizontal: 24,
    marginTop: 12,
    backgroundColor: colors.primaryGreen,
    borderRadius: 24,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.white,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
  },
  loader: {
    marginTop: 60,
  },
  hintCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 28,
    marginTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  hintIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: 14,
    textAlign: 'center',
  },
  hintBody: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  resultsCount: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardTextColumn: {
    flex: 1,
  },
  pharmacyNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pharmacyName: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15.5,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  medicineLine: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 3,
  },
  pricePill: {
    backgroundColor: colors.pillGreenBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pricePillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.darkAccentGreen,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  metaText: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  distanceText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.darkAccentGreen,
  },
  reserveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryGreen,
    marginTop: 14,
  },
  reserveButtonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.white,
  },
  reservedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.pillGreenBg,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  reservedText: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.darkAccentGreen,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.primaryGreen,
    backgroundColor: colors.pillGreenBg,
  },
  actionText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.darkAccentGreen,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  disclaimer: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    marginTop: 18,
    textAlign: 'center',
  },
});
