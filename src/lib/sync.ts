import { supabase } from './supabase';
import type {
  AppData,
  Transaction,
  BudgetTarget,
  SavingsGoal,
  Settings,
  RecurrenceRule,
} from '../types';

// ===== Database row types =====

interface TxnRow {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  transaction_date: string;
  description: string;
  category: string;
  essential: boolean;
  paid: boolean;
  recurring: RecurrenceRule | null;
}

interface SettingsRow {
  payday: string | null;
  monthly_income: number;
}

interface SavingsRow {
  target_amount: number;
  current_amount: number;
  monthly_contribution: number;
}

interface TargetRow {
  id: string;
  category: string;
  amount_limit: number;
}

// ===== Mapping helpers =====

function rowToTxn(row: TxnRow): Transaction {
  return {
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    date: row.transaction_date,
    description: row.description ?? '',
    category: row.category as Transaction['category'],
    essential: row.essential,
    paid: row.paid,
    recurring: row.recurring ?? null,
  };
}

function txnToRow(t: Transaction): Omit<TxnRow, 'id'> {
  return {
    type: t.type,
    amount: t.amount,
    transaction_date: t.date,
    description: t.description,
    category: t.category,
    essential: t.essential,
    paid: t.paid,
    recurring: t.recurring ?? null,
  };
}

// ===== Load all data for the signed-in user =====

export async function loadCloudData(userId: string): Promise<AppData | null> {
  if (!supabase) return null;

  const [txnRes, settingsRes, savingsRes, targetsRes] = await Promise.all([
    supabase.from('pocketpath_transactions').select('*').eq('user_id', userId),
    supabase.from('pocketpath_settings').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('pocketpath_savings_goals').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('pocketpath_budget_targets').select('*').eq('user_id', userId),
  ]);

  if (txnRes.error) throw new Error(txnRes.error.message);
  if (settingsRes.error) throw new Error(settingsRes.error.message);
  if (savingsRes.error) throw new Error(savingsRes.error.message);
  if (targetsRes.error) throw new Error(targetsRes.error.message);

  const transactions: Transaction[] = (txnRes.data as TxnRow[]).map(rowToTxn);

  const settingsRow = settingsRes.data as SettingsRow | null;
  const settings: Settings = {
    payday: settingsRow?.payday ?? '',
    monthlyIncome: settingsRow ? Number(settingsRow.monthly_income) : 0,
    isDemo: false,
  };

  const savingsRow = savingsRes.data as SavingsRow | null;
  const savings: SavingsGoal = {
    targetAmount: savingsRow ? Number(savingsRow.target_amount) : 0,
    currentAmount: savingsRow ? Number(savingsRow.current_amount) : 0,
    monthlyContribution: savingsRow ? Number(savingsRow.monthly_contribution) : 0,
  };

  const targetRows = (targetsRes.data ?? []) as TargetRow[];
  const targets: BudgetTarget[] = targetRows.map((r) => ({
    category: r.category as BudgetTarget['category'],
    limit: Number(r.amount_limit),
  }));

  return { transactions, targets, savings, settings, version: 1 };
}

// ===== Save all data for the signed-in user =====

export async function saveCloudData(userId: string, data: AppData): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');

  // 1. Upsert settings
  const { error: settingsErr } = await supabase
    .from('pocketpath_settings')
    .upsert(
      {
        user_id: userId,
        payday: data.settings.payday || null,
        monthly_income: data.settings.monthlyIncome,
      },
      { onConflict: 'user_id' }
    );
  if (settingsErr) throw new Error(settingsErr.message);

  // 2. Upsert savings goal
  const { error: savingsErr } = await supabase
    .from('pocketpath_savings_goals')
    .upsert(
      {
        user_id: userId,
        target_amount: data.savings.targetAmount,
        current_amount: data.savings.currentAmount,
        monthly_contribution: data.savings.monthlyContribution,
      },
      { onConflict: 'user_id' }
    );
  if (savingsErr) throw new Error(savingsErr.message);

  // 3. Sync budget targets: delete old, insert new
  const { error: delTargetsErr } = await supabase
    .from('pocketpath_budget_targets')
    .delete()
    .eq('user_id', userId);
  if (delTargetsErr) throw new Error(delTargetsErr.message);

  if (data.targets.length > 0) {
    const { error: insertTargetsErr } = await supabase
      .from('pocketpath_budget_targets')
      .insert(
        data.targets.map((t) => ({
          user_id: userId,
          category: t.category,
          amount_limit: t.limit,
        }))
      );
    if (insertTargetsErr) throw new Error(insertTargetsErr.message);
  }

  // 4. Sync transactions: delete old, insert new
  //    We do a full replace because the local data is the source of truth
  //    and transaction IDs are client-generated.
  const { error: delTxnsErr } = await supabase
    .from('pocketpath_transactions')
    .delete()
    .eq('user_id', userId);
  if (delTxnsErr) throw new Error(delTxnsErr.message);

  if (data.transactions.length > 0) {
    const { error: insertTxnsErr } = await supabase
      .from('pocketpath_transactions')
      .insert(
        data.transactions.map((t) => ({
          user_id: userId,
          ...txnToRow(t),
        }))
      );
    if (insertTxnsErr) throw new Error(insertTxnsErr.message);
  }
}
