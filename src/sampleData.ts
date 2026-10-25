import type { AppData, Transaction } from './types';
import { todayISO } from './lib/format';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function dateOffset(days: number): string {
  const d = new Date(todayISO() + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function makeSampleData(): AppData {
  const transactions: Transaction[] = [
    {
      id: uid(),
      type: 'income',
      amount: 9500,
      date: dateOffset(-3),
      description: 'Monthly salary',
      category: 'income',
      essential: false,
      paid: true,
      recurring: { interval: 'monthly', dayOfMonth: 25 },
    },
    {
      id: uid(),
      type: 'expense',
      amount: 3200,
      date: dateOffset(-3),
      description: 'Rent — shared flat',
      category: 'housing',
      essential: true,
      paid: true,
    },
    {
      id: uid(),
      type: 'expense',
      amount: 850,
      date: dateOffset(-2),
      description: 'Monthly groceries',
      category: 'groceries',
      essential: true,
      paid: true,
    },
    {
      id: uid(),
      type: 'expense',
      amount: 280,
      date: dateOffset(-2),
      description: 'Taxi fare (monthly)',
      category: 'transport',
      essential: true,
      paid: true,
    },
    {
      id: uid(),
      type: 'expense',
      amount: 320,
      date: dateOffset(-1),
      description: 'Prepaid electricity',
      category: 'utilities',
      essential: true,
      paid: false,
    },
    {
      id: uid(),
      type: 'expense',
      amount: 149,
      date: dateOffset(-1),
      description: 'Mobile data bundle',
      category: 'airtime',
      essential: true,
      paid: false,
    },
    {
      id: uid(),
      type: 'expense',
      amount: 500,
      date: dateOffset(2),
      description: 'Loan repayment',
      category: 'debt',
      essential: true,
      paid: false,
    },
    {
      id: uid(),
      type: 'expense',
      amount: 180,
      date: dateOffset(-1),
      description: 'Netflix + Spotify',
      category: 'entertainment',
      essential: false,
      paid: false,
    },
    {
      id: uid(),
      type: 'expense',
      amount: 600,
      date: dateOffset(-1),
      description: 'Savings transfer',
      category: 'savings',
      essential: false,
      paid: false,
    },
  ];

  return {
    transactions,
    targets: [
      { category: 'groceries', limit: 1200 },
      { category: 'transport', limit: 400 },
      { category: 'entertainment', limit: 300 },
      { category: 'airtime', limit: 250 },
    ],
    savings: {
      targetAmount: 6000,
      currentAmount: 2400,
      monthlyContribution: 600,
    },
    settings: {
      payday: dateOffset(11),
      monthlyIncome: 9500,
      isDemo: true,
    },
    version: 1,
  };
}
