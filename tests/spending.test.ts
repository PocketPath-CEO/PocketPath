import { describe, it, expect } from 'vitest';
import { spendingVelocity, generateInsights } from '../src/lib/intelligence';
import type { Transaction, SavingsGoal, BudgetTarget } from '../src/types';
import type { Totals } from '../src/lib/calculations';

const REF = '2026-10-24';

function makeTxn(partial: Partial<Transaction> & Pick<Transaction, 'type' | 'amount' | 'date'>): Transaction {
  return {
    id: `tx-${Math.random().toString(36).slice(2, 8)}`,
    description: 'Test',
    category: 'other',
    essential: false,
    paid: true,
    recurring: null,
    ...partial,
  };
}

const emptySavings: SavingsGoal = {
  targetAmount: 0,
  currentAmount: 0,
  monthlyContribution: 0,
};

const emptyTotals: Totals = {
  totalIncome: 10000,
  totalExpenses: 2000,
  incomeReceived: 10000,
  available: 8000,
  safeToSpend: 8000,
  dailyGuide: 200,
  daysUntilPayday: 40,
  shortfall: 0,
  essentialUnpaid: 0,
  essentialPaid: 0,
  discretionary: 0,
};

const emptyTargets: BudgetTarget[] = [];

// ===== spendingVelocity =====

describe('spendingVelocity', () => {
  it('returns 0 when there are no expenses', () => {
    expect(spendingVelocity([], REF)).toBe(0);
    expect(spendingVelocity([makeTxn({ type: 'income', amount: 1000, date: '2026-10-20' })], REF)).toBe(0);
  });

  it('returns 0 when there is no discretionary spending', () => {
    const txns = [
      makeTxn({ type: 'expense', amount: 500, date: '2026-10-20', category: 'groceries', essential: true }),
    ];
    expect(spendingVelocity(txns, REF)).toBe(0);
  });

  it('returns 0 when all discretionary transactions are on a single day (insufficient history)', () => {
    // R3,800 of entertainment all on one day — should NOT produce a per-day rate of R3,800
    const txns = [
      makeTxn({ type: 'expense', amount: 2000, date: '2026-10-24', category: 'entertainment' }),
      makeTxn({ type: 'expense', amount: 1800, date: '2026-10-24', category: 'other' }),
    ];
    expect(spendingVelocity(txns, REF)).toBe(0);
  });

  it('returns 0 when history spans fewer than MIN_HISTORY_DAYS (4 days)', () => {
    // Transactions on 2 distinct days, spanning only 2 days
    const txns = [
      makeTxn({ type: 'expense', amount: 100, date: '2026-10-22', category: 'entertainment' }),
      makeTxn({ type: 'expense', amount: 100, date: '2026-10-23', category: 'other' }),
    ];
    expect(spendingVelocity(txns, REF)).toBe(0);
  });

  it('returns 0 when discretionary transactions span 3 days (still under threshold)', () => {
    const txns = [
      makeTxn({ type: 'expense', amount: 100, date: '2026-10-21', category: 'entertainment' }),
      makeTxn({ type: 'expense', amount: 100, date: '2026-10-22', category: 'other' }),
      makeTxn({ type: 'expense', amount: 100, date: '2026-10-23', category: 'entertainment' }),
    ];
    // 3 days span, 2 distinct days — under MIN_HISTORY_DAYS (4) and distinctDays < 2 check is 2 (passes)
    // But elapsed = 2 < 4 → returns 0
    expect(spendingVelocity(txns, REF)).toBe(0);
  });

  it('computes reliable rate when transactions span 4+ days across 2+ distinct days', () => {
    // Oct 20 to Oct 24 = 4 days elapsed, 3 distinct days, total R600 discretionary → R150/day
    const txns = [
      makeTxn({ type: 'expense', amount: 200, date: '2026-10-20', category: 'entertainment' }),
      makeTxn({ type: 'expense', amount: 200, date: '2026-10-22', category: 'other' }),
      makeTxn({ type: 'expense', amount: 200, date: '2026-10-24', category: 'entertainment' }),
    ];
    expect(spendingVelocity(txns, REF)).toBe(150);
  });

  it('excludes future-dated transactions from the velocity calculation', () => {
    // Past: Oct 20–24 (4 days), R400 → R100/day
    // Future: Oct 28, R5000 — should NOT inflate the rate
    const txns = [
      makeTxn({ type: 'expense', amount: 200, date: '2026-10-20', category: 'entertainment' }),
      makeTxn({ type: 'expense', amount: 200, date: '2026-10-24', category: 'other' }),
      makeTxn({ type: 'expense', amount: 5000, date: '2026-10-28', category: 'entertainment' }),
    ];
    // Only past transactions counted: 400 / 4 = 100
    expect(spendingVelocity(txns, REF)).toBe(100);
  });

  it('does not let a batch of transactions on one day inflate the rate when spread across enough days', () => {
    // R3800 on Oct 24, plus R100 on Oct 20 → 5 days elapsed, 2 distinct days
    // Total discretionary: 3900, elapsed = 4 → 975/day (not 3800/day)
    const txns = [
      makeTxn({ type: 'expense', amount: 100, date: '2026-10-20', category: 'entertainment' }),
      makeTxn({ type: 'expense', amount: 3800, date: '2026-10-24', category: 'other' }),
    ];
    expect(spendingVelocity(txns, REF)).toBe(975);
  });
});

// ===== generateInsights: velocity suppression =====

describe('generateInsights velocity behaviour', () => {
  it('suppresses spending-fast insight for same-day batch of transactions', () => {
    const txns = [
      makeTxn({ type: 'expense', amount: 2000, date: '2026-10-24', category: 'entertainment' }),
      makeTxn({ type: 'expense', amount: 1800, date: '2026-10-24', category: 'other' }),
    ];
    const insights = generateInsights(txns, emptyTotals, emptyTargets, emptySavings, REF);
    const spendingFast = insights.find((i) => i.id === 'velocity-high');
    expect(spendingFast).toBeUndefined();
  });

  it('shows insufficient-history info insight when discretionary spending exists but history is too short', () => {
    const txns = [
      makeTxn({ type: 'expense', amount: 2000, date: '2026-10-24', category: 'entertainment' }),
    ];
    const insights = generateInsights(txns, emptyTotals, emptyTargets, emptySavings, REF);
    const insufficient = insights.find((i) => i.id === 'velocity-insufficient');
    expect(insufficient).toBeDefined();
    expect(insufficient!.tone).toBe('info');
    expect(insufficient!.body).toBe('insight.spendingInsufficientHistory');
  });

  it('shows spending-fast insight when reliable velocity exceeds daily guide', () => {
    // 4+ days, 2+ distinct days, velocity = 975, dailyGuide = 200
    const txns = [
      makeTxn({ type: 'expense', amount: 100, date: '2026-10-20', category: 'entertainment' }),
      makeTxn({ type: 'expense', amount: 3800, date: '2026-10-24', category: 'other' }),
    ];
    const totals = { ...emptyTotals, dailyGuide: 200 };
    const insights = generateInsights(txns, totals, emptyTargets, emptySavings, REF);
    const spendingFast = insights.find((i) => i.id === 'velocity-high');
    expect(spendingFast).toBeDefined();
    expect(spendingFast!.tone).toBe('warn');
  });

  it('does not show spending-fast insight when velocity is below daily guide', () => {
    // 4 days, R400 total → R100/day, dailyGuide = 200
    const txns = [
      makeTxn({ type: 'expense', amount: 200, date: '2026-10-20', category: 'entertainment' }),
      makeTxn({ type: 'expense', amount: 200, date: '2026-10-24', category: 'other' }),
    ];
    const totals = { ...emptyTotals, dailyGuide: 200 };
    const insights = generateInsights(txns, totals, emptyTargets, emptySavings, REF);
    const spendingFast = insights.find((i) => i.id === 'velocity-high');
    expect(spendingFast).toBeUndefined();
  });

  it('excludes future-dated transactions from the insight calculation', () => {
    // Past: R400 over 4 days → R100/day (below guide of 200)
    // Future: R5000 on Oct 28 — should NOT trigger the insight
    const txns = [
      makeTxn({ type: 'expense', amount: 200, date: '2026-10-20', category: 'entertainment' }),
      makeTxn({ type: 'expense', amount: 200, date: '2026-10-24', category: 'other' }),
      makeTxn({ type: 'expense', amount: 5000, date: '2026-10-28', category: 'entertainment' }),
    ];
    const totals = { ...emptyTotals, dailyGuide: 200 };
    const insights = generateInsights(txns, totals, emptyTargets, emptySavings, REF);
    const spendingFast = insights.find((i) => i.id === 'velocity-high');
    expect(spendingFast).toBeUndefined();
  });
});
