import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BounceIn } from '../components/ui/BounceIn';
import { FadeInUp } from '../components/ui/FadeInUp';
import { SkeletonList } from '../components/ui/Skeleton';
import { PatternBackground } from '../components/ui/PatternBackground';
import { Tappable } from '../components/ui/Tappable';
import { subscribeToPendingRequests, type Consultation } from '../lib/consultations';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';

const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#FFF4E0', text: '#C77B00' },
  active: { bg: '#E5F5E8', text: '#0E8F2F' },
  completed: { bg: '#EFEFEF', text: '#6B7280' },
  cancelled: { bg: '#FDE8E8', text: '#D64545' },
};

export function MessagesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(true);
  const [consultations, setConsultations] = useState<Consultation[]>([]);

  const load = useCallback(async () => {
    // RLS scopes this to consultations the signed-in user participates in.
    const { data } = await supabase
      .from('consultations')
      .select('*')
      .order('created_at', { ascending: false });
    setConsultations((data ?? []) as Consultation[]);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // A practitioner accepting a request flips it to active here in real time.
  useEffect(() => subscribeToPendingRequests(load), [load]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <PatternBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Messages</Text>

        {loading ? (
          <SkeletonList count={4} />
        ) : consultations.length === 0 ? (
          <View style={styles.emptyState}>
            <BounceIn style={styles.emptyIcon}>
              <Ionicons name="chatbubbles-outline" size={34} color={colors.primaryGreen} />
            </BounceIn>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptyBody}>
              Request a consultation and your chats with verified practitioners will appear here.
            </Text>
            <Pressable
              style={styles.requestButton}
              onPress={() => navigation.navigate('RequestConsultation')}
            >
              <Text style={styles.requestButtonText}>Talk to a Doctor</Text>
            </Pressable>
          </View>
        ) : (
          consultations.map((consultation, index) => {
            const badge = statusColors[consultation.status] ?? statusColors.completed;
            const isPending = consultation.status === 'pending';
            return (
              <FadeInUp key={consultation.id} index={index}>
                <Tappable
                  style={[styles.card, isPending && styles.cardPending]}
                  disabled={isPending}
                  onPress={() =>
                    navigation.navigate('ProConnect', { consultationId: consultation.id })
                  }
                >
                  <View style={styles.cardIcon}>
                    <Ionicons
                      name={isPending ? 'hourglass-outline' : 'medkit-outline'}
                      size={20}
                      color={colors.darkAccentGreen}
                    />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {isPending ? 'Waiting for a practitioner' : 'Consultation'}
                    </Text>
                    <Text style={styles.cardSubtitle} numberOfLines={2}>
                      {consultation.symptoms ?? 'No symptoms listed'}
                    </Text>
                    <Text style={styles.cardDate}>
                      {new Date(consultation.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusText, { color: badge.text }]}>
                      {consultation.status}
                    </Text>
                  </View>
                </Tappable>
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
  loader: {
    marginTop: 60,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
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
  requestButton: {
    backgroundColor: colors.primaryGreen,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 13,
    marginTop: 20,
  },
  requestButtonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14.5,
    color: colors.white,
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
  cardPending: {
    opacity: 0.75,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  cardTitle: {
    fontFamily: fonts.headingMedium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  cardSubtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardDate: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  statusPill: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    textTransform: 'capitalize',
  },
});
