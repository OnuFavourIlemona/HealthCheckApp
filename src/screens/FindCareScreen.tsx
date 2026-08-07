import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useRoute, type RouteProp } from '@react-navigation/native';
import * as Location from 'expo-location';
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
import { PatternBackground } from '../components/ui/PatternBackground';
import { supabase } from '../lib/supabase';
import type { MainTabsParamList } from '../navigation/types';
import { colors, fonts } from '../theme';

type CareCategory = 'hospitals' | 'pharmacies';

type CarePlace = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: CareCategory;
  verified?: boolean;
  distanceKm?: number;
};

/** Hard limit: nothing further than this is shown, per product requirement. */
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

// Overpass rejects React Native's default okhttp User-Agent with HTTP 406,
// and its usage policy asks clients to identify themselves — so we must send
// an explicit app User-Agent. Mirrors are tried in order if one is down.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const USER_AGENT = 'HealthCheckApp/1.0 (healthcheck; contact: ilemonaonu9@gmail.com)';

/** Live nearby lookup from OpenStreetMap (Overpass API) — no API key needed. */
async function fetchNearby(
  amenity: 'hospital' | 'pharmacy',
  latitude: number,
  longitude: number,
): Promise<CarePlace[]> {
  const query = `[out:json][timeout:20];(
    node["amenity"="${amenity}"](around:${SEARCH_RADIUS_M},${latitude},${longitude});
    way["amenity"="${amenity}"](around:${SEARCH_RADIUS_M},${latitude},${longitude});
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
        name: el.tags?.name ?? (amenity === 'hospital' ? 'Hospital' : 'Pharmacy'),
        address: addressFromTags(el.tags),
        latitude: lat,
        longitude: lon,
        category: amenity === 'hospital' ? ('hospitals' as const) : ('pharmacies' as const),
      };
    })
    .filter((p): p is CarePlace => p !== null);
}

export function FindCareScreen() {
  const route = useRoute<RouteProp<MainTabsParamList, 'Find Care'>>();
  const [category, setCategory] = useState<CareCategory>(route.params?.category ?? 'hospitals');
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [searching, setSearching] = useState(true);
  const [liveHospitals, setLiveHospitals] = useState<CarePlace[]>([]);
  const [livePharmacies, setLivePharmacies] = useState<CarePlace[]>([]);
  const [dbPharmacies, setDbPharmacies] = useState<CarePlace[]>([]);
  const [lookupFailed, setLookupFailed] = useState(false);

  useEffect(() => {
    if (route.params?.category) setCategory(route.params.category);
  }, [route.params?.category]);

  // Registered pharmacies from our own database.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('pharmacies')
        .select('id, name, address, latitude, longitude, is_verified')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);
      if (!cancelled && data) {
        setDbPharmacies(
          data.map((p) => ({
            id: p.id,
            name: p.name,
            address: p.address ?? 'Address not provided',
            latitude: p.latitude as number,
            longitude: p.longitude as number,
            category: 'pharmacies' as const,
            verified: p.is_verified,
          })),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // User location, then live nearby search around it.
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
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setUserCoords(coords);

        const [hospitalsResult, pharmaciesResult] = await Promise.allSettled([
          fetchNearby('hospital', coords.latitude, coords.longitude),
          fetchNearby('pharmacy', coords.latitude, coords.longitude),
        ]);
        if (cancelled) return;
        if (hospitalsResult.status === 'fulfilled') setLiveHospitals(hospitalsResult.value);
        if (pharmaciesResult.status === 'fulfilled') setLivePharmacies(pharmaciesResult.value);
        if (hospitalsResult.status === 'rejected' && pharmaciesResult.status === 'rejected') {
          setLookupFailed(true);
        }
        setSearching(false);
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

  const pharmacies = [
    ...dbPharmacies,
    ...livePharmacies.filter(
      (osm) =>
        !dbPharmacies.some(
          (own) => haversineKm(own.latitude, own.longitude, osm.latitude, osm.longitude) < 0.05,
        ),
    ),
  ];

  // Only places within MAX_DISTANCE_KM of the user are ever shown.
  const places = userCoords
    ? (category === 'hospitals' ? liveHospitals : pharmacies)
        .map((place) => ({
          ...place,
          distanceKm: haversineKm(
            userCoords.latitude,
            userCoords.longitude,
            place.latitude,
            place.longitude,
          ),
        }))
        .filter((place) => place.distanceKm <= MAX_DISTANCE_KM)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, MAX_RESULTS)
    : [];

  const openDirections = (place: CarePlace) => {
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`,
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <PatternBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Find Care</Text>

        {/* Map preview */}
        <View style={styles.mapCard}>
          <NearbyMap userCoords={userCoords} places={places} />

          <View style={styles.countChip}>
            <Ionicons
              name={category === 'hospitals' ? 'medkit' : 'medical'}
              size={13}
              color={colors.white}
            />
            <Text style={styles.countChipText}>
              {searching
                ? 'Searching near you...'
                : `${places.length} within ${MAX_DISTANCE_KM} km`}
            </Text>
          </View>

          {permissionDenied ? (
            <View style={styles.mapOverlay}>
              <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
              <Text style={styles.mapOverlayText}>
                Turn on location to see care near you.
              </Text>
            </View>
          ) : null}
        </View>

        {/* Category toggle */}
        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggleButton, category === 'hospitals' && styles.toggleActive]}
            onPress={() => setCategory('hospitals')}
          >
            <MaterialIcons
              name="local-hospital"
              size={17}
              color={category === 'hospitals' ? colors.white : colors.textSecondary}
            />
            <Text style={[styles.toggleText, category === 'hospitals' && styles.toggleTextActive]}>
              Hospitals
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggleButton, category === 'pharmacies' && styles.toggleActive]}
            onPress={() => setCategory('pharmacies')}
          >
            <MaterialCommunityIcons
              name="pill"
              size={17}
              color={category === 'pharmacies' ? colors.white : colors.textSecondary}
            />
            <Text style={[styles.toggleText, category === 'pharmacies' && styles.toggleTextActive]}>
              Pharmacies
            </Text>
          </Pressable>
        </View>

        {searching ? (
          <View style={styles.searchingRow}>
            <ActivityIndicator size="small" color={colors.primaryGreen} />
            <Text style={styles.searchingText}>Finding {category} near you...</Text>
          </View>
        ) : permissionDenied ? (
          <View style={styles.emptyState}>
            <Ionicons name="location-outline" size={30} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              Location permission is needed to show hospitals and pharmacies near you.
            </Text>
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
                : `No ${category} found within ${MAX_DISTANCE_KM} km of you.`}
            </Text>
          </View>
        ) : (
          places.map((place) => (
            <View key={place.id} style={styles.card}>
              <View style={styles.cardIcon}>
                {place.category === 'hospitals' ? (
                  <MaterialIcons name="local-hospital" size={22} color={colors.darkAccentGreen} />
                ) : (
                  <MaterialCommunityIcons name="pill" size={22} color={colors.darkAccentGreen} />
                )}
              </View>
              <View style={styles.cardBody}>
                <View style={styles.nameRow}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {place.name}
                  </Text>
                  {place.verified ? (
                    <MaterialCommunityIcons
                      name="check-decagram"
                      size={16}
                      color={colors.primaryGreen}
                    />
                  ) : null}
                </View>
                <Text style={styles.cardAddress} numberOfLines={1}>
                  {place.address}
                </Text>
                <Text style={styles.cardDistance}>{place.distanceKm.toFixed(1)} km away</Text>
              </View>
              <Pressable style={styles.directionsButton} onPress={() => openDirections(place)}>
                <MaterialCommunityIcons name="directions" size={20} color={colors.white} />
              </Pressable>
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
  screenTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  mapCard: {
    height: 280,
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 14,
    backgroundColor: '#EEF2F0',
    borderWidth: 1,
    borderColor: colors.border,
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
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  toggleActive: {
    backgroundColor: colors.primaryGreen,
    borderColor: colors.primaryGreen,
  },
  toggleText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.white,
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
    flexDirection: 'row',
    alignItems: 'center',
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
    marginRight: 10,
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
  directionsButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primaryGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
