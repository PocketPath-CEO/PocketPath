import { useState } from 'react';
import { CalendarClock, Banknote, Target, Trash2, AlertTriangle, Info } from 'lucide-react';
import { useApp } from '../AppContext';
import { useI18n } from '../i18n/I18nContext';
import { Card, Button, Badge, ProgressBar, cn } from '../components/ui';
import { CATEGORIES, EXPENSE_CATEGORY_IDS } from '../categories';
import { formatRands, formatDate, todayISO } from '../lib/format';
import { breakdown } from '../lib/calculations';
import type { CategoryId, Settings } from '../types';

export function Budget() {
  const { data, totals, updateSettings, setTargets, deleteTransaction } = useApp();
  const { t, simpleMode } = useI18n();
  const [income, setIncome] = useState(String(data.settings.monthlyIncome || ''));
  const [payday, setPayday] = useState(data.settings.payday || todayISO());
  const [savedMsg, setSavedMsg] = useState(false);

  const { items } = breakdown(data.transactions);
  const spendByCat = new Map(items.map((i) => [i.category, i.amount]));

  function saveSettings() {
    const amt = parseFloat(income) || 0;
    const patch: Partial<Settings> = { monthlyIncome: amt, payday };
    updateSettings(patch);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  }

  function updateTargetLimit(cat: CategoryId, limit: number) {
    const existing = data.targets.find((t) => t.category === cat);
    if (existing) {
      setTargets(data.targets.map((t) => (t.category === cat ? { ...t, limit } : t)));
    } else {
      setTargets([...data.targets, { category: cat, limit }]);
    }
  }

  function removeTarget(cat: CategoryId) {
    setTargets(data.targets.filter((t) => t.category !== cat));
  }

  const essentialUnpaid = data.transactions.filter(
    (t) => t.type === 'expense' && t.essential && !t.paid
  );

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
          {t('budget.title')}
        </h1>
        <p className="text-navy-500 text-sm mt-1">{t('budget.subtitle')}</p>
      </header>

      {/* Income & payday */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Banknote size={18} className="text-mint-600" />
          <h2 className="font-bold text-navy-800">{t('budget.incomePayday')}</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-navy-700 mb-1.5">
              {t('budget.expectedIncome')}
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              placeholder="9500"
              className={inputCls}
            />
            <p className="text-xs text-navy-400 mt-1">{t('budget.incomeHint')}</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy-700 mb-1.5">
              {t('budget.nextPayday')}
            </label>
            <input
              type="date"
              value={payday}
              onChange={(e) => setPayday(e.target.value)}
              className={inputCls}
            />
            <p className="text-xs text-navy-400 mt-1 flex items-center gap-1">
              <CalendarClock size={12} /> {t('budget.daysFromToday', { days: totals.daysUntilPayday })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <Button onClick={saveSettings}>{t('budget.saveSettings')}</Button>
          {savedMsg && <span className="text-mint-600 text-sm font-semibold">{t('budget.saved')}</span>}
        </div>
      </Card>

      {/* Safe-to-spend summary */}
      <Card className="bg-navy-50 border-navy-100">
        <h2 className="font-bold text-navy-800 mb-3">
          {simpleMode ? t('budget.breakdownSimple') : t('budget.breakdown')}
        </h2>
        <div className="space-y-2 text-sm">
          <Row label={t('budget.incomeReceivedPending')} value={formatRands(totals.totalIncome)} />
          <Row label={t('budget.paidExpenses')} value={`− ${formatRands(totals.expensesPaid)}`} />
          <Row label={t('budget.unpaidExpenses')} value={`− ${formatRands(totals.expensesUnpaid)}`} />
          <div className="border-t border-navy-100 my-1" />
          <Row
            label={simpleMode ? t('budget.availableBalanceSimple') : t('budget.availableBalance')}
            value={formatRands(totals.available)}
            bold
          />
          <Row label={t('budget.unpaidEssentials')} value={`− ${formatRands(totals.essentialUnpaid)}`} />
          <Row label={t('budget.plannedSavings')} value={`− ${formatRands(totals.plannedSavings)}`} />
          <div className="border-t border-navy-100 my-1" />
          <Row
            label={simpleMode ? t('budget.safeToSpendSimple') : t('budget.safeToSpend')}
            value={formatRands(totals.safeToSpend)}
            bold
            highlight
          />
          <Row
            label={simpleMode ? t('budget.dailyGuideSimple', { days: totals.daysUntilPayday }) : t('budget.dailyGuide', { days: totals.daysUntilPayday })}
            value={formatRands(totals.dailyGuide)}
          />
        </div>
        {totals.shortfall > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 text-red-700 px-3 py-2.5 text-sm">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{t('budget.shortfallMsg', { amt: formatRands(totals.shortfall) })}</span>
          </div>
        )}
      </Card>

      {/* Unpaid essential expenses */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-mint-600" />
            <h2 className="font-bold text-navy-800">{t('budget.essentialUpcoming')}</h2>
          </div>
          <Badge tone="navy">{t('budget.unpaidCount', { count: essentialUnpaid.length })}</Badge>
        </div>
        {essentialUnpaid.length === 0 ? (
          <div className="rounded-xl border border-dashed border-navy-100 px-4 py-6 text-center text-sm text-navy-400">
            {t('budget.noUnpaidEssentials')}
          </div>
        ) : (
          <div className="space-y-2">
            {essentialUnpaid.map((txn) => {
              const cat = CATEGORIES[txn.category];
              return (
                <div key={txn.id} className="flex items-center gap-3 rounded-xl bg-navy-50 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-navy-800 text-sm truncate">{txn.description}</div>
                    <div className="text-xs text-navy-400 mt-0.5">
                      {t(cat.tKey)} · {formatDate(txn.date)}
                    </div>
                  </div>
                  <span className="font-bold text-navy-800 text-sm">{formatRands(txn.amount)}</span>
                  <button
                    onClick={() => deleteTransaction(txn.id)}
                    className="p-1.5 rounded-lg text-navy-300 hover:text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200"
                    aria-label={t('txn.delete')}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
            <div className="flex items-start gap-2 text-xs text-navy-400 mt-2">
              <Info size={14} className="mt-0.5 shrink-0" />
              {t('budget.essentialHint')}
            </div>
          </div>
        )}
      </Card>

      {/* Category budgets */}
      <Card>
        <h2 className="font-bold text-navy-800 mb-1">{t('budget.categoryLimits')}</h2>
        <p className="text-sm text-navy-400 mb-4">{t('budget.categoryLimitsHint')}</p>
        <div className="space-y-3">
          {EXPENSE_CATEGORY_IDS.map((id) => {
            const cat = CATEGORIES[id];
            const Icon = cat.icon;
            const target = data.targets.find((tgt) => tgt.category === id);
            const spent = spendByCat.get(id) ?? 0;
            const limit = target?.limit ?? 0;
            const over = limit > 0 && spent > limit;
            return (
              <div key={id} className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-navy-50 flex items-center justify-center text-navy-600 shrink-0">
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-semibold text-navy-700">{t(cat.tKey)}</span>
                    <div className="flex items-center gap-2">
                      <span className={cn('text-xs font-medium', over ? 'text-red-600' : 'text-navy-400')}>
                        {formatRands(spent)}
                        {limit > 0 && ` / ${formatRands(limit)}`}
                      </span>
                      {target && (
                        <button
                          onClick={() => removeTarget(id)}
                          className="text-navy-300 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-200 rounded"
                          aria-label={t('budget.removeLimit')}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <ProgressBar
                      value={spent}
                      max={limit || 1}
                      barClassName={over ? 'bg-red-500' : 'bg-mint-500'}
                      className="flex-1"
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder={t('budget.limit')}
                      value={target ? String(target.limit) : ''}
                      onChange={(e) => updateTargetLimit(id, parseFloat(e.target.value) || 0)}
                      className="w-20 rounded-lg border border-navy-100 px-2 py-1 text-xs text-navy-700 focus:outline-none focus:ring-2 focus:ring-mint-300"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  highlight,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className={cn('text-navy-600', bold && 'font-bold text-navy-800')}>{label}</span>
      <span className={cn('font-medium', bold && 'font-extrabold', highlight ? 'text-mint-700' : 'text-navy-700')}>
        {value}
      </span>
    </div>
  );
}

const inputCls =
  'w-full rounded-xl border border-navy-100 px-3 py-2.5 text-navy-800 focus:outline-none focus:ring-2 focus:ring-mint-300 focus:border-mint-300 transition-colors';
