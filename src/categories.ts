import {
  Home,
  ShoppingBasket,
  Car,
  Zap,
  Smartphone,
  CreditCard,
  Film,
  PiggyBank,
  Wallet,
  Banknote,
  type LucideIcon,
} from 'lucide-react';
import type { CategoryId, TxnType } from './types';

export interface CategoryInfo {
  id: CategoryId;
  label: string;
  type: TxnType;
  icon: LucideIcon;
  color: string; // tailwind text/bg helper
  tKey: string;
}

export const CATEGORIES: Record<CategoryId, CategoryInfo> = {
  income: { id: 'income', label: 'Income', type: 'income', icon: Banknote, color: 'mint', tKey: 'cat.income' },
  housing: { id: 'housing', label: 'Housing / Rent', type: 'expense', icon: Home, color: 'navy', tKey: 'cat.housing' },
  groceries: { id: 'groceries', label: 'Groceries', type: 'expense', icon: ShoppingBasket, color: 'mint', tKey: 'cat.groceries' },
  transport: { id: 'transport', label: 'Transport', type: 'expense', icon: Car, color: 'navy', tKey: 'cat.transport' },
  utilities: { id: 'utilities', label: 'Utilities', type: 'expense', icon: Zap, color: 'mint', tKey: 'cat.utilities' },
  airtime: { id: 'airtime', label: 'Airtime / Data', type: 'expense', icon: Smartphone, color: 'navy', tKey: 'cat.airtime' },
  debt: { id: 'debt', label: 'Debt Repayment', type: 'expense', icon: CreditCard, color: 'mint', tKey: 'cat.debt' },
  entertainment: { id: 'entertainment', label: 'Entertainment', type: 'expense', icon: Film, color: 'navy', tKey: 'cat.entertainment' },
  savings: { id: 'savings', label: 'Savings', type: 'expense', icon: PiggyBank, color: 'mint', tKey: 'cat.savings' },
  other: { id: 'other', label: 'Other', type: 'expense', icon: Wallet, color: 'navy', tKey: 'cat.other' },
};

export const EXPENSE_CATEGORY_IDS: CategoryId[] = [
  'housing',
  'groceries',
  'transport',
  'utilities',
  'airtime',
  'debt',
  'entertainment',
  'savings',
  'other',
];

export const CATEGORY_OPTIONS = EXPENSE_CATEGORY_IDS.map((id) => ({
  value: id,
  label: CATEGORIES[id].label,
}));
