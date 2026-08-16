import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NearbyMap } from '../components/NearbyMap';
import { FadeInUp } from '../components/ui/FadeInUp';
import { PatternBackground } from '../components/ui/PatternBackground';
import { Tappable } from '../components/ui/Tappable';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'BookLabTest'>;

type LabPlace = {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  latitude: number;
  longitude: number;
  inNetwork: boolean;
  pharmacyId?: string;
  verified?: boolean;
  distanceKm?: number;
  /** Owner-set prices only — never a generic/estimated figure. Absent key means no price given. */
  testPrices?: Record<string, number> | null;
};

const BOOKABLE_TEST_TYPES: { key: string; label: string }[] = [
  { key: 'blood_sugar', label: 'Blood Sugar (Fasting)' },
  { key: 'full_blood_count', label: 'Full Blood Count' },
  { key: 'lipid_panel', label: 'Lipid Panel' },
  { key: 'malaria_typhoid', label: 'Malaria + Typhoid' },
  { key: 'blood_pressure', label: 'Blood Pressure Check' },
  { key: 'kidney_function', label: 'Kidney Function' },
];

const MAX_DISTANCE_KM = 50;
const SEARCH_RADIUS_M = MAX_DISTANCE_KM * 1000;
const MAX_RESULTS = 30;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type OverpassElement = {
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function addressFromTags(tags: Record<string, string> | undefined): string {
  if (!tags) return 'Address unavailable';
  if (tags['addr:full']) return tags['addr:full'];
  const parts = [
    tags['addr:housenumber'] && tags['addr:street']
      ? `${tags['addr:housenumber']} ${tags['addr:street']}`
      : tags['addr:street'],
    tags['addr:suburb'],
    tags['addr:city'],
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'Address unavailable';
}

// Same Overpass mirrors/User-Agent as FindCareScreen — see that file for why.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const USER_AGENT = 'HealthCheckApp/1.0 (healthcheck; contact: ilemonaonu9@gmail.com)';

/**
 * Live nearby diagnostic labs from OpenStreetMap. Uses the `healthcare=laboratory`
 * tag — coverage in Nigeria is sparser than for hospitals/pharmacies, since fewer
 * labs are mapped, so results may be thin in some areas. That's a real limitation,
 * not a bug — combined with in-network pharmacies below to fill the gap somewhat.
 */
async function fetchNearbyLabs(latitude: number, longitude: number): Promise<LabPlace[]> {
  const query = `[out:json][timeout:20];(
    node["healthcare"="laboratory"](around:${SEARCH_RADIUS_M},${latitude},${longitude});
    way["healthcare"="laboratory"](around:${SEARCH_RADIUS_M},${latitude},${longitude});
  );out center 120;`;

  let lastError: unknown = null;
  let json: { elements: OverpassElement[] } | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!response.ok) throw new Error(`Overpass ${response.status}`);
      json = (await response.json()) as { elements: OverpassElement[] };
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!json) throw lastError ?? new Error('Overpass unavailable');

  return json.elements
    .map((el) => {
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat == null || lon == null) return null;
      return {
        id: `osm-${el.id}`,
        name: el.tags?.name ?? 'Diagnostic Laboratory',
        address: addressFromTags(el.tags),
        phone: el.tags?.phone ?? el.tags?.['contact:phone'] ?? null,
        latitude: lat,
        longitude: lon,
        inNetwork: false,
      };
    })
    .filter((p): p is LabPlace => p !== null);
}

export function BookLabTestScreen({ navigation }: Props) {
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [searching, setSearching] = useState(true);
  const [liveLabs, setLiveLabs] = useState<LabPlace[]>([]);
  const [dbLabs, setDbLabs] = useState<LabPlace[]>([]);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [mapInteracting, setMapInteracting] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedTestKey, setSelectedTestKey] = useState<string | null>(null);
  const [mode, setMode] = useState<'home' | 'walk_in' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookedId, setBookedId] = useState<string | null>(null);

  // In-network pharmacies that opted into offering lab tests — the only
  // results where "Book" is real, since it lands in that pharmacy's own dashboard.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('pharmacies')
        .select('id, name, address, phone, latitude, longitude, is_verified, lab_test_prices')
        .eq('offers_lab_tests', true)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);
      if (!cancelled && data) {
        setDbLabs(
          data.map((p) => ({
            id: `db-${p.id}`,
            name: p.name,
            address: p.address ?? 'Address not provided',
            phone: p.phone ?? null,
            latitude: p.latitude as number,
            longitude: p.longitude as number,
            inNetwork: true,
            pharmacyId: p.id,
            verified: p.is_verified,
            testPrices: (p.lab_test_prices as Record<string, number> | null) ?? null,
          })),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) {
            setPermissionDenied(true);
            setSearching(false);
          }
          return;
        }
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setUserCoords(coords);

        try {
          const labs = await fetchNearbyLabs(coords.latitude, coords.longitude);
          if (!cancelled) setLiveLabs(labs);
        } catch {
          if (!cancelled) setLookupFailed(true);
        }
        if (!cancelled) setSearching(false);
      } catch {
        if (!cancelled) {
          setPermissionDenied(true);
          setSearching(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const merged = [
    ...dbLabs,
    ...liveLabs.filter(
      (osm) =>
        !dbLabs.some((own) => haversineKm(own.latitude, own.longitude, osm.latitude, osm.longitude) < 0.05),
    ),
  ];

  const places = userCoords
    ? merged
        .map((place) => ({
          ...place,
          distanceKm: haversineKm(userCoords.latitude, userCoords.longitude, place.latitude, place.longitude),
        }))
        .filter((place) => place.distanceKm <= MAX_DISTANCE_KM)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, MAX_RESULTS)
    : [];

  const openDirections = (place: LabPlace) => {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`);
  };

  const callLab = (phone: string) => {
    Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`);
  };

  // OpenStreetMap is less complete in Nigeria than Google, so let users
  // cross-check the same lab search on Google Maps.
  const openGoogleMapsSearch = () => {
    const near = userCoords ? `${userCoords.latitude},${userCoords.longitude}` : 'me';
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`medical laboratory near ${near}`)}`,
    );
  };

  const toggleBooking = (place: LabPlace) => {
    setBookingError(null);
    if (expandedId === place.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(place.id);
    setSelectedTestKey(null);
    setMode(null);
  };

  const confirmBooking = async (place: LabPlace) => {
    if (submitting || !selectedTestKey || !mode || !place.pharmacyId) return;
    setBookingError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setBookingError('You must be signed in to book a test.');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('lab_bookings').insert({
      patient_id: userId,
      pharmacy_id: place.pharmacyId,
      provider_name: place.name,
      test_type: selectedTestKey,
      mode,
    });
    setSubmitting(false);

    if (error) {
      setBookingError(error.message);
      return;
    }
    setBookedId(place.id);
    setExpandedId(null);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <PatternBackground />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Find a Lab</Text>
        <Pressable onPress={() => navigation.navigate('MyLabBookings')} hitSlop={12}>
          <Ionicons name="receipt-outline" size={22} color={colors.darkAccentGreen} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!mapInteracting}
      >
        <Text style={styles.sectionHint}>
          Search nearby diagnostic labs and pharmacies that offer lab tests. Call ahead to confirm,
          or get directions and visit in person. A few pharmacies also let you book a test right
          here in the app.
        </Text>

        <View
          style={styles.mapCard}
          onTouchStart={() => setMapInteracting(true)}
          onTouchEnd={() => setMapInteracting(false)}
          onTouchCancel={() => setMapInteracting(false)}
        >
          <NearbyMap
            userCoords={userCoords}
            places={places.map((p) => ({ ...p, category: 'labs' as const }))}
          />
          <View style={styles.countChip}>
            <MaterialCommunityIcons name="test-tube" size={13} color={colors.white} />
            <Text style={styles.countChipText}>
              {searching ? 'Searching near you...' : `${places.length} within ${MAX_DISTANCE_KM} km`}
            </Text>
          </View>
          {permissionDenied ? (
            <View style={styles.mapOverlay}>
              <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
              <Text style={styles.mapOverlayText}>Turn on location to see labs near you.</Text>
            </View>
          ) : null}
        </View>

        <Pressable style={styles.googleMapsButton} onPress={openGoogleMapsSearch}>
          <MaterialCommunityIcons name="google-maps" size={17} color={colors.darkAccentGreen} />
          <Text style={styles.googleMapsButtonText}>Not seeing a lab? Search on Google Maps</Text>
          <Ionicons name="open-outline" size={15} color={colors.textMuted} />
        </Pressable>

        {searching ? (
          <View style={styles.searchingRow}>
            <ActivityIndicator size="small" color={colors.primaryGreen} />
            <Text style={styles.searchingText}>Finding labs near you...</Text>
          </View>
        ) : permissionDenied ? (
          <View style={styles.emptyState}>
            <Ionicons name="location-outline" size={30} color={colors.textMuted} />
            <Text style={styles.emptyText}>Location permission is needed to show labs near you.</Text>
            <Pressable style={styles.settingsButton} onPress={() => Linking.openSettings()}>
              <Text style={styles.settingsButtonText}>Open Settings</Text>
            </Pressable>
          </View>
        ) : places.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="map-search-outline" size={30} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              {lookupFailed
                ? 'Could not reach the map service. Check your connection and try again.'
                : `No labs found within ${MAX_DISTANCE_KM} km of you.`}
            </Text>
          </View>
        ) : (
          places.map((place, index) => {
            const expanded = expandedId === place.id;
            const justBooked = bookedId === place.id;
            return (
              <FadeInUp key={place.id} index={index}>
                <View style={styles.card}>
                  <View style={styles.cardRow}>
                    <View style={styles.cardIcon}>
                      <MaterialCommunityIcons name="test-tube" size={20} color={colors.darkAccentGreen} />
                    </View>
                    <View style={styles.cardBody}>
                      <View style={styles.nameRow}>
                        <Text style={styles.cardName} numberOfLines={1}>
                          {place.name}
                        </Text>
                        {place.verified ? (
                          <MaterialCommunityIcons name="check-decagram" size={15} color={colors.primaryGreen} />
                        ) : null}
                      </View>
                      <Text style={styles.cardAddress} numberOfLines={2}>
                        {place.address}
                      </Text>
                      {place.distanceKm != null ? (
                        <Text style={styles.cardDistance}>{place.distanceKm.toFixed(1)} km away</Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.actionsRow}>
                    {place.phone ? (
                      <Tappable style={styles.actionButton} onPress={() => callLab(place.phone as string)}>
                        <Ionicons name="call-outline" size={16} color={colors.darkAccentGreen} />
                        <Text style={styles.actionButtonText}>Call</Text>
                      </Tappable>
                    ) : null}
                    <Tappable style={styles.actionButton} onPress={() => openDirections(place)}>
                      <MaterialCommunityIcons name="directions" size={17} color={colors.darkAccentGreen} />
                      <Text style={styles.actionButtonText}>Directions</Text>
                    </Tappable>
                    {place.inNetwork ? (
                      <Tappable
                        style={[styles.actionButton, styles.bookButton]}
                        onPress={() => toggleBooking(place)}
                      >
                        <Ionicons name="calendar-outline" size={16} color={colors.white} />
                        <Text style={styles.bookButtonText}>{expanded ? 'Cancel' : 'Book'}</Text>
                      </Tappable>
                    ) : null}
                  </View>

                  {justBooked ? (
                    <View style={styles.bookedRow}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.primaryGreen} />
                      <Text style={styles.bookedText}>
                        Booking sent. {place.name} will confirm shortly.
                      </Text>
                    </View>
                  ) : null}

                  {expanded ? (
                    <View style={styles.bookingPanel}>
                      <Text style={styles.bookingPanelLabel}>Which test?</Text>
                      <View style={styles.chipsWrap}>
                        {BOOKABLE_TEST_TYPES.map((test) => {
                          const price = place.testPrices?.[test.key];
                          return (
                            <Pressable
                              key={test.key}
                              style={[styles.chip, selectedTestKey === test.key && styles.chipActive]}
                              onPress={() => setSelectedTestKey(test.key)}
                            >
                              <Text
                                style={[
                                  styles.chipText,
                                  selectedTestKey === test.key && styles.chipTextActive,
                                ]}
                              >
                                {test.label}
                                {price ? ` (₦${price.toLocaleString('en-NG')})` : ''}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      <Text style={styles.bookingPanelLabel}>How?</Text>
                      <View style={styles.chipsWrap}>
                        <Pressable
                          style={[styles.chip, mode === 'home' && styles.chipActive]}
                          onPress={() => setMode('home')}
                        >
                          <Text style={[styles.chipText, mode === 'home' && styles.chipTextActive]}>
                            Home collection
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[styles.chip, mode === 'walk_in' && styles.chipActive]}
                          onPress={() => setMode('walk_in')}
                        >
                          <Text style={[styles.chipText, mode === 'walk_in' && styles.chipTextActive]}>
                            Walk in
                          </Text>
                        </Pressable>
                      </View>

                      {bookingError ? <Text style={styles.bookingError}>{bookingError}</Text> : null}

                      {submitting ? (
                        <ActivityIndicator size="small" color={colors.primaryGreen} style={styles.bookingSpinner} />
                      ) : (
                        <Tappable
                          style={[
                            styles.confirmButton,
                            (!selectedTestKey || !mode) && styles.confirmButtonDisabled,
                          ]}
                          onPress={() => confirmBooking(place)}
                        >
                          <Text style={styles.confirmButtonText}>Confirm Booking</Text>
                        </Tappable>
                      )}
                    </View>
                  ) : null}
                </View>
              </FadeInUp>
            );
          })
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
  content: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  sectionHint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textSecondary,
    marginBottom: 14,
  },
  mapCard: {
    height: 240,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#EEF2F0',
    borderWidth: 1,
    borderColor: colors.border,
  },
  googleMapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  googleMapsButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.darkAccentGreen,
  },
  countChip: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(14,143,47,0.92)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  countChipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.white,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mapOverlayText: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  searchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
  },
  searchingText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    gap: 10,
    marginTop: 36,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  settingsButton: {
    borderWidth: 1,
    borderColor: colors.primaryGreen,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 9,
    marginTop: 4,
  },
  settingsButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.darkAccentGreen,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardName: {
    fontFamily: fonts.headingMedium,
    fontSize: 15,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  cardAddress: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardDistance: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.darkAccentGreen,
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  actionButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.darkAccentGreen,
  },
  bookButton: {
    backgroundColor: colors.primaryGreen,
    borderColor: colors.primaryGreen,
  },
  bookButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.white,
  },
  bookedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  bookedText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.primaryGreen,
    flexShrink: 1,
  },
  bookingPanel: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bookingPanelLabel: {
    fontFamily: fonts.headingMedium,
    fontSize: 13,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: colors.primaryGreen,
    borderColor: colors.primaryGreen,
  },
  chipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.white,
  },
  bookingError: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.danger,
    marginBottom: 8,
  },
  bookingSpinner: {
    marginTop: 4,
  },
  confirmButton: {
    backgroundColor: colors.primaryGreen,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.4,
  },
  confirmButtonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.white,
  },
});
