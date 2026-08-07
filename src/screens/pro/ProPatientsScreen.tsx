import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BounceIn } from '../../components/ui/BounceIn';
import { PatternBackground } from '../../components/ui/PatternBackground';
import type { Consultation } from '../../lib/consultations';
import { supabase } from '../../lib/supabase';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts } from '../../theme';

function initialsOf(name: string | null): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function relativeDay(iso: string): string {
  const then = new Date(iso);
  const today = new Date();
  then.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - then.getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} wk ago`;
  return new Date(iso).toLocaleDateString();
}

export function ProPatientsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [query, setQuery] = useState('');
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('consultations')
      .select('*')
      .eq('professional_id', userId)
      .order('created_at', { ascending: false });
    setConsultations((data ?? []) as Consultation[]);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const visible = consultations.filter(
    (c) =>
      query.trim() === '' ||
      (c.patient_name ?? '').toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <PatternBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Patients</Text>

        {consultations.length > 0 ? (
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search patients..."
              placeholderTextColor={colors.inputPlaceholder}
              value={query}
              onChangeText={setQuery}
            />
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.loader} />
        ) : consultations.length === 0 ? (
          <View style={styles.emptyState}>
            <BounceIn style={styles.emptyIcon}>
              <Ionicons name="people-outline" size={32} color={colors.primaryGreen} />
            </BounceIn>
            <Text style={styles.emptyTitle}>No patients yet</Text>
            <Text style={styles.emptyBody}>
              Patients you accept from the dashboard will appear here.
            </Text>
          </View>
        ) : (
          visible.map((consultation) => (
            <Pressable
              key={consultation.id}
              style={styles.card}
              onPress={() =>
                navigation.navigate('ProConnect', { consultationId: consultation.id })
              }
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initialsOf(consultation.patient_name)}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.name}>{consultation.patient_name ?? 'Patient'}</Text>
                {consultation.patient_age ? (
                  <Text style={styles.demographic}>
                    {consultation.patient_gender
                      ? `${consultation.patient_gender}, ${consultation.patient_age}`
                      : `Age ${consultation.patient_age}`}
                  </Text>
                ) : null}
                <Text style={styles.condition} numberOfLines={1}>
                  {consultation.symptoms ?? 'No symptoms recorded'}
                </Text>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.lastSeen}>{relativeDay(consultation.created_at)}</Text>
                <View
                  style={[
                    styles.statusPill,
                    consultation.status === 'active' ? styles.statusActive : styles.statusDone,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      consultation.status === 'active'
                        ? styles.statusTextActive
                        : styles.statusTextDone,
                    ]}
                  >
                    {consultation.status}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))
        )}

        {!loading && consultations.length > 0 && visible.length === 0 ? (
          <Text style={styles.noResults}>No patients match "{query}".</Text>
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
    flexGrow: 1,
  },
  screenTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 46,
    marginTop: 14,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  loader: {
    marginTop: 60,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingBottom: 60,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
    marginTop: 16,
  },
  emptyBody: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.darkAccentGreen,
  },
  cardBody: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  name: {
    fontFamily: fonts.headingMedium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  demographic: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 1,
    textTransform: 'capitalize',
  },
  condition: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 3,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  lastSeen: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textMuted,
  },
  statusPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusActive: {
    backgroundColor: colors.pillGreenBg,
  },
  statusDone: {
    backgroundColor: '#EFEFEF',
  },
  statusText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    textTransform: 'capitalize',
  },
  statusTextActive: {
    color: colors.darkAccentGreen,
  },
  statusTextDone: {
    color: colors.textSecondary,
  },
  noResults: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 32,
  },
});
