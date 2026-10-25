import { useState } from 'react';
import { Sparkles, Send, ShieldCheck, Search, AlertTriangle, CheckCircle2, Lock, FlaskConical, CreditCard } from 'lucide-react';
import { useApp } from '../AppContext';
import { useI18n } from '../i18n/I18nContext';
import { Card, Button, Badge, cn } from '../components/ui';
import { localAdvisor, checkAffordability, simulateWhatIf, estimateRepayment, type RepaymentResult } from '../lib/intelligence';
import { formatRands } from '../lib/format';
import { EXPENSE_CATEGORY_IDS, CATEGORIES } from '../categories';

interface ChatMsg {
  role: 'user' | 'advisor';
  text: string;
  params?: Record<string, string | number>;
}

export function Advisor() {
  const { data, totals } = useApp();
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [showAfford, setShowAfford] = useState(false);
  const [showWhatIf, setShowWhatIf] = useState(false);
  const [showCredit, setShowCredit] = useState(false);

  function ask(question: string) {
    if (!question.trim()) return;
    const response = localAdvisor(question, totals, data.savings, data.transactions, data.settings.payday);
    const userMsg: ChatMsg = { role: 'user', text: question };
    const advisorMsg: ChatMsg = { role: 'advisor', text: response.answer, params: response.params };
    setMessages((prev) => [...prev, userMsg, advisorMsg]);
    setInput('');
  }

  const suggestedQuestions = [
    { key: 'adv.qAfford', text: t('adv.qAfford') },
    { key: 'adv.qToday', text: t('adv.qToday') },
    { key: 'adv.qOverspending', text: t('adv.qOverspending') },
    { key: 'adv.qRunOut', text: t('adv.qRunOut') },
    { key: 'adv.qSavings', text: t('adv.qSavings') },
    { key: 'adv.qReduce', text: t('adv.qReduce') },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
          {t('adv.title')}
        </h1>
        <p className="text-navy-500 text-sm mt-1">{t('adv.subtitle')}</p>
      </header>

      {/* Never ask notice */}
      <div className="rounded-xl bg-navy-50 border border-navy-100 px-4 py-3 flex items-center gap-2 text-sm text-navy-600">
        <Lock size={16} className="text-navy-400 shrink-0" />
        {t('adv.neverAsk')}
      </div>

      {/* Chat area */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={18} className="text-mint-600" />
          <h2 className="font-bold text-navy-800">{t('adv.title')}</h2>
        </div>

        {messages.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-navy-400 mb-4">{t('adv.suggestedQuestions')}</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {suggestedQuestions.map((q) => (
                <button
                  key={q.key}
                  onClick={() => ask(q.text)}
                  className="text-left rounded-xl border border-navy-100 px-3 py-2.5 text-sm font-medium text-navy-700 hover:bg-navy-50 hover:border-mint-200 transition-colors focus:outline-none focus:ring-2 focus:ring-mint-300"
                >
                  {q.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.length > 0 && (
          <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'flex gap-2.5',
                  msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                <div
                  className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
                    msg.role === 'user'
                      ? 'bg-navy-100 text-navy-600'
                      : 'bg-mint-100 text-mint-600'
                  )}
                >
                  {msg.role === 'user' ? (
                    <span className="text-xs font-bold">U</span>
                  ) : (
                    <Sparkles size={16} />
                  )}
                </div>
                <div
                  className={cn(
                    'rounded-2xl px-4 py-2.5 text-sm max-w-[85%]',
                    msg.role === 'user'
                      ? 'bg-navy-900 text-white'
                      : 'bg-navy-50 text-navy-800'
                  )}
                >
                  {t(msg.text, msg.params)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('adv.inputPlaceholder')}
            className={inputCls}
          />
          <Button type="submit" className="shrink-0">
            <Send size={16} /> {t('adv.ask')}
          </Button>
        </form>
      </Card>

      {/* What If? scenarios */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FlaskConical size={18} className="text-mint-600" />
            <h2 className="font-bold text-navy-800">{t('whatif.title')}</h2>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowWhatIf((v) => !v)}>
            {showWhatIf ? '−' : '+'}
          </Button>
        </div>
        {showWhatIf && <WhatIfTool />}
      </Card>

      {/* Can I afford this? */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Search size={18} className="text-mint-600" />
            <h2 className="font-bold text-navy-800">{t('afford.title')}</h2>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowAfford((v) => !v)}>
            {showAfford ? '−' : '+'}
          </Button>
        </div>

        {showAfford && <AffordabilityChecker />}
      </Card>

      {/* Repayment estimator */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-mint-600" />
            <h2 className="font-bold text-navy-800">{t('credit.title')}</h2>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowCredit((v) => !v)}>
            {showCredit ? '−' : '+'}
          </Button>
        </div>
        <p className="text-sm text-navy-500 mb-3">{t('credit.subtitle')}</p>
        {showCredit && <RepaymentEstimator />}
      </Card>

      {/* Stay Safe */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck size={18} className="text-mint-600" />
          <h2 className="font-bold text-navy-800">{t('safe.title')}</h2>
        </div>
        <p className="text-sm text-navy-500 mb-3">{t('safe.subtitle')}</p>
        <div className="space-y-2.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="rounded-xl border border-navy-100 px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                <span className="font-bold text-sm text-navy-800">
                  {t(`safe.tip${n}.title`)}
                </span>
              </div>
              <p className="text-sm text-navy-600 pl-6">{t(`safe.tip${n}.body`)}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-navy-400">{t('safe.disclaimer')}</p>
      </Card>

      {/* Disclaimer */}
      <p className="text-xs text-navy-400 text-center">{t('adv.disclaimer')}</p>
    </div>
  );
}

function WhatIfTool() {
  const { totals, data } = useApp();
  const { t } = useI18n();
  const [scenario, setScenario] = useState<'spend' | 'saveMore' | 'reduceCategory'>('spend');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('entertainment');
  const [result, setResult] = useState<ReturnType<typeof simulateWhatIf> | null>(null);
  const [error, setError] = useState('');

  function run() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError(t('afford.errAmount'));
      return;
    }
    setError('');
    const sim = simulateWhatIf(
      scenario,
      amt,
      scenario === 'reduceCategory' ? category : null,
      totals,
      data.savings,
      data.transactions,
      data.settings.payday
    );
    setResult(sim);
  }

  const riskConfig = {
    safe: { icon: <CheckCircle2 size={18} />, cls: 'text-mint-600 bg-mint-50 border-mint-100' },
    caution: { icon: <AlertTriangle size={18} />, cls: 'text-amber-600 bg-amber-50 border-amber-100' },
    danger: { icon: <AlertTriangle size={18} />, cls: 'text-red-600 bg-red-50 border-red-100' },
  };

  return (
    <div className="space-y-3">
      {/* Scenario selector */}
      <div className="flex gap-1 bg-navy-50 rounded-xl p-1" role="tablist" aria-label={t('whatif.title')}>
        {([
          { id: 'spend' as const, label: t('whatif.spend') },
          { id: 'saveMore' as const, label: t('whatif.saveMore') },
          { id: 'reduceCategory' as const, label: t('whatif.reduceCat') },
        ]).map((tab, i, arr) => (
          <button
            key={tab.id}
            onClick={() => setScenario(tab.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') {
                e.preventDefault();
                setScenario(arr[(i + 1) % arr.length].id);
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                setScenario(arr[(i - 1 + arr.length) % arr.length].id);
              }
            }}
            tabIndex={scenario === tab.id ? 0 : -1}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-mint-300',
              scenario === tab.id ? 'bg-white text-navy-800 shadow-sm' : 'text-navy-500'
            )}
            role="tab"
            aria-selected={scenario === tab.id}
            aria-controls="whatif-panel"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div id="whatif-panel" role="tabpanel" className="space-y-3">
        <div>
          <label className="block text-sm font-semibold text-navy-700 mb-1.5">
            {t('whatif.amount')}
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className={inputCls}
          />
        </div>

        {scenario === 'reduceCategory' && (
          <div>
            <label className="block text-sm font-semibold text-navy-700 mb-1.5">
              {t('whatif.category')}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputCls}
            >
              {EXPENSE_CATEGORY_IDS.map((id) => (
                <option key={id} value={id}>
                  {t(CATEGORIES[id].tKey)}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 text-red-600 text-sm px-3 py-2" role="alert">
            {error}
          </div>
        )}

        <Button onClick={run} className="w-full">
          {t('whatif.run')}
        </Button>

        {result && (
          <div className="space-y-3 animate-scale-in">
            {/* Current vs After comparison */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-navy-50 p-3">
                <div className="text-xs text-navy-400 font-semibold">{t('whatif.current')}</div>
                <div className="text-lg font-extrabold text-navy-900 mt-0.5">
                  {formatRands(result.projectedBalance)}
                </div>
                <div className="text-xs text-navy-400">{t('whatif.projectedByPayday')}</div>
              </div>
              <div
                className={cn(
                  'rounded-xl p-3',
                  result.riskLevel === 'safe' ? 'bg-mint-50' : result.riskLevel === 'caution' ? 'bg-amber-50' : 'bg-red-50'
                )}
              >
                <div className="text-xs font-semibold text-navy-400">{t('whatif.after')}</div>
                <div
                  className={cn(
                    'text-lg font-extrabold mt-0.5',
                    result.afterProjected < 0 ? 'text-red-600' : 'text-navy-900'
                  )}
                >
                  {formatRands(result.afterProjected)}
                </div>
                <div className="text-xs text-navy-400">{t('whatif.projectedByPayday')}</div>
              </div>
            </div>

            {/* Risk verdict */}
            <div className={cn('rounded-xl border px-4 py-3 flex items-center gap-2', riskConfig[result.riskLevel].cls)}>
              {riskConfig[result.riskLevel].icon}
              <span className="font-bold text-sm">{t(result.riskKey)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AffordabilityChecker() {
  const { totals, data } = useApp();
  const { t } = useI18n();
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState<{
    verdict: 'affordable' | 'careful' | 'notRecommended';
    title: string;
    explanation: string;
    params: Record<string, string | number>;
  } | null>(null);
  const [error, setError] = useState('');

  function check() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError(t('afford.errAmount'));
      return;
    }
    if (!desc.trim()) {
      setError(t('afford.enterBoth'));
      return;
    }
    setError('');
    const res = checkAffordability(amt, totals, data.settings.payday);
    setResult({
      verdict: res.verdict,
      title: res.title,
      explanation: res.explanation,
      params: {
        amount: String(amt),
        safeBefore: String(totals.safeToSpend.toFixed(2)),
        safeAfter: String(Math.max(0, totals.safeToSpend - amt).toFixed(2)),
        days: String(totals.daysUntilPayday),
      },
    });
  }

  const verdictConfig = {
    affordable: { icon: <CheckCircle2 size={20} />, cls: 'text-mint-600 bg-mint-50 border-mint-100' },
    careful: { icon: <AlertTriangle size={20} />, cls: 'text-amber-600 bg-amber-50 border-amber-100' },
    notRecommended: { icon: <AlertTriangle size={20} />, cls: 'text-red-600 bg-red-50 border-red-100' },
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-semibold text-navy-700 mb-1.5">
          {t('afford.purchaseDesc')}
        </label>
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder={t('afford.purchaseDesc')}
          className={inputCls}
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-navy-700 mb-1.5">
          {t('afford.purchaseAmount')}
        </label>
        <input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className={inputCls}
        />
      </div>
      {error && (
        <div className="rounded-lg bg-red-50 text-red-600 text-sm px-3 py-2" role="alert">
          {error}
        </div>
      )}
      <Button onClick={check} className="w-full">
        {t('afford.check')}
      </Button>
      {result && (
        <div className={cn('rounded-xl border px-4 py-3 animate-scale-in', verdictConfig[result.verdict].cls)}>
          <div className="flex items-center gap-2 mb-1">
            {verdictConfig[result.verdict].icon}
            <span className="font-bold">{t('afford.result')}:</span>
            <Badge
              tone={
                result.verdict === 'affordable'
                  ? 'mint'
                  : result.verdict === 'careful'
                    ? 'warn'
                    : 'danger'
              }
            >
              {t(result.title)}
            </Badge>
          </div>
          <p className="text-sm mt-1">{t(result.explanation, result.params)}</p>
        </div>
      )}
    </div>
  );
}

function RepaymentEstimator() {
  const { t } = useI18n();
  const [balance, setBalance] = useState('');
  const [rate, setRate] = useState('');
  const [payment, setPayment] = useState('');
  const [fees, setFees] = useState('');
  const [result, setResult] = useState<RepaymentResult | null>(null);
  const [error, setError] = useState('');

  function calc() {
    const bal = parseFloat(balance);
    const r = parseFloat(rate);
    const pay = parseFloat(payment);
    const f = parseFloat(fees) || 0;

    if (!bal || bal <= 0) {
      setError(t('credit.errAmount'));
      return;
    }
    if (isNaN(r) || r < 0) {
      setError(t('credit.errRate'));
      return;
    }
    if (!pay || pay <= 0) {
      setError(t('credit.errPayment'));
      return;
    }
    setError('');
    setResult(estimateRepayment(bal, r, pay + f));
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-semibold text-navy-700 mb-1.5">
          {t('credit.balance')}
        </label>
        <input
          type="number"
          inputMode="decimal"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          placeholder="0.00"
          className={inputCls}
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-navy-700 mb-1.5">
          {t('credit.interestRate')}
        </label>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="0.0"
          className={inputCls}
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-navy-700 mb-1.5">
          {t('credit.monthlyPayment')}
        </label>
        <input
          type="number"
          inputMode="decimal"
          value={payment}
          onChange={(e) => setPayment(e.target.value)}
          placeholder="0.00"
          className={inputCls}
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-navy-700 mb-1.5">
          {t('credit.optionalFees')}
        </label>
        <input
          type="number"
          inputMode="decimal"
          value={fees}
          onChange={(e) => setFees(e.target.value)}
          placeholder="0.00"
          className={inputCls}
        />
      </div>
      {error && (
        <div className="rounded-lg bg-red-50 text-red-600 text-sm px-3 py-2" role="alert">
          {error}
        </div>
      )}
      <Button onClick={calc} className="w-full">
        {t('credit.calculate')}
      </Button>
      {result && (
        <div className="space-y-3 animate-scale-in" role="status" aria-live="polite">
          {result.verdict === 'tooSmall' ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 flex items-start gap-2">
              <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
              <span className="text-sm text-red-700">
                {t('credit.tooSmall', { amt: result.monthlyInterest.toFixed(2) })}
              </span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-xl bg-navy-50 p-3">
                  <div className="text-xs text-navy-400 font-semibold">{t('credit.months')}</div>
                  <div className="text-lg font-extrabold text-navy-900 mt-0.5">
                    {result.months}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-mint-50 p-3">
                    <div className="text-xs text-navy-400 font-semibold">{t('credit.totalInterest')}</div>
                    <div className="text-lg font-extrabold text-navy-900 mt-0.5">
                      {formatRands(result.totalInterest ?? 0)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-navy-50 p-3">
                    <div className="text-xs text-navy-400 font-semibold">{t('credit.totalPaid')}</div>
                    <div className="text-lg font-extrabold text-navy-900 mt-0.5">
                      {formatRands(result.totalPaid ?? 0)}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
          <p className="text-xs text-navy-400">{t('credit.assumptions')}</p>
        </div>
      )}
    </div>
  );
}

const inputCls =
  'w-full rounded-xl border border-navy-100 px-3 py-2.5 text-navy-800 focus:outline-none focus:ring-2 focus:ring-mint-300 focus:border-mint-300 transition-colors';
