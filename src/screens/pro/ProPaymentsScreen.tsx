import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BounceIn } from '../../components/ui/BounceIn';
import { PatternBackground } from '../../components/ui/PatternBackground';
import type { Consultation } from '../../lib/consultations';
import { CONSULTATION_FEE, formatNaira, tierFor } from '../../lib/proStats';
import { supabase } from '../../lib/supabase';
import { colors, fonts } from '../../theme';

export function ProPaymentsScreen() {
  const [completed, setCompleted] = useState<Consultation[]>([]);
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
      .eq('status', 'completed')
      .order('updated_at', { ascending: false });
    setCompleted((data ?? []) as Consultation[]);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const earned = completed.length * CONSULTATION_FEE;
  const tier = tierFor(completed.length);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <PatternBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Payments</Text>

        {/* Balance card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Earned to date</Text>
          <Text style={styles.balanceAmount}>{formatNaira(earned)}</Text>
          <Text style={styles.balanceMeta}>
            {completed.length} completed consultation{completed.length === 1 ? '' : 's'} ·{' '}
            {formatNaira(CONSULTATION_FEE)} each
          </Text>

          <View style={styles.tierRow}>
            <MaterialCommunityIcons name="medal-outline" size={18} color="#F5C41E" />
            <Text style={styles.tierText}>{tier.name} tier</Text>
            {tier.next != null ? (
              <Text style={styles.tierNext}>
                · {tier.next - completed.length} more to level up
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.noticeCard}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.noticeText}>
            Payouts are not yet enabled. This shows what you have earned so far, and withdrawals
            will open once payment processing goes live.
          </Text>
        </View>

        {/* History */}
        <Text style={styles.sectionTitle}>Earnings History</Text>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.loader} />
        ) : completed.length === 0 ? (
          <View style={styles.emptyState}>
            <BounceIn style={styles.emptyIcon}>
              <MaterialCommunityIcons name="wallet-outline" size={30} color={colors.primaryGreen} />
            </BounceIn>
            <Text style={styles.emptyTitle}>No earnings yet</Text>
            <Text style={styles.emptyBody}>
              Complete a consultation and it will show up here.
            </Text>
          </View>
        ) : (
          completed.map((consultation) => (
            <View key={consultation.id} style={styles.txCard}>
              <View style={styles.txIcon}>
                <MaterialCommunityIcons name="stethoscope" size={20} color="#0E8F2F" />
              </View>
              <View style={styles.txBody}>
                <Text style={styles.txTitle} numberOfLines={1}>
                  Consultation with {consultation.patient_name ?? 'Patient'}
                </Text>
                <Text style={styles.txDate}>
                  {new Date(consultation.created_at).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </View>
              <Text style={styles.txAmount}>+{formatNaira(CONSULTATION_FEE)}</Text>
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
  balanceCard: {
    backgroundColor: colors.cardDark,
    borderRadius: 18,
    padding: 20,
    marginTop: 16,
  },
  balanceLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    color: colors.cardDarkMutedText,
  },
  balanceAmount: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 32,
    color: colors.white,
    marginTop: 6,
  },
  balanceMeta: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.cardDarkMutedText,
    marginTop: 4,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },
  tierText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: '#F5C41E',
  },
  tierNext: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.cardDarkMutedText,
    flexShrink: 1,
  },
  noticeCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 14,
  },
  noticeText: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  sectionTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: 24,
  },
  loader: {
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 30,
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
  txCard: {
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
  txIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txBody: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },
  txTitle: {
    fontFamily: fonts.headingMedium,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  txDate: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  txAmount: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14.5,
    color: colors.darkAccentGreen,
  },
});
