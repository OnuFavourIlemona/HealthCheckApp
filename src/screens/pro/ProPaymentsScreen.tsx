import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BounceIn } from '../../components/ui/BounceIn';
import { PatternBackground } from '../../components/ui/PatternBackground';
import type { Consultation } from '../../lib/consultations';
import { friendlyError } from '../../lib/errors';
import {
  acceptSeconds,
  computeConsultPayout,
  formatNaira,
  payoutState,
  tierFor,
  type PayoutLedgerRow,
} from '../../lib/proStats';
import { supabase } from '../../lib/supabase';
import {
  fetchBankAccount,
  fetchWithdrawals,
  isWithdrawalWindowOpen,
  requestWithdrawal,
  saveBankAccount,
  type BankAccount,
  type WithdrawalRequest,
} from '../../lib/withdrawals';
import { colors, fonts } from '../../theme';

type ConsultationWithLedger = Consultation & {
  practitioner_payouts?: PayoutLedgerRow | PayoutLedgerRow[];
};

function ledgerOf(c: ConsultationWithLedger): PayoutLedgerRow {
  const raw = c.practitioner_payouts;
  return Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
}

export function ProPaymentsScreen() {
  const [completed, setCompleted] = useState<ConsultationWithLedger[]>([]);
  const [ratingByConsultation, setRatingByConsultation] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [editingBank, setEditingBank] = useState(false);
  const [accName, setAccName] = useState('');
  const [accNumber, setAccNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [savingBank, setSavingBank] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [payMessage, setPayMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setLoading(false);
      return;
    }
    const [{ data: consultations }, { data: ratings }] = await Promise.all([
      supabase
        .from('consultations')
        .select('*, practitioner_payouts(engagement_passed, flagged, available_at)')
        .eq('professional_id', userId)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false }),
      supabase
        .from('consultation_ratings')
        .select('consultation_id, rating')
        .eq('professional_id', userId),
    ]);
    setCompleted((consultations ?? []) as ConsultationWithLedger[]);
    setRatingByConsultation(
      new Map((ratings ?? []).map((r) => [r.consultation_id as string, r.rating as number])),
    );

    const [account, withdrawalRows] = await Promise.all([fetchBankAccount(), fetchWithdrawals()]);
    setBankAccount(account);
    setWithdrawals(withdrawalRows);
    if (account) {
      setAccName(account.account_name);
      setAccNumber(account.account_number);
      setBankName(account.bank_name);
      setEditingBank(false);
    } else {
      setEditingBank(true);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const tier = tierFor(completed.length);
  // Shown to the practitioner as their earnings, full stop.
  let earned = 0;
  // Never shown or labelled -- silently caps what a withdrawal request can
  // actually pull. A consult that hasn't cleared engagement/escrow checks
  // still counts toward "earned" above, just not toward this.
  let withdrawable = 0;
  for (const c of completed) {
    const amount = computeConsultPayout(
      ratingByConsultation.get(c.id) ?? null,
      acceptSeconds(c.created_at, c.accepted_at),
      tier.name,
    );
    earned += amount;
    if (payoutState(ledgerOf(c)) === 'available') withdrawable += amount;
  }

  // Anything already requested (pending or paid) is no longer available.
  const alreadyRequested = withdrawals
    .filter((w) => w.status !== 'rejected')
    .reduce((sum, w) => sum + w.amount, 0);
  const available = Math.max(0, withdrawable - alreadyRequested);
  const windowOpen = isWithdrawalWindowOpen();

  const handleSaveBank = async () => {
    if (savingBank) return;
    setPayMessage(null);
    if (!accName.trim() || !accNumber.trim() || !bankName.trim()) {
      setPayMessage({ kind: 'error', text: 'Please fill in all your account details.' });
      return;
    }
    if (!/^\d{10}$/.test(accNumber.trim())) {
      setPayMessage({ kind: 'error', text: 'A Nigerian account number is 10 digits.' });
      return;
    }
    setSavingBank(true);
    const account: BankAccount = {
      account_name: accName,
      account_number: accNumber,
      bank_name: bankName,
    };
    const { error } = await saveBankAccount(account);
    setSavingBank(false);
    if (error) {
      setPayMessage({ kind: 'error', text: friendlyError(error) });
      return;
    }
    setBankAccount(account);
    setEditingBank(false);
    setPayMessage({ kind: 'success', text: 'Account details saved.' });
  };

  const handleRequestWithdrawal = async () => {
    if (requesting || !bankAccount) return;
    setPayMessage(null);
    if (!windowOpen) {
      setPayMessage({ kind: 'error', text: 'Withdrawals can only be requested in the last 7 days of the month.' });
      return;
    }
    if (available <= 0) {
      setPayMessage({ kind: 'error', text: 'You have no balance available to withdraw.' });
      return;
    }
    setRequesting(true);
    const { error } = await requestWithdrawal(available, bankAccount);
    setRequesting(false);
    if (error) {
      setPayMessage({ kind: 'error', text: friendlyError(error) });
      return;
    }
    setPayMessage({ kind: 'success', text: 'Withdrawal requested. You will be paid to your saved account.' });
    setWithdrawals(await fetchWithdrawals());
  };

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
            {completed.length} completed consultation{completed.length === 1 ? '' : 's'} · paid by
            your rating on each
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

        {/* Withdrawal */}
        <Text style={styles.sectionTitle}>Withdraw</Text>
        <View style={styles.withdrawCard}>
          <View style={styles.availableRow}>
            <Text style={styles.availableLabel}>Available to withdraw</Text>
            <Text style={styles.availableAmount}>{formatNaira(available)}</Text>
          </View>

          {editingBank ? (
            <View style={styles.bankForm}>
              <TextInput
                style={styles.bankInput}
                placeholder="Account name"
                placeholderTextColor={colors.inputPlaceholder}
                value={accName}
                onChangeText={setAccName}
              />
              <TextInput
                style={styles.bankInput}
                placeholder="Account number (10 digits)"
                placeholderTextColor={colors.inputPlaceholder}
                keyboardType="number-pad"
                maxLength={10}
                value={accNumber}
                onChangeText={setAccNumber}
              />
              <TextInput
                style={styles.bankInput}
                placeholder="Bank name"
                placeholderTextColor={colors.inputPlaceholder}
                value={bankName}
                onChangeText={setBankName}
              />
              {savingBank ? (
                <ActivityIndicator color={colors.primaryGreen} style={{ height: 44 }} />
              ) : (
                <Pressable style={styles.primaryBtn} onPress={handleSaveBank}>
                  <Text style={styles.primaryBtnText}>Save Account Details</Text>
                </Pressable>
              )}
            </View>
          ) : bankAccount ? (
            <View style={styles.savedAccount}>
              <View style={styles.savedAccountBody}>
                <Text style={styles.savedAccountName}>{bankAccount.account_name}</Text>
                <Text style={styles.savedAccountMeta}>
                  {bankAccount.account_number} · {bankAccount.bank_name}
                </Text>
              </View>
              <Pressable onPress={() => setEditingBank(true)} hitSlop={8}>
                <Text style={styles.changeLink}>Change</Text>
              </Pressable>
            </View>
          ) : null}

          {!editingBank && bankAccount ? (
            requesting ? (
              <ActivityIndicator color={colors.primaryGreen} style={{ height: 48 }} />
            ) : (
              <Pressable
                style={[styles.primaryBtn, (!windowOpen || available <= 0) && styles.primaryBtnDisabled]}
                onPress={handleRequestWithdrawal}
                disabled={!windowOpen || available <= 0}
              >
                <Text style={styles.primaryBtnText}>Request Withdrawal</Text>
              </Pressable>
            )
          ) : null}

          <Text style={styles.windowHint}>
            {windowOpen
              ? 'Withdrawals are open — you can request until the end of the month.'
              : 'Withdrawals open in the last 7 days of each month.'}
          </Text>
        </View>

        {payMessage ? (
          <Text style={payMessage.kind === 'error' ? styles.payError : styles.paySuccess}>
            {payMessage.text}
          </Text>
        ) : null}

        {withdrawals.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Withdrawal Requests</Text>
            {withdrawals.map((w) => (
              <View key={w.id} style={styles.txCard}>
                <View style={styles.txIcon}>
                  <MaterialCommunityIcons name="bank-transfer" size={20} color="#0E8F2F" />
                </View>
                <View style={styles.txBody}>
                  <Text style={styles.txTitle}>{formatNaira(w.amount)}</Text>
                  <Text style={styles.txDate}>
                    {new Date(w.requested_at).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.statusPill,
                    w.status === 'paid'
                      ? styles.statusPaid
                      : w.status === 'rejected'
                        ? styles.statusRejected
                        : styles.statusPending,
                  ]}
                >
                  {w.status}
                </Text>
              </View>
            ))}
          </>
        ) : null}

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
          completed.map((consultation) => {
            const rating = ratingByConsultation.get(consultation.id) ?? null;
            return (
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
                    {rating != null ? ` · ${rating}★` : ' · not rated yet'}
                  </Text>
                </View>
                <Text style={styles.txAmount}>
                  +
                  {formatNaira(
                    computeConsultPayout(
                      rating,
                      acceptSeconds(consultation.created_at, consultation.accepted_at),
                      tier.name,
                    ),
                  )}
                </Text>
              </View>
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
  withdrawCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginTop: 12,
  },
  availableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  availableLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  availableAmount: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.darkAccentGreen,
  },
  bankForm: {
    marginTop: 14,
    gap: 10,
  },
  bankInput: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: fonts.bodyRegular,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  savedAccount: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  savedAccountBody: {
    flex: 1,
    marginRight: 10,
  },
  savedAccountName: {
    fontFamily: fonts.headingMedium,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  savedAccountMeta: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  changeLink: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.primaryGreen,
  },
  primaryBtn: {
    backgroundColor: colors.primaryGreen,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14.5,
    color: colors.white,
  },
  windowHint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    marginTop: 12,
  },
  payError: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.danger,
    marginTop: 12,
  },
  paySuccess: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.darkAccentGreen,
    marginTop: 12,
  },
  statusPill: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    textTransform: 'capitalize',
    overflow: 'hidden',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPending: {
    backgroundColor: '#FFF4E0',
    color: '#C77B00',
  },
  statusPaid: {
    backgroundColor: colors.pillGreenBg,
    color: colors.darkAccentGreen,
  },
  statusRejected: {
    backgroundColor: '#FDEBE4',
    color: colors.danger,
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
