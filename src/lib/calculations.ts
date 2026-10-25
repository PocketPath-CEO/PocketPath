import type { Transaction, SavingsGoal, RecurrenceRule } from '../types';
import { todayISO, daysUntil } from './format';

export interface Totals {
  incomeReceived: number;
  incomePending: number;
  expensesPaid: number;
  expensesUnpaid: number;
  essentialUnpaid: number;
  available: number;
  plannedSavings: number;
  safeToSpend: number;
  shortfall: number;
  dailyGuide: number;
  daysUntilPayday: number;
  totalIncome: number;
  totalExpenses: number;
}

export function computeTotals(
  transactions: Transaction[],
  payday: string,
  savings: SavingsGoal,
  referenceDate: string = todayISO()
): Totals {
  let incomeReceived = 0;
  let incomePending = 0;
  let expensesPaid = 0;
  let expensesUnpaid = 0;
  let essentialUnpaid = 0;

  for (const t of transactions) {
    if (t.type === 'income') {
      if (t.paid) incomeReceived += t.amount;
      else incomePending += t.amount;
    } else {
      if (t.paid) expensesPaid += t.amount;
      else {
        expensesUnpaid += t.amount;
        if (t.essential) essentialUnpaid += t.amount;
      }
    }
  }

  const available = incomeReceived + incomePending - expensesPaid - expensesUnpaid;
  const plannedSavings = savings.monthlyContribution;
  const rawSafe = available - essentialUnpaid - plannedSavings;
  const safeToSpend = Math.max(0, rawSafe);
  const shortfall = rawSafe < 0 ? Math.abs(rawSafe) : 0;

  const dUntil = daysUntil(payday, referenceDate);
  const daysUntilPayday = Math.max(1, dUntil);
  const dailyGuide = safeToSpend / daysUntilPayday;

  return {
    incomeReceived,
    incomePending,
    expensesPaid,
    expensesUnpaid,
    essentialUnpaid,
    available,
    plannedSavings,
    safeToSpend,
    shortfall,
    dailyGuide,
    daysUntilPayday,
    totalIncome: incomeReceived + incomePending,
    totalExpenses: expensesPaid + expensesUnpaid,
  };
}

// ===== Balance as of a reference date =====
// Reconciled balance: sum of all settled (paid/received) transactions on or
// before the reference date. This is the real money the user has right now.
export function balanceAsOf(
  transactions: Transaction[],
  referenceDate: string = todayISO()
): number {
  let balance = 0;
  for (const t of transactions) {
    if (t.date > referenceDate) continue;
    if (t.paid) {
      balance += t.type === 'income' ? t.amount : -t.amount;
    }
  }
  return balance;
}

// Committed balance as of a reference date: all transactions dated on or before
// the reference date, plus all paid transactions regardless of date (a paid
// transaction has already settled, even if dated in the future). This represents
// what the user actually has right now — the correct starting point for a payday
// forecast.
export function committedBalanceAsOf(
  transactions: Transaction[],
  referenceDate: string = todayISO()
): number {
  let balance = 0;
  for (const t of transactions) {
    if (t.paid) {
      // Paid transactions have already settled the money, regardless of date.
      balance += t.type === 'income' ? t.amount : -t.amount;
    } else if (t.date <= referenceDate) {
      // Unpaid transactions dated on or before ref are real obligations.
      balance += t.type === 'income' ? t.amount : -t.amount;
    }
  }
  return balance;
}

// ===== Recurrence helpers =====

function addMonths(iso: string, months: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().split('T')[0];
}

function addWeeks(iso: string, weeks: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().split('T')[0];
}

// Generate all occurrence dates of a recurring transaction from its anchor
// date through a horizon date (inclusive), excluding the anchor itself.
// The anchor date occurrence is represented by the original Transaction.
export function generateOccurrences(
  anchorDate: string,
  rule: RecurrenceRule,
  horizonDate: string
): string[] {
  const dates: string[] = [];
  if (anchorDate >= horizonDate) return dates;

  const end = rule.endDate && rule.endDate < horizonDate ? rule.endDate : horizonDate;

  if (rule.interval === 'monthly') {
    let n = 1;
    while (true) {
      const next = addMonths(anchorDate, n);
      if (next > end) break;
      dates.push(next);
      n++;
    }
  } else if (rule.interval === 'weekly') {
    let n = 1;
    while (true) {
      const next = addWeeks(anchorDate, n);
      if (next > end) break;
      dates.push(next);
      n++;
    }
  }

  return dates;
}

export interface ScheduledItem {
  date: string;
  amount: number;
  type: 'income' | 'expense';
  description: string;
  category: string;
  essential: boolean;
  sourceId: string;
  isRecurring: boolean;
}

// Collect all money events (transactions + recurring occurrences) that fall
// strictly after the reference date and on or before the horizon (payday).
// Each transaction and each recurrence occurrence is included exactly once.
export function scheduledItemsThrough(
  transactions: Transaction[],
  referenceDate: string,
  horizonDate: string
): ScheduledItem[] {
  const items: ScheduledItem[] = [];

  for (const t of transactions) {
    // 1. Non-recurring UNPAID transactions dated after ref and <= horizon.
    //    Paid transactions are already in the committed balance regardless of date.
    if (!t.recurring && !t.paid && t.date > referenceDate && t.date <= horizonDate) {
      items.push({
        date: t.date,
        amount: t.amount,
        type: t.type,
        description: t.description,
        category: t.category,
        essential: t.essential,
        sourceId: t.id,
        isRecurring: false,
      });
    }

    // 2. Recurring transactions: anchor may be before ref, occurrences after ref
    if (t.recurring) {
      const occurrences = generateOccurrences(t.date, t.recurring, horizonDate);
      for (const occDate of occurrences) {
        if (occDate > referenceDate && occDate <= horizonDate) {
          items.push({
            date: occDate,
            amount: t.amount,
            type: t.type,
            description: t.description,
            category: t.category,
            essential: t.essential,
            sourceId: t.id,
            isRecurring: true,
          });
        }
      }
    }
  }

  return items.sort((a, b) => a.date.localeCompare(b.date));
}

// Resolve the next payday: if payday is today or in the past, advance it
// by one month from the original payday until it's in the future.
export function resolveNextPayday(payday: string, referenceDate: string = todayISO()): string {
  if (!payday) return '';
  let resolved = payday;
  let guard = 0;
  while (resolved <= referenceDate && guard < 12) {
    resolved = addMonths(resolved, 1);
    guard++;
  }
  return resolved;
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

export function expenseByCategory(
  transactions: Transaction[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return map;
}

export function breakdown(
  transactions: Transaction[]
): { items: CategoryBreakdown[]; total: number } {
  const map = expenseByCategory(transactions);
  const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
  const items: CategoryBreakdown[] = Array.from(map.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
  return { items, total };
}

export interface Tip {
  id: string;
  title: string;
  body: string;
  tone: 'good' | 'warn' | 'info';
}

export function generateTips(
  totals: Totals,
  savings: SavingsGoal,
  transactions: Transaction[]
): Tip[] {
  const tips: Tip[] = [];

  if (totals.shortfall > 0) {
    tips.push({
      id: 'shortfall',
      title: 'You have a spending shortfall',
      body: `Your essentials and planned savings exceed what you have available by R${totals.shortfall.toFixed(
        2
      )}. Cut non-essential spending or move your payday closer to reality.`,
      tone: 'warn',
    });
  }

  // 50/30/20-style rule check
  const needsCats = ['housing', 'groceries', 'transport', 'utilities', 'airtime', 'debt'];
  const wantsCats = ['entertainment', 'other'];
  const catMap = expenseByCategory(transactions);
  const needs = needsCats.reduce((s, c) => s + (catMap.get(c) ?? 0), 0);
  const wants = wantsCats.reduce((s, c) => s + (catMap.get(c) ?? 0), 0);
  const savingsSpend = catMap.get('savings') ?? 0;
  const total = needs + wants + savingsSpend;

  if (total > 0 && totals.totalIncome > 0) {
    const needsPct = (needs / totals.totalIncome) * 100;
    const wantsPct = (wants / totals.totalIncome) * 100;
    const savePct = ((savingsSpend + totals.plannedSavings) / totals.totalIncome) * 100;
    if (needsPct > 60) {
      tips.push({
        id: 'needs-high',
        title: 'Your essentials take a big share',
        body: `Essentials are about ${needsPct.toFixed(0)}% of your income. If this stays above 60%, look for ways to trim utilities, transport or groceries.`,
        tone: 'warn',
      });
    }
    if (wantsPct > 30) {
      tips.push({
        id: 'wants-high',
        title: 'Non-essential spending is high',
        body: `Entertainment and other spending is about ${wantsPct.toFixed(0)}% of income. Aim to keep this under 30%.`,
        tone: 'warn',
      });
    }
    if (savePct < 10) {
      tips.push({
        id: 'save-low',
        title: 'Try to save at least 10%',
        body: `You're saving about ${savePct.toFixed(0)}% of income. Even R100 a month builds the habit — increase it when you can.`,
        tone: 'info',
      });
    }
    if (savePct >= 20 && totals.shortfall === 0) {
      tips.push({
        id: 'save-good',
        title: 'Great savings rate',
        body: `You're saving about ${savePct.toFixed(0)}% of your income. That's a strong position — keep it up.`,
        tone: 'good',
      });
    }
  }

  if (totals.dailyGuide > 0 && totals.dailyGuide < 50) {
    tips.push({
      id: 'daily-tight',
      title: 'Daily budget is tight',
      body: `Your safe-to-spend works out to about R${totals.dailyGuide.toFixed(
        2
      )} per day until payday. Limit small purchases and check in daily.`,
      tone: 'info',
    });
  }

  if (tips.length === 0) {
    tips.push({
      id: 'on-track',
      title: "You're on track",
      body: 'Your budget looks balanced. Keep logging transactions so the figures stay accurate.',
      tone: 'good',
    });
  }

  return tips;
}
