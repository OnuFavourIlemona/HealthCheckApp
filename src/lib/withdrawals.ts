import { supabase } from './supabase';

export type BankAccount = {
  account_name: string;
  account_number: string;
  bank_name: string;
};

export type WithdrawalRequest = {
  id: string;
  amount: number;
  account_name: string;
  account_number: string;
  bank_name: string;
  status: 'pending' | 'paid' | 'rejected';
  requested_at: string;
  processed_at: string | null;
};

/** Withdrawals can only be requested in the final 7 calendar days of the month. */
export function isWithdrawalWindowOpen(now = new Date()): boolean {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return now.getDate() > daysInMonth - 7;
}

export async function fetchBankAccount(): Promise<BankAccount | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return null;
  const { data } = await supabase
    .from('profiles')
    .select('bank_account_name, bank_account_number, bank_name')
    .eq('id', userId)
    .maybeSingle();
  if (!data?.bank_account_name || !data?.bank_account_number || !data?.bank_name) return null;
  return {
    account_name: data.bank_account_name,
    account_number: data.bank_account_number,
    bank_name: data.bank_name,
  };
}

export async function saveBankAccount(account: BankAccount): Promise<{ error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { error: 'You must be signed in.' };
  const { error } = await supabase
    .from('profiles')
    .update({
      bank_account_name: account.account_name.trim(),
      bank_account_number: account.account_number.trim(),
      bank_name: account.bank_name.trim(),
    })
    .eq('id', userId);
  return { error: error?.message ?? null };
}

export async function fetchWithdrawals(): Promise<WithdrawalRequest[]> {
  const { data } = await supabase
    .from('withdrawal_requests')
    .select('id, amount, account_name, account_number, bank_name, status, requested_at, processed_at')
    .order('requested_at', { ascending: false });
  return (data ?? []) as WithdrawalRequest[];
}

export async function requestWithdrawal(
  amount: number,
  account: BankAccount,
): Promise<{ error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { error: 'You must be signed in.' };
  const { error } = await supabase.from('withdrawal_requests').insert({
    professional_id: userId,
    amount,
    account_name: account.account_name,
    account_number: account.account_number,
    bank_name: account.bank_name,
  });
  return { error: error?.message ?? null };
}
