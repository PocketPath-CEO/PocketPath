import { describe, it, expect } from 'vitest';
import {
  balanceAsOf,
  committedBalanceAsOf,
  scheduledItemsThrough,
  resolveNextPayday,
  generateOccurrences,
} from '../src/lib/calculations';
import { computeForecast } from '../src/lib/intelligence';
import type { Transaction, SavingsGoal, RecurrenceRule } from '../src/types';

const savings: SavingsGoal = {
  targetAmount: 6000,
  currentAmount: 2400,
  monthlyContribution: 600,
};

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

const REF = '2026-10-24';
const PAYDAY = '2026-11-04'; // 11 days after ref

function monthlySalary(amount: number, anchorDate: string, dayOfMonth: number): Transaction {
  const rule: RecurrenceRule = { interval: 'monthly', dayOfMonth };
  return makeTxn({ type: 'income', amount, date: anchorDate, description: 'Salary', category: 'income', paid: true, recurring: rule });
}

// ===== balanceAsOf (settled-only, kept for backward compat) =====

describe('balanceAsOf', () => {
  it('sums only paid transactions on or before the reference date', () => {
    const txns = [
      makeTxn({ type: 'income', amount: 1000, date: '2026-10-20', paid: true }),
      makeTxn({ type: 'expense', amount: 300, date: '2026-10-22', paid: true }),
      makeTxn({ type: 'expense', amount: 100, date: '2026-10-26', paid: true }),
      makeTxn({ type: 'income', amount: 500, date: '2026-10-21', paid: false }),
    ];
    expect(balanceAsOf(txns, REF)).toBe(700);
  });

  it('returns 0 when no settled transactions exist', () => {
    expect(balanceAsOf([makeTxn({ type: 'income', amount: 1000, date: '2026-10-20', paid: false })], REF)).toBe(0);
  });

  it('handles empty transactions', () => {
    expect(balanceAsOf([], REF)).toBe(0);
  });
});

// ===== committedBalanceAsOf (the forecast starting point) =====

describe('committedBalanceAsOf', () => {
  it('includes paid transactions regardless of date', () => {
    const txns = [
      makeTxn({ type: 'income', amount: 1000, date: '2026-10-20', paid: true }),
      makeTxn({ type: 'expense', amount: 300, date: '2026-10-26', paid: true }), // future but paid
    ];
    // 1000 - 300 = 700 (paid future expense is included)
    expect(committedBalanceAsOf(txns, REF)).toBe(700);
  });

  it('includes unpaid transactions dated on or before the reference date', () => {
    const txns = [
      makeTxn({ type: 'income', amount: 1000, date: '2026-10-20', paid: true }),
      makeTxn({ type: 'expense', amount: 400, date: '2026-10-22', paid: false }),
    ];
    // 1000 - 400 = 600
    expect(committedBalanceAsOf(txns, REF)).toBe(600);
  });

  it('excludes unpaid transactions dated after the reference date', () => {
    const txns = [
      makeTxn({ type: 'income', amount: 1000, date: '2026-10-20', paid: true }),
      makeTxn({ type: 'expense', amount: 400, date: '2026-10-28', paid: false }),
    ];
    // 1000 (the future unpaid expense is NOT in committed balance)
    expect(committedBalanceAsOf(txns, REF)).toBe(1000);
  });

  it('handles empty transactions', () => {
    expect(committedBalanceAsOf([], REF)).toBe(0);
  });
});

// ===== resolveNextPayday =====

describe('resolveNextPayday', () => {
  it('returns payday unchanged if it is in the future', () => {
    expect(resolveNextPayday('2026-11-04', REF)).toBe('2026-11-04');
  });

  it('advances payday by one month if it is today', () => {
    expect(resolveNextPayday('2026-10-24', REF)).toBe('2026-11-24');
  });

  it('advances payday if it is in the past', () => {
    expect(resolveNextPayday('2026-10-15', REF)).toBe('2026-11-15');
  });

  it('returns empty string for empty payday', () => {
    expect(resolveNextPayday('', REF)).toBe('');
  });
});

// ===== generateOccurrences =====

describe('generateOccurrences', () => {
  it('generates monthly occurrences between anchor and horizon', () => {
    const rule: RecurrenceRule = { interval: 'monthly', dayOfMonth: 25 };
    expect(generateOccurrences('2026-09-25', rule, '2026-12-31')).toEqual(['2026-10-25', '2026-11-25', '2026-12-25']);
  });

  it('does not include the anchor date itself', () => {
    const rule: RecurrenceRule = { interval: 'monthly', dayOfMonth: 25 };
    const dates = generateOccurrences('2026-09-25', rule, '2026-10-25');
    expect(dates).toEqual(['2026-10-25']);
    expect(dates).not.toContain('2026-09-25');
  });

  it('generates weekly occurrences', () => {
    const rule: RecurrenceRule = { interval: 'weekly', dayOfWeek: 1 };
    expect(generateOccurrences('2026-10-19', rule, '2026-11-09')).toEqual(['2026-10-26', '2026-11-02', '2026-11-09']);
  });

  it('respects endDate in the rule', () => {
    const rule: RecurrenceRule = { interval: 'monthly', dayOfMonth: 25, endDate: '2026-11-30' };
    expect(generateOccurrences('2026-09-25', rule, '2026-12-31')).toEqual(['2026-10-25', '2026-11-25']);
  });

  it('returns empty if anchor is at or past horizon', () => {
    const rule: RecurrenceRule = { interval: 'monthly', dayOfMonth: 25 };
    expect(generateOccurrences('2026-12-25', rule, '2026-12-25')).toEqual([]);
  });
});

// ===== scheduledItemsThrough =====

describe('scheduledItemsThrough', () => {
  it('includes unpaid non-recurring future transactions within the window', () => {
    const items = scheduledItemsThrough(
      [makeTxn({ type: 'expense', amount: 200, date: '2026-10-28', paid: false })],
      REF, PAYDAY
    );
    expect(items).toHaveLength(1);
    expect(items[0].amount).toBe(200);
    expect(items[0].isRecurring).toBe(false);
  });

  it('excludes paid transactions from scheduled items (already in balance)', () => {
    const items = scheduledItemsThrough(
      [makeTxn({ type: 'expense', amount: 200, date: '2026-10-28', paid: true })],
      REF, PAYDAY
    );
    expect(items).toHaveLength(0);
  });

  it('excludes transactions before the reference date', () => {
    expect(scheduledItemsThrough(
      [makeTxn({ type: 'expense', amount: 200, date: '2026-10-20', paid: false })],
      REF, PAYDAY
    )).toHaveLength(0);
  });

  it('excludes transactions after payday', () => {
    expect(scheduledItemsThrough(
      [makeTxn({ type: 'expense', amount: 200, date: '2026-11-10', paid: false })],
      REF, PAYDAY
    )).toHaveLength(0);
  });

  it('generates recurring occurrences within the window only', () => {
    const items = scheduledItemsThrough([monthlySalary(9500, '2026-09-25', 25)], REF, PAYDAY);
    expect(items).toHaveLength(1);
    expect(items[0].date).toBe('2026-10-25');
    expect(items[0].amount).toBe(9500);
    expect(items[0].isRecurring).toBe(true);
  });

  it('sorts items by date', () => {
    const txns = [
      makeTxn({ type: 'expense', amount: 100, date: '2026-10-30', paid: false }),
      makeTxn({ type: 'expense', amount: 200, date: '2026-10-26', paid: false }),
    ];
    const items = scheduledItemsThrough(txns, REF, PAYDAY);
    expect(items[0].date).toBe('2026-10-26');
    expect(items[1].date).toBe('2026-10-30');
  });
});

// ===== computeForecast =====

describe('computeForecast', () => {
  it('returns noPayday when payday is empty', () => {
    const f = computeForecast([makeTxn({ type: 'income', amount: 1000, date: '2026-10-20' })], '', savings, REF);
    expect(f.hasPayday).toBe(false);
    expect(f.hasData).toBe(false);
  });

  it('returns insufficientData when no transactions exist on or before ref', () => {
    const f = computeForecast(
      [makeTxn({ type: 'income', amount: 1000, date: '2026-10-28', paid: false })],
      PAYDAY, savings, REF
    );
    expect(f.hasPayday).toBe(true);
    expect(f.hasData).toBe(false);
    expect(f.explanation).toBe('forecast.insufficientData');
  });

  it('returns insufficientData for empty transactions', () => {
    expect(computeForecast([], PAYDAY, savings, REF).hasData).toBe(false);
  });

  // ===== The reported Dashboard case =====
  it('matches the reported example: forecast equals remaining budget, not R9,500 higher', () => {
    // Payday 23 Nov, ref 24 Oct
    // Salary: R29,490 received (paid) on 23 Oct
    // Rent: R10,000 paid, dated 25 Oct (future-dated but already paid)
    // Groceries: R3,000 unpaid, dated 24 Oct (on ref)
    // Phone: R600 paid, dated 23 Oct
    // Water+electricity: R2,000 paid, dated 23 Oct
    // Uber: R3,500 unpaid, dated 23 Oct
    // Medical aid: R3,000 unpaid, dated 23 Oct
    const txns = [
      makeTxn({ type: 'income', amount: 29490, date: '2026-10-23', paid: true, description: 'Salary' }),
      makeTxn({ type: 'expense', amount: 10000, date: '2026-10-25', paid: true, description: 'Rent', category: 'housing', essential: true }),
      makeTxn({ type: 'expense', amount: 3000, date: '2026-10-24', paid: false, description: 'Groceries', category: 'groceries', essential: true }),
      makeTxn({ type: 'expense', amount: 600, date: '2026-10-23', paid: true, description: 'Phone', category: 'airtime', essential: true }),
      makeTxn({ type: 'expense', amount: 2000, date: '2026-10-23', paid: true, description: 'Water and electricity', category: 'utilities', essential: true }),
      makeTxn({ type: 'expense', amount: 3500, date: '2026-10-23', paid: false, description: 'Uber', category: 'transport', essential: true }),
      makeTxn({ type: 'expense', amount: 3000, date: '2026-10-23', paid: false, description: 'Medical aid', category: 'other', essential: true }),
    ];
    const f = computeForecast(txns, '2026-11-23', savings, REF);
    expect(f.hasData).toBe(true);
    // Committed balance: 29490 - 10000 - 3000 - 600 - 2000 - 3500 - 3000 = 7390
    // No future unpaid items between ref and payday (rent is paid, excluded from scheduled)
    expect(f.projectedBalance).toBe(7390);
    // Must NOT be 16890 (the old bug)
    expect(f.projectedBalance).not.toBe(16890);
  });

  it('computes projected balance: committed balance minus future unpaid items', () => {
    // Paid income 1000, paid expense 300 → committed balance = 700
    // Future unpaid expense 200 → projected = 500
    const txns = [
      makeTxn({ type: 'income', amount: 1000, date: '2026-10-20', paid: true }),
      makeTxn({ type: 'expense', amount: 300, date: '2026-10-22', paid: true }),
      makeTxn({ type: 'expense', amount: 200, date: '2026-10-28', paid: false }),
    ];
    expect(computeForecast(txns, PAYDAY, savings, REF).projectedBalance).toBe(500);
  });

  it('includes unpaid expenses dated on or before ref in the committed balance', () => {
    // Paid income 1000, unpaid expense 400 dated before ref → committed = 600
    // Future unpaid expense 100 → projected = 500
    const txns = [
      makeTxn({ type: 'income', amount: 1000, date: '2026-10-20', paid: true }),
      makeTxn({ type: 'expense', amount: 400, date: '2026-10-22', paid: false }),
      makeTxn({ type: 'expense', amount: 100, date: '2026-10-28', paid: false }),
    ];
    expect(computeForecast(txns, PAYDAY, savings, REF).projectedBalance).toBe(500);
  });

  it('handles pending income scheduled before payday', () => {
    // Paid income 500, pending income 1000 on Oct 28 → projected = 1500
    const txns = [
      makeTxn({ type: 'income', amount: 500, date: '2026-10-20', paid: true }),
      makeTxn({ type: 'income', amount: 1000, date: '2026-10-28', paid: false }),
    ];
    expect(computeForecast(txns, PAYDAY, savings, REF).projectedBalance).toBe(1500);
  });

  it('handles paid transaction with a future date: counted in balance, not in scheduled', () => {
    // Paid income 1000 on Oct 20, paid expense 300 on Oct 28 (future-dated but paid)
    // Committed balance: 1000 - 300 = 700 (paid future expense included)
    // Scheduled items: none (paid expense excluded)
    const txns = [
      makeTxn({ type: 'income', amount: 1000, date: '2026-10-20', paid: true }),
      makeTxn({ type: 'expense', amount: 300, date: '2026-10-28', paid: true }),
    ];
    expect(computeForecast(txns, PAYDAY, savings, REF).projectedBalance).toBe(700);
  });

  it('handles payday that is today (advances to next month)', () => {
    const txns = [makeTxn({ type: 'income', amount: 1000, date: '2026-10-20', paid: true })];
    const f = computeForecast(txns, REF, savings, REF);
    expect(f.hasData).toBe(true);
    expect(f.hasPayday).toBe(true);
    expect(f.projectedBalance).toBe(1000);
  });

  it('handles payday in the past', () => {
    const txns = [makeTxn({ type: 'income', amount: 1000, date: '2026-10-20', paid: true })];
    expect(computeForecast(txns, '2026-10-15', savings, REF).projectedBalance).toBe(1000);
  });

  it('includes recurring income occurrence within forecast window', () => {
    const txns = [
      monthlySalary(9500, '2026-09-25', 25),
      makeTxn({ type: 'expense', amount: 3000, date: '2026-09-25', paid: true, category: 'housing', essential: true }),
    ];
    // Committed balance: 9500 - 3000 = 6500
    // Oct 25 recurring income: +9500 → 16000
    expect(computeForecast(txns, PAYDAY, savings, REF).projectedBalance).toBe(16000);
  });

  it('does not count a recurring anchor as both balance and occurrence', () => {
    const txns = [
      monthlySalary(9500, '2026-09-25', 25),
      makeTxn({ type: 'expense', amount: 5000, date: '2026-09-26', paid: true }),
    ];
    // Balance: 9500 - 5000 = 4500
    // Oct 25 occurrence: +9500 → 14000 (NOT 23500)
    expect(computeForecast(txns, PAYDAY, savings, REF).projectedBalance).toBe(14000);
  });

  it('includes recurring expense occurrences', () => {
    const txns = [
      makeTxn({ type: 'income', amount: 2000, date: '2026-10-20', paid: true }),
      makeTxn({ type: 'expense', amount: 100, date: '2026-10-20', paid: true, recurring: { interval: 'weekly', dayOfWeek: 2 } }),
    ];
    // Balance: 2000 - 100 = 1900
    // Oct 27: -100, Nov 3: -100 → 1700
    expect(computeForecast(txns, PAYDAY, savings, REF).projectedBalance).toBe(1700);
  });

  it('detects shortfall when projected balance is negative', () => {
    const txns = [
      makeTxn({ type: 'income', amount: 500, date: '2026-10-20', paid: true }),
      makeTxn({ type: 'expense', amount: 800, date: '2026-10-28', paid: false }),
    ];
    const f = computeForecast(txns, PAYDAY, savings, REF);
    expect(f.projectedBalance).toBe(-300);
    expect(f.onTrack).toBe(false);
    expect(f.potentialShortfall).toBe(300);
  });

  it('does not include future transactions past payday', () => {
    const txns = [
      makeTxn({ type: 'income', amount: 1000, date: '2026-10-20', paid: true }),
      makeTxn({ type: 'expense', amount: 500, date: '2026-11-10', paid: false }),
    ];
    expect(computeForecast(txns, PAYDAY, savings, REF).projectedBalance).toBe(1000);
  });

  it('handles transactions exactly on payday (inclusive)', () => {
    const txns = [
      makeTxn({ type: 'income', amount: 1000, date: '2026-10-20', paid: true }),
      makeTxn({ type: 'expense', amount: 300, date: PAYDAY, paid: false }),
    ];
    expect(computeForecast(txns, PAYDAY, savings, REF).projectedBalance).toBe(700);
  });

  it('handles transactions exactly on reference date (in committed balance, not scheduled)', () => {
    const txns = [
      makeTxn({ type: 'income', amount: 1000, date: '2026-10-20', paid: true }),
      makeTxn({ type: 'expense', amount: 200, date: REF, paid: true }),
    ];
    expect(computeForecast(txns, PAYDAY, savings, REF).projectedBalance).toBe(800);
  });

  it('handles unpaid transaction exactly on reference date (in committed balance)', () => {
    const txns = [
      makeTxn({ type: 'income', amount: 1000, date: '2026-10-20', paid: true }),
      makeTxn({ type: 'expense', amount: 200, date: REF, paid: false }),
    ];
    // Committed: 1000 - 200 = 800, no future items
    expect(computeForecast(txns, PAYDAY, savings, REF).projectedBalance).toBe(800);
  });

  it('handles date boundary: timezone-safe with T00:00:00', () => {
    const txns = [
      makeTxn({ type: 'income', amount: 1000, date: '2026-10-24', paid: true }),
      makeTxn({ type: 'expense', amount: 100, date: '2026-10-25', paid: false }),
    ];
    expect(computeForecast(txns, PAYDAY, savings, REF).projectedBalance).toBe(900);
  });

  it('verifies no transaction or recurrence occurrence is counted twice', () => {
    // Salary on Sep 25 (paid, recurring monthly), expense on Sep 26 (paid)
    // Payday Nov 4. Recurrence generates Oct 25 only (Nov 25 is past payday).
    const txns = [
      monthlySalary(9500, '2026-09-25', 25),
      makeTxn({ type: 'expense', amount: 5000, date: '2026-09-26', paid: true }),
    ];
    const f = computeForecast(txns, PAYDAY, savings, REF);
    // Balance: 9500 - 5000 = 4500
    // Oct 25 occurrence: +9500 → 14000
    // NOT 23500 (double salary) or 9000 (missing occurrence)
    expect(f.projectedBalance).toBe(14000);
  });
});
