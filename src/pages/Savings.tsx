import { useState } from 'react';
import { PiggyBank, Target, TrendingUp, Plus, Minus } from 'lucide-react';
import { useApp } from '../AppContext';
import { useI18n } from '../i18n/I18nContext';
import { Card, Button, ProgressBar } from '../components/ui';
import { Modal } from '../components/Modal';
import { formatRands } from '../lib/format';

export function Savings() {
  const { data, updateSavings } = useApp();
  const { t } = useI18n();
  const { savings } = data;
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);

  const pct =
    savings.targetAmount > 0
      ? Math.min(100, (savings.currentAmount / savings.targetAmount) * 100)
      : 0;
  const remaining = Math.max(0, savings.targetAmount - savings.currentAmount);
  const monthsToGoal =
    savings.monthlyContribution > 0 && remaining > 0
      ? Math.ceil(remaining / savings.monthlyContribution)
      : 0;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
          {t('sav.title')}
        </h1>
        <p className="text-navy-500 text-sm mt-1">{t('sav.subtitle')}</p>
      </header>

      {/* Goal hero */}
      <Card className="bg-navy-900 text-white border-navy-800">
        <div className="flex items-center gap-2 text-mint-300 text-sm font-semibold uppercase tracking-wide">
          <PiggyBank size={18} /> {t('sav.goal')}
        </div>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <div className="text-4xl font-extrabold tracking-tight">
              {formatRands(savings.currentAmount)}
            </div>
            <div className="text-navy-200 text-sm mt-1">
              {t('sav.ofTarget', { amt: formatRands(savings.targetAmount) })}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-extrabold text-mint-400">{pct.toFixed(0)}%</div>
            <div className="text-navy-300 text-xs">{t('sav.complete')}</div>
          </div>
        </div>
        <ProgressBar
          value={savings.currentAmount}
          max={savings.targetAmount}
          className="mt-4 h-3 bg-navy-800"
          barClassName="bg-mint-400"
        />
        <div className="mt-4 flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setAdjustOpen(true)}
            className="bg-navy-800 border-navy-700 text-white hover:bg-navy-700"
          >
            <Plus size={16} /> {t('sav.addFunds')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setTargetOpen(true)}
            className="bg-navy-800 border-navy-700 text-white hover:bg-navy-700"
          >
            <Target size={16} /> {t('sav.editGoal')}
          </Button>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Card>
          <div className="h-8 w-8 rounded-lg bg-mint-50 text-mint-600 flex items-center justify-center">
            <TrendingUp size={18} />
          </div>
          <div className="mt-2.5 text-xl font-extrabold text-navy-900">
            {formatRands(savings.monthlyContribution)}
          </div>
          <div className="text-xs text-navy-500 mt-0.5">{t('sav.monthlyContribution')}</div>
        </Card>
        <Card>
          <div className="h-8 w-8 rounded-lg bg-navy-50 text-navy-600 flex items-center justify-center">
            <Target size={18} />
          </div>
          <div className="mt-2.5 text-xl font-extrabold text-navy-900">
            {monthsToGoal > 0 ? `${monthsToGoal}` : '—'}
          </div>
          <div className="text-xs text-navy-500 mt-0.5">{t('sav.monthsToGoal')}</div>
        </Card>
      </div>

      {remaining > 0 && (
        <Card className="bg-mint-50 border-mint-100">
          <p className="text-sm text-mint-800">
            {t('sav.needMore', {
              amt: formatRands(remaining),
              months: monthsToGoal > 0 ? `${monthsToGoal}` : t('sav.withinReach'),
            })}
          </p>
        </Card>
      )}

      {savings.targetAmount === 0 && (
        <Card>
          <div className="text-center py-6">
            <p className="text-navy-500 font-medium">{t('sav.noGoal')}</p>
            <p className="text-sm text-navy-400 mt-1">{t('sav.noGoalBody')}</p>
            <Button onClick={() => setTargetOpen(true)} className="mt-3">
              <Target size={16} /> {t('sav.setGoal')}
            </Button>
          </div>
        </Card>
      )}

      <AdjustModal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        current={savings.currentAmount}
        onApply={(newAmount) => {
          updateSavings({ currentAmount: Math.max(0, newAmount) });
          setAdjustOpen(false);
        }}
      />
      <TargetModal
        open={targetOpen}
        onClose={() => setTargetOpen(false)}
        target={savings.targetAmount}
        contribution={savings.monthlyContribution}
        onApply={(target, contribution) => {
          updateSavings({ targetAmount: target, monthlyContribution: contribution });
          setTargetOpen(false);
        }}
      />
    </div>
  );
}

function AdjustModal({
  open,
  onClose,
  current,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  current: number;
  onApply: (newAmount: number) => void;
}) {
  const { t } = useI18n();
  const [delta, setDelta] = useState('');
  const [error, setError] = useState('');

  function apply(direction: 'add' | 'sub') {
    const amt = parseFloat(delta);
    if (!amt || amt <= 0) {
      setError(t('sav.errAmount'));
      return;
    }
    const next = direction === 'add' ? current + amt : current - amt;
    onApply(next);
    setDelta('');
    setError('');
  }

  return (
    <Modal open={open} onClose={onClose} title={t('sav.adjustBalance')}>
      <p className="text-sm text-navy-500 mb-3">
        {t('sav.currentBalance')} <span className="font-bold text-navy-800">{formatRands(current)}</span>
      </p>
      <input
        type="number"
        inputMode="decimal"
        value={delta}
        onChange={(e) => setDelta(e.target.value)}
        placeholder={t('sav.amountR')}
        className={inputCls}
      />
      {error && (
        <div className="mt-2 rounded-lg bg-red-50 text-red-600 text-sm px-3 py-2" role="alert">
          {error}
        </div>
      )}
      <div className="flex gap-2 mt-4">
        <Button variant="secondary" onClick={() => apply('sub')} className="flex-1">
          <Minus size={16} /> {t('sav.withdraw')}
        </Button>
        <Button onClick={() => apply('add')} className="flex-1">
          <Plus size={16} /> {t('sav.deposit')}
        </Button>
      </div>
    </Modal>
  );
}

function TargetModal({
  open,
  onClose,
  target,
  contribution,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  target: number;
  contribution: number;
  onApply: (target: number, contribution: number) => void;
}) {
  const { t } = useI18n();
  const [targetVal, setTargetVal] = useState(String(target || ''));
  const [contribVal, setContribVal] = useState(String(contribution || ''));
  const [error, setError] = useState('');

  function apply() {
    const tNum = parseFloat(targetVal) || 0;
    const cNum = parseFloat(contribVal) || 0;
    if (tNum < 0 || cNum < 0) {
      setError(t('sav.errNegative'));
      return;
    }
    onApply(tNum, cNum);
    setError('');
  }

  return (
    <Modal open={open} onClose={onClose} title={t('sav.editGoal')}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-navy-700 mb-1.5">
            {t('sav.targetAmount')}
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={targetVal}
            onChange={(e) => setTargetVal(e.target.value)}
            placeholder="6000"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-navy-700 mb-1.5">
            {t('sav.contribution')}
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={contribVal}
            onChange={(e) => setContribVal(e.target.value)}
            placeholder="600"
            className={inputCls}
          />
        </div>
        {error && (
          <div className="rounded-lg bg-red-50 text-red-600 text-sm px-3 py-2" role="alert">
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button onClick={apply} className="flex-1">
            {t('sav.saveGoal')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const inputCls =
  'w-full rounded-xl border border-navy-100 px-3 py-2.5 text-navy-800 focus:outline-none focus:ring-2 focus:ring-mint-300 focus:border-mint-300 transition-colors';
