export type CategoryId =
  | 'income'
  | 'housing'
  | 'groceries'
  | 'transport'
  | 'utilities'
  | 'airtime'
  | 'debt'
  | 'entertainment'
  | 'savings'
  | 'other';

export type TxnType = 'income' | 'expense';

export type RecurrenceInterval = 'monthly' | 'weekly';

export interface RecurrenceRule {
  interval: RecurrenceInterval;
  dayOfMonth?: number; // 1-31, for monthly
  dayOfWeek?: number;  // 0-6 (Sun-Sat), for weekly
  endDate?: string;    // ISO date, inclusive — occurrences past this date are not generated
}

export interface Transaction {
  id: string;
  type: TxnType;
  amount: number;
  date: string; // ISO yyyy-mm-dd — the first/anchor occurrence for recurring items
  description: string;
  category: CategoryId;
  essential: boolean; // only meaningful for expenses
  paid: boolean; // expenses: paid or unpaid; income: received or not
  recurring?: RecurrenceRule | null;
}

export interface BudgetTarget {
  category: CategoryId;
  limit: number;
}

export interface SavingsGoal {
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
}

export interface Settings {
  payday: string; // ISO date of next payday
  monthlyIncome: number; // expected monthly income (reference)
  isDemo: boolean;
}

export interface AppData {
  transactions: Transaction[];
  targets: BudgetTarget[];
  savings: SavingsGoal;
  settings: Settings;
  version: number;
}
