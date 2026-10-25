import type { Transaction, SavingsGoal, BudgetTarget } from '../types';
import { todayISO } from './format';
import {
  expenseByCategory,
  committedBalanceAsOf,
  scheduledItemsThrough,
  resolveNextPayday,
  type Totals,
} from './calculations';

export interface Forecast {
  hasData: boolean;
  hasPayday: boolean;
  projectedBalance: number;
  projectedSafeSpend: number;
  onTrack: boolean;
  potentialShortfall: number;
  explanation: string;
}

export interface Insight {
  id: string;
  title: string;
  body: string;
  tone: 'good' | 'warn' | 'info';
  params?: Record<string, string>;
}

export interface AffordabilityResult {
  verdict: 'affordable' | 'careful' | 'notRecommended';
  title: string;
  explanation: string;
}

export interface HealthFactor {
  key: string;
  labelKey: string;
  score: number;
  maxScore: number;
  status: 'good' | 'warn' | 'bad';
  detailKey: string;
  detailParams?: Record<string, string>;
}

export interface HealthScore {
  score: number;
  maxScore: number;
  factors: HealthFactor[];
  summaryKey: string;
  summaryParams?: Record<string, string>;
}

export interface NextBestAction {
  actionKey: string;
  actionParams?: Record<string, string>;
  impactKey: string;
  impactParams?: Record<string, string>;
}

export interface WhatIfResult {
  currentBalance: number;
  projectedBalance: number;
  afterBalance: number;
  afterProjected: number;
  riskLevel: 'safe' | 'caution' | 'danger';
  riskKey: string;
  labelKey: string;
  labelParams?: Record<string, string | number>;
}

const DISCRETIONARY_CATS = ['entertainment', 'other'];

export const MIN_HISTORY_DAYS = 4;

export function spendingVelocity(transactions: Transaction[], referenceDate: string = todayISO()): number {
  const expenses = transactions.filter(
    (t) => t.type === 'expense' && !isFuture(t.date, referenceDate)
  );
  if (expenses.length === 0) return 0;
  const discretionary = expenses.filter((t) => DISCRETIONARY_CATS.includes(t.category));
  if (discretionary.length === 0) return 0;

  const distinctDays = new Set(discretionary.map((t) => t.date));
  const dates = discretionary.map((t) => t.date).sort();
  const earliest = dates[0];
  const elapsed = Math.max(1, daysBetween(earliest, referenceDate));

  if (elapsed < MIN_HISTORY_DAYS || distinctDays.size < 2) return 0;

  const totalDiscretionary = discretionary.reduce((s, t) => s + t.amount, 0);
  return totalDiscretionary / elapsed;
}

export function computeForecast(
  transactions: Transaction[],
  payday: string,
  savings: SavingsGoal,
  referenceDate: string = todayISO()
): Forecast {
  if (!payday) {
    return {
      hasData: false,
      hasPayday: false,
      projectedBalance: 0,
      projectedSafeSpend: 0,
      onTrack: false,
      potentialShortfall: 0,
      explanation: 'forecast.noPayday',
    };
  }

  // Resolve next payday: if payday is today or in the past, advance by months
  const nextPayday = resolveNextPayday(payday, referenceDate);

  // Need at least one transaction on or before the reference date to
  // establish a meaningful balance.
  const hasHistorical = transactions.some((t) => t.date <= referenceDate);
  if (!hasHistorical) {
    return {
      hasData: false,
      hasPayday: true,
      projectedBalance: 0,
      projectedSafeSpend: 0,
      onTrack: true,
      potentialShortfall: 0,
      explanation: 'forecast.insufficientData',
    };
  }

  // Step 1: Start from the committed balance as of the reference date.
  // This includes ALL transactions (paid and unpaid) dated on or before today,
  // so unpaid items that are already due are reflected. Only transactions
  // strictly after the reference date are projected forward in step 2.
  const currentBalance = committedBalanceAsOf(transactions, referenceDate);

  // Step 2: Apply each eligible future transaction once, by date, through payday.
  // This includes both one-off future transactions and recurring occurrences.
  // No velocity estimation — only concrete scheduled items.
  const scheduled = scheduledItemsThrough(transactions, referenceDate, nextPayday);
  let projectedBalance = currentBalance;
  for (const item of scheduled) {
    if (item.type === 'income') {
      projectedBalance += item.amount;
    } else {
      projectedBalance -= item.amount;
    }
  }

  const projectedSafeSpend = Math.max(0, projectedBalance);
  const potentialShortfall = projectedBalance < 0 ? Math.abs(projectedBalance) : 0;
  const onTrack = projectedBalance >= 0;

  return {
    hasData: true,
    hasPayday: true,
    projectedBalance,
    projectedSafeSpend,
    onTrack,
    potentialShortfall,
    explanation: onTrack ? 'forecast.onTrackExplain' : 'forecast.shortfallExplain',
  };
}

export function generateInsights(
  transactions: Transaction[],
  totals: Totals,
  targets: BudgetTarget[],
  savings: SavingsGoal,
  referenceDate: string = todayISO()
): Insight[] {
  const insights: Insight[] = [];
  const catMap = expenseByCategory(transactions);

  for (const target of targets) {
    const spent = catMap.get(target.category) ?? 0;
    if (target.limit > 0 && spent > target.limit) {
      const pctOver = ((spent - target.limit) / target.limit) * 100;
      insights.push({
        id: `over-${target.category}`,
        title: 'insight.overCategory',
        body: 'insight.overCategoryBody',
        tone: 'warn',
        params: { category: target.category, pct: pctOver.toFixed(0), spent: String(spent), limit: String(target.limit) },
      });
    }
  }

  const velocity = spendingVelocity(transactions, referenceDate);
  if (velocity > 0 && totals.dailyGuide > 0 && velocity > totals.dailyGuide) {
    insights.push({
      id: 'velocity-high',
      title: 'insight.spendingFast',
      body: 'insight.spendingFastBody',
      tone: 'warn',
      params: { velocity: velocity.toFixed(2), daily: totals.dailyGuide.toFixed(2) },
    });
  } else if (velocity === 0) {
    const pastDiscretionary = transactions.filter(
      (t) => t.type === 'expense' && DISCRETIONARY_CATS.includes(t.category) && !isFuture(t.date, referenceDate)
    );
    if (pastDiscretionary.length > 0) {
      insights.push({
        id: 'velocity-insufficient',
        title: 'insight.spendingFast',
        body: 'insight.spendingInsufficientHistory',
        tone: 'info',
      });
    }
  }

  if (totals.shortfall > 0) {
    insights.push({
      id: 'insufficient-essentials',
      title: 'insight.insufficientEssentials',
      body: 'insight.insufficientEssentialsBody',
      tone: 'warn',
      params: { shortfall: String(totals.shortfall) },
    });
  }

  if (savings.targetAmount > 0 && savings.monthlyContribution > 0) {
    const remaining = savings.targetAmount - savings.currentAmount;
    const monthsToGoal = Math.ceil(remaining / savings.monthlyContribution);
    if (remaining > 0 && monthsToGoal > 12) {
      insights.push({
        id: 'savings-behind',
        title: 'insight.savingsBehind',
        body: 'insight.savingsBehindBody',
        tone: 'info',
        params: { months: String(monthsToGoal) },
      });
    }
  }

  if (savings.targetAmount > 0 && savings.monthlyContribution > 0) {
    const remaining = savings.targetAmount - savings.currentAmount;
    const monthsToGoal = Math.ceil(remaining / savings.monthlyContribution);
    if (remaining > 0 && monthsToGoal <= 12 && totals.shortfall === 0) {
      insights.push({
        id: 'savings-on-track',
        title: 'insight.savingsOnTrack',
        body: 'insight.savingsOnTrackBody',
        tone: 'good',
        params: { months: String(monthsToGoal) },
      });
    }
  }

  const discretionary = DISCRETIONARY_CATS.reduce((s, c) => s + (catMap.get(c) ?? 0), 0);
  if (totals.totalIncome > 0 && discretionary / totals.totalIncome < 0.1 && totals.shortfall === 0) {
    insights.push({
      id: 'positive-spending',
      title: 'insight.positiveSpending',
      body: 'insight.positiveSpendingBody',
      tone: 'good',
    });
  }

  return insights.slice(0, 3);
}

export function checkAffordability(
  amount: number,
  totals: Totals,
  payday: string
): AffordabilityResult {
  if (!payday || totals.safeToSpend <= 0) {
    return {
      verdict: 'notRecommended',
      title: 'afford.notRecommended',
      explanation: 'afford.notRecommendedNoSafe',
    };
  }

  const afterPurchase = totals.safeToSpend - amount;
  const ratio = amount / totals.safeToSpend;
  const dUntilPayday = totals.daysUntilPayday;
  const dailyAfter = Math.max(0, afterPurchase) / Math.max(1, dUntilPayday);

  if (afterPurchase < 0) {
    return {
      verdict: 'notRecommended',
      title: 'afford.notRecommended',
      explanation: 'afford.notRecommendedExplain',
    };
  }

  if (ratio > 0.5 || dailyAfter < 30) {
    return {
      verdict: 'careful',
      title: 'afford.careful',
      explanation: 'afford.carefulExplain',
    };
  }

  return {
    verdict: 'affordable',
    title: 'afford.affordable',
    explanation: 'afford.affordableExplain',
  };
}

// ===== Financial Health Score =====

export function computeHealthScore(
  transactions: Transaction[],
  totals: Totals,
  targets: BudgetTarget[],
  savings: SavingsGoal,
  forecast: Forecast
): HealthScore {
  const catMap = expenseByCategory(transactions);
  const factors: HealthFactor[] = [];

  // 1. Spending control (0-20): discretionary spending as % of income
  const discretionary = DISCRETIONARY_CATS.reduce((s, c) => s + (catMap.get(c) ?? 0), 0);
  let spendingScore: number;
  let spendingStatus: 'good' | 'warn' | 'bad';
  if (totals.totalIncome > 0) {
    const ratio = discretionary / totals.totalIncome;
    if (ratio < 0.1) { spendingScore = 20; spendingStatus = 'good'; }
    else if (ratio < 0.2) { spendingScore = 15; spendingStatus = 'good'; }
    else if (ratio < 0.3) { spendingScore = 10; spendingStatus = 'warn'; }
    else { spendingScore = 5; spendingStatus = 'bad'; }
  } else {
    spendingScore = 10; spendingStatus = 'warn';
  }
  factors.push({
    key: 'spending',
    labelKey: 'health.spendingControl',
    score: spendingScore,
    maxScore: 20,
    status: spendingStatus,
    detailKey: spendingStatus === 'good' ? 'health.spendingGood' : spendingStatus === 'warn' ? 'health.spendingWarn' : 'health.spendingBad',
    detailParams: { pct: totals.totalIncome > 0 ? ((discretionary / totals.totalIncome) * 100).toFixed(0) : '0' },
  });

  // 2. Essential expense coverage (0-20): can available cover unpaid essentials?
  let essentialScore: number;
  let essentialStatus: 'good' | 'warn' | 'bad';
  if (totals.essentialUnpaid === 0) {
    essentialScore = 20; essentialStatus = 'good';
  } else if (totals.available >= totals.essentialUnpaid * 1.5) {
    essentialScore = 18; essentialStatus = 'good';
  } else if (totals.available >= totals.essentialUnpaid) {
    essentialScore = 12; essentialStatus = 'warn';
  } else {
    essentialScore = 4; essentialStatus = 'bad';
  }
  factors.push({
    key: 'essential',
    labelKey: 'health.essentialCoverage',
    score: essentialScore,
    maxScore: 20,
    status: essentialStatus,
    detailKey: essentialStatus === 'good' ? 'health.essentialGood' : essentialStatus === 'warn' ? 'health.essentialWarn' : 'health.essentialBad',
    detailParams: { amt: totals.essentialUnpaid.toFixed(2) },
  });

  // 3. Savings progress (0-20): current vs target
  let savingsScore: number;
  let savingsStatus: 'good' | 'warn' | 'bad';
  if (savings.targetAmount > 0) {
    const pct = (savings.currentAmount / savings.targetAmount) * 100;
    if (pct >= 75) { savingsScore = 20; savingsStatus = 'good'; }
    else if (pct >= 40) { savingsScore = 15; savingsStatus = 'good'; }
    else if (pct >= 15) { savingsScore = 10; savingsStatus = 'warn'; }
    else { savingsScore = 5; savingsStatus = 'bad'; }
  } else {
    savingsScore = 8; savingsStatus = 'warn';
  }
  factors.push({
    key: 'savings',
    labelKey: 'health.savingsProgress',
    score: savingsScore,
    maxScore: 20,
    status: savingsStatus,
    detailKey: savingsStatus === 'good' ? 'health.savingsGood' : savingsStatus === 'warn' ? 'health.savingsWarn' : 'health.savingsBad',
    detailParams: {
      current: savings.currentAmount.toFixed(0),
      target: savings.targetAmount.toFixed(0),
      pct: savings.targetAmount > 0 ? ((savings.currentAmount / savings.targetAmount) * 100).toFixed(0) : '0',
    },
  });

  // 4. Payday safety (0-20): projected balance by payday
  let paydayScore: number;
  let paydayStatus: 'good' | 'warn' | 'bad';
  if (!forecast.hasPayday || !forecast.hasData) {
    paydayScore = 10; paydayStatus = 'warn';
  } else if (forecast.projectedBalance > totals.totalIncome * 0.2) {
    paydayScore = 20; paydayStatus = 'good';
  } else if (forecast.projectedBalance > 0) {
    paydayScore = 14; paydayStatus = 'warn';
  } else {
    paydayScore = 3; paydayStatus = 'bad';
  }
  factors.push({
    key: 'payday',
    labelKey: 'health.paydaySafety',
    score: paydayScore,
    maxScore: 20,
    status: paydayStatus,
    detailKey: paydayStatus === 'good' ? 'health.paydayGood' : paydayStatus === 'warn' ? 'health.paydayWarn' : 'health.paydayBad',
    detailParams: forecast.hasData ? { amt: forecast.projectedBalance.toFixed(2) } : {},
  });

  // 5. Budget adherence (0-20): categories within limits
  const activeTargets = targets.filter((t) => t.limit > 0);
  let budgetScore: number;
  let budgetStatus: 'good' | 'warn' | 'bad';
  if (activeTargets.length === 0) {
    budgetScore = 10; budgetStatus = 'warn';
  } else {
    const withinCount = activeTargets.filter((t) => (catMap.get(t.category) ?? 0) <= t.limit).length;
    const ratio = withinCount / activeTargets.length;
    if (ratio >= 0.8) { budgetScore = 20; budgetStatus = 'good'; }
    else if (ratio >= 0.5) { budgetScore = 12; budgetStatus = 'warn'; }
    else { budgetScore = 4; budgetStatus = 'bad'; }
  }
  factors.push({
    key: 'budget',
    labelKey: 'health.budgetAdherence',
    score: budgetScore,
    maxScore: 20,
    status: budgetStatus,
    detailKey: budgetStatus === 'good' ? 'health.budgetGood' : budgetStatus === 'warn' ? 'health.budgetWarn' : 'health.budgetBad',
    detailParams: { within: String(activeTargets.filter((t) => (catMap.get(t.category) ?? 0) <= t.limit).length), total: String(activeTargets.length) },
  });

  const total = factors.reduce((s, f) => s + f.score, 0);

  let summaryKey: string;
  const summaryParams = { score: String(total) };
  if (total >= 80) summaryKey = 'health.summaryGreat';
  else if (total >= 60) summaryKey = 'health.summaryGood';
  else if (total >= 40) summaryKey = 'health.summaryFair';
  else summaryKey = 'health.summaryPoor';

  return { score: total, maxScore: 100, factors, summaryKey, summaryParams };
}

// ===== Next Best Action =====

export function computeNextBestAction(
  totals: Totals,
  savings: SavingsGoal,
  transactions: Transaction[],
  targets: BudgetTarget[],
  forecast: Forecast
): NextBestAction | null {
  const catMap = expenseByCategory(transactions);

  // 1. If projected balance is negative, suggest reducing top discretionary category
  if (forecast.hasData && forecast.projectedBalance < 0) {
    const overTargets = targets
      .filter((t) => t.limit > 0 && (catMap.get(t.category) ?? 0) > t.limit)
      .map((t) => ({ cat: t.category, over: (catMap.get(t.category) ?? 0) - t.limit }))
      .sort((a, b) => b.over - a.over);

    if (overTargets.length > 0) {
      const top = overTargets[0];
      const reduction = top.over;
      return {
        actionKey: 'nba.reduceCategory',
        actionParams: { category: top.cat, amt: reduction.toFixed(0) },
        impactKey: 'nba.reduceImpact',
        impactParams: {
          current: forecast.projectedBalance.toFixed(0),
          after: (forecast.projectedBalance + reduction).toFixed(0),
        },
      };
    }

    // No specific category over budget — suggest reducing discretionary overall
    const discretionary = DISCRETIONARY_CATS.reduce((s, c) => s + (catMap.get(c) ?? 0), 0);
    if (discretionary > 0) {
      const reduction = Math.min(discretionary, Math.abs(forecast.projectedBalance) + 100);
      return {
        actionKey: 'nba.reduceDiscretionary',
        actionParams: { amt: reduction.toFixed(0) },
        impactKey: 'nba.reduceImpact',
        impactParams: {
          current: forecast.projectedBalance.toFixed(0),
          after: (forecast.projectedBalance + reduction).toFixed(0),
        },
      };
    }
  }

  // 2. If shortfall exists, suggest reducing non-essentials
  if (totals.shortfall > 0) {
    return {
      actionKey: 'nba.coverShortfall',
      actionParams: { amt: totals.shortfall.toFixed(0) },
      impactKey: 'nba.coverImpact',
      impactParams: { amt: totals.shortfall.toFixed(0) },
    };
  }

  // 3. If on track, suggest adding to savings
  if (forecast.hasData && forecast.projectedBalance > 0 && savings.targetAmount > 0) {
    const remaining = savings.targetAmount - savings.currentAmount;
    if (remaining > 0 && totals.safeToSpend > 100) {
      const extraSave = Math.min(100, totals.safeToSpend * 0.1);
      return {
        actionKey: 'nba.addSavings',
        actionParams: { amt: extraSave.toFixed(0) },
        impactKey: 'nba.addSavingsImpact',
        impactParams: {
          current: savings.currentAmount.toFixed(0),
          after: (savings.currentAmount + extraSave).toFixed(0),
        },
      };
    }
  }

  // 4. If a category is over budget but overall on track
  const overCats = targets
    .filter((t) => t.limit > 0 && (catMap.get(t.category) ?? 0) > t.limit)
    .sort((a, b) => ((catMap.get(b.category) ?? 0) - b.limit) - ((catMap.get(a.category) ?? 0) - a.limit));
  if (overCats.length > 0) {
    const top = overCats[0];
    const overspend = (catMap.get(top.category) ?? 0) - top.limit;
    return {
      actionKey: 'nba.reduceCategory',
      actionParams: { category: top.category, amt: overspend.toFixed(0) },
      impactKey: 'nba.budgetImpact',
      impactParams: { category: top.category },
    };
  }

  return null;
}

// ===== What If scenarios =====

export function simulateWhatIf(
  type: 'spend' | 'saveMore' | 'reduceCategory',
  amount: number,
  category: string | null,
  totals: Totals,
  savings: SavingsGoal,
  transactions: Transaction[],
  payday: string,
  referenceDate: string = todayISO()
): WhatIfResult {
  const forecast = computeForecast(transactions, payday, savings, referenceDate);
  const currentBalance = totals.available;
  const projectedBalance = forecast.hasData ? forecast.projectedBalance : totals.available;

  let afterBalance: number;
  let afterProjected: number;
  let labelKey: string;
  let labelParams: Record<string, string | number> = {};

  if (type === 'spend') {
    afterBalance = currentBalance - amount;
    afterProjected = projectedBalance - amount;
    labelKey = 'whatif.spendLabel';
    labelParams = { amt: amount };
  } else if (type === 'saveMore') {
    afterBalance = currentBalance - amount;
    afterProjected = projectedBalance - amount;
    labelKey = 'whatif.saveLabel';
    labelParams = { amt: amount };
  } else {
    afterBalance = currentBalance + amount;
    afterProjected = projectedBalance + amount;
    labelKey = 'whatif.reduceLabel';
    labelParams = { amt: amount, category: category ?? '' };
  }

  let riskLevel: 'safe' | 'caution' | 'danger';
  let riskKey: string;

  if (afterProjected < 0) {
    riskLevel = 'danger';
    riskKey = 'whatif.riskDanger';
  } else if (afterProjected < currentBalance * 0.15) {
    riskLevel = 'caution';
    riskKey = 'whatif.riskCaution';
  } else {
    riskLevel = 'safe';
    riskKey = 'whatif.riskSafe';
  }

  return {
    currentBalance,
    projectedBalance,
    afterBalance,
    afterProjected,
    riskLevel,
    riskKey,
    labelKey,
    labelParams,
  };
}

// ===== Responsible-credit repayment estimator =====
// Monthly amortization estimate. Assumes a fixed rate and debt payment;
// optional monthly fees are charged separately and included in total paid.
// For education only, not a lending decision or financial advice.

export interface RepaymentResult {
  months: number | null;
  totalInterest: number | null;
  totalPaid: number | null;
  verdict: 'ok' | 'tooSmall' | 'tooLong' | 'invalid';
  monthlyInterest: number;
}

export function estimateRepayment(
  balance: number,
  annualInterestRate: number, // percent, e.g. 24 for 24%
  monthlyPayment: number,
  monthlyFees = 0
): RepaymentResult {
  if (
    !Number.isFinite(balance) || balance <= 0 ||
    !Number.isFinite(annualInterestRate) || annualInterestRate < 0 ||
    !Number.isFinite(monthlyPayment) || monthlyPayment <= 0 ||
    !Number.isFinite(monthlyFees) || monthlyFees < 0
  ) {
    return { months: null, totalInterest: null, totalPaid: null, verdict: 'invalid', monthlyInterest: 0 };
  }

  const monthlyRate = annualInterestRate / 100 / 12;
  const monthlyInterest = balance * monthlyRate;
  if (monthlyPayment <= monthlyInterest) {
    return { months: null, totalInterest: null, totalPaid: null, verdict: 'tooSmall', monthlyInterest };
  }

  // Monthly fees are an extra cash cost and do not reduce the debt balance.
  // Simulate each statement so the final payment is not overstated.
  let remaining = balance;
  let months = 0;
  let totalInterest = 0;
  let totalPaid = 0;
  while (remaining > 0 && months < 1200) {
    const interest = remaining * monthlyRate;
    if (monthlyPayment <= interest) {
      return { months: null, totalInterest: null, totalPaid: null, verdict: 'tooSmall', monthlyInterest: interest };
    }
    const principalPaid = Math.min(remaining, monthlyPayment - interest);
    const debtPayment = interest + principalPaid;
    remaining = Math.max(0, remaining - principalPaid);
    totalInterest += interest;
    totalPaid += debtPayment + monthlyFees;
    months += 1;
  }

  if (remaining > 0) {
    return { months: null, totalInterest: null, totalPaid: null, verdict: 'tooLong', monthlyInterest };
  }

  return { months, totalInterest, totalPaid, verdict: 'ok', monthlyInterest };
}

// ===== Advisor with improved NLU =====

export interface AdvisorResponse {
  answer: string;
  params?: Record<string, string | number>;
}

interface ParsedIntent {
  intent: 'afford' | 'spendToday' | 'overspending' | 'runOut' | 'savings' | 'reduce' | 'whatif' | 'general';
  amount?: number;
  item?: string;
  category?: string;
}

function extractAmount(text: string): number | undefined {
  // Match R500, r500, R 500, 500 rand, 500, R1,234 etc.
  const patterns = [
    /r\s*\$?\s*(\d[\d,.\s]*)/i,
    /(\d[\d,.\s]*)\s*rand/i,
    /(\d[\d,.\s]*)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const num = parseFloat(m[1].replace(/[,\s]/g, ''));
      if (num > 0) return num;
    }
  }
  return undefined;
}

function extractItem(text: string): string | undefined {
  // Try to find the item being discussed after amount or keywords
  const affordMatch = text.match(/(?:afford|buy|spend|get|purchase)\s+(?:r?\s*\d+\s*(?:for|on)\s+)?(.+)/i);
  if (affordMatch && affordMatch[1]) {
    return affordMatch[1].trim().replace(/[?.!]+$/, '');
  }
  // "R800 shoes" pattern
  const amountItem = text.match(/r?\s*\d+\s+(?:for\s+)?(.+)/i);
  if (amountItem && amountItem[1]) {
    return amountItem[1].trim().replace(/[?.!]+$/, '');
  }
  return undefined;
}

function parseIntent(question: string): ParsedIntent {
  const q = question.toLowerCase().trim();
  const amount = extractAmount(q);
  const item = extractItem(q);

  // Affordability intent — many phrasings
  const affordKeywords = ['afford', 'buy', 'should i get', 'should i buy', 'is it okay', 'is it safe',
    'can i', 'worth it', 'smart to', 'stupid to', 'wise to', 'okay to', 'alright to',
    'i wanna', 'i want to', 'thinking about', 'looking at', 'considering'];
  const affordPhrases = ['can i afford', 'would buying', 'is it stupid', 'is it dumb',
    'should i spend', 'can i spend', 'i wanna spend', 'i want to spend',
    'is it a good idea', 'make sense to', 'is it worth'];

  if (affordPhrases.some((p) => q.includes(p)) || (affordKeywords.some((k) => q.includes(k)) && amount)) {
    return { intent: 'afford', amount, item };
  }

  // What-if intent
  if (q.includes('what if') || q.includes('what happens if')) {
    if (q.includes('save') && (q.includes('more') || q.includes('extra'))) {
      return { intent: 'whatif', amount, category: 'save' };
    }
    if (q.includes('reduce') || q.includes('cut') || q.includes('less')) {
      // Try to find category
      const catMatch = q.match(/(?:reduce|cut|less)\s+(?:on\s+)?(.+)/);
      return { intent: 'whatif', amount, category: catMatch?.[1] };
    }
    if (q.includes('spend')) {
      return { intent: 'whatif', amount, category: 'spend' };
    }
    return { intent: 'whatif', amount };
  }

  // Spend today
  if (q.includes('spend today') || q.includes('how much can i spend') || q.includes('how much today')) {
    return { intent: 'spendToday', amount };
  }

  // Overspending
  if (q.includes('overspend') || q.includes('too much') || q.includes('over budget') || q.includes('spending too much')) {
    return { intent: 'overspending' };
  }

  // Running out
  if (q.includes('run out') || q.includes('running out') || q.includes('no money') || q.includes('disappear') || q.includes('running low') || q.includes('going broke')) {
    return { intent: 'runOut' };
  }

  // Savings
  if (q.includes('savings') || q.includes('save') || q.includes('goal') || q.includes('how long until')) {
    return { intent: 'savings' };
  }

  // Reduce
  if (q.includes('reduce') || q.includes('cut') || q.includes('where') || q.includes('what should') || q.includes('trim') || q.includes('save money on')) {
    return { intent: 'reduce' };
  }

  return { intent: 'general', amount, item };
}

export function localAdvisor(
  question: string,
  totals: Totals,
  savings: SavingsGoal,
  transactions: Transaction[],
  payday: string
): AdvisorResponse {
  const expenseTxns = transactions.filter((t) => t.type === 'expense');
  if (expenseTxns.length === 0) {
    return { answer: 'adv.noData' };
  }

  const parsed = parseIntent(question);

  switch (parsed.intent) {
    case 'afford': {
      if (parsed.amount && parsed.amount > 0) {
        const result = checkAffordability(parsed.amount, totals, payday);
        return {
          answer: result.explanation,
          params: {
            amount: String(parsed.amount),
            safeBefore: String(totals.safeToSpend.toFixed(2)),
            safeAfter: String(Math.max(0, totals.safeToSpend - parsed.amount).toFixed(2)),
            days: String(totals.daysUntilPayday),
          },
        };
      }
      return {
        answer: 'adv.spendToday',
        params: {
          safe: String(totals.safeToSpend.toFixed(2)),
          daily: String(totals.dailyGuide.toFixed(2)),
          days: String(totals.daysUntilPayday),
        },
      };
    }

    case 'whatif': {
      if (parsed.amount && parsed.amount > 0) {
        const sim = simulateWhatIf(
          parsed.category === 'spend' ? 'spend' : parsed.category === 'save' ? 'saveMore' : 'reduceCategory',
          parsed.amount,
          parsed.category ?? null,
          totals,
          savings,
          transactions,
          payday
        );
        return {
          answer: 'adv.whatIfResult',
          params: {
            scenario: sim.labelKey,
            currentProjected: sim.projectedBalance.toFixed(0),
            afterProjected: sim.afterProjected.toFixed(0),
            risk: sim.riskKey,
            amt: parsed.amount,
          },
        };
      }
      return {
        answer: 'adv.spendToday',
        params: {
          safe: String(totals.safeToSpend.toFixed(2)),
          daily: String(totals.dailyGuide.toFixed(2)),
          days: String(totals.daysUntilPayday),
        },
      };
    }

    case 'spendToday': {
      return {
        answer: 'adv.spendToday',
        params: {
          safe: String(totals.safeToSpend.toFixed(2)),
          daily: String(totals.dailyGuide.toFixed(2)),
          days: String(totals.daysUntilPayday),
        },
      };
    }

    case 'overspending': {
      return {
        answer: 'adv.overspending',
        params: {
          daily: String(totals.dailyGuide.toFixed(2)),
          shortfall: String(totals.shortfall.toFixed(2)),
        },
      };
    }

    case 'runOut': {
      return {
        answer: 'adv.runOut',
        params: {
          essentialUnpaid: String(totals.essentialUnpaid.toFixed(2)),
          discretionary: String(getDiscretionaryTotal(transactions).toFixed(2)),
          safe: String(totals.safeToSpend.toFixed(2)),
        },
      };
    }

    case 'savings': {
      const remaining = Math.max(0, savings.targetAmount - savings.currentAmount);
      const months = savings.monthlyContribution > 0 ? Math.ceil(remaining / savings.monthlyContribution) : 0;
      return {
        answer: 'adv.savings',
        params: {
          current: String(savings.currentAmount.toFixed(2)),
          target: String(savings.targetAmount.toFixed(2)),
          remaining: String(remaining.toFixed(2)),
          contribution: String(savings.monthlyContribution.toFixed(2)),
          months: String(months),
        },
      };
    }

    case 'reduce': {
      const catMap = expenseByCategory(transactions);
      const discretionary = DISCRETIONARY_CATS.map((c) => ({ cat: c, amt: catMap.get(c) ?? 0 }))
        .sort((a, b) => b.amt - a.amt);
      const top = discretionary[0];
      return {
        answer: 'adv.reduce',
        params: {
          topCat: top?.cat ?? 'entertainment',
          topAmt: String((top?.amt ?? 0).toFixed(2)),
          safe: String(totals.safeToSpend.toFixed(2)),
        },
      };
    }

    default: {
      return {
        answer: 'adv.general',
        params: {
          safe: String(totals.safeToSpend.toFixed(2)),
          daily: String(totals.dailyGuide.toFixed(2)),
          days: String(totals.daysUntilPayday),
        },
      };
    }
  }
}

function getDiscretionaryTotal(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.type === 'expense' && DISCRETIONARY_CATS.includes(t.category))
    .reduce((s, t) => s + t.amount, 0);
}

function isFuture(dateISO: string, refISO: string): boolean {
  return dateISO > refISO;
}

function daysBetween(startISO: string, endISO: string): number {
  const a = new Date(startISO + 'T00:00:00').getTime();
  const b = new Date(endISO + 'T00:00:00').getTime();
  return Math.round((b - a) / 86400000);
}
