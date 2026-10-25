import { useMemo } from 'react';
import {
  TrendingDown,
  TrendingUp,
  Wallet,
  CalendarClock,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  Info,
  CheckCircle2,
  TrendingUp as ForecastIcon,
  Lightbulb,
  HeartPulse,
  Target as TargetIcon,
  Siren,
} from 'lucide-react';
import { useApp } from '../AppContext';
import { useI18n } from '../i18n/I18nContext';
import { Card, ProgressBar, Badge, cn } from '../components/ui';
import { formatRands, formatRandsShort, formatDate, todayISO } from '../lib/format';
import { breakdown } from '../lib/calculations';
import {
  computeForecast,
  generateInsights,
  computeHealthScore,
  computeNextBestAction,
  type Insight,
} from '../lib/intelligence';
import { CATEGORIES } from '../categories';
import type { PageId } from '../components/Layout';

export function Dashboard({ setPage }: { setPage: (p: PageId) => void }) {
  const { data, totals } = useApp();
  const { t, simpleMode } = useI18n();
  const { items, total } = useMemo(
    () => breakdown(data.transactions),
    [data.transactions]
  );
  const forecast = useMemo(
    () => computeForecast(data.transactions, data.settings.payday, data.savings),
    [data.transactions, data.settings.payday, data.savings]
  );
  const insights = useMemo(
    () => generateInsights(data.transactions, totals, data.targets, data.savings),
    [data.transactions, totals, data.targets, data.savings]
  );
  const health = useMemo(
    () => computeHealthScore(data.transactions, totals, data.targets, data.savings, forecast),
    [data.transactions, totals, data.targets, data.savings, forecast]
  );
  const nba = useMemo(
    () => computeNextBestAction(totals, data.savings, data.transactions, data.targets, forecast),
    [totals, data.savings, data.transactions, data.targets, forecast]
  );

  const savingsPct =
    data.savings.targetAmount > 0
      ? (data.savings.currentAmount / data.savings.targetAmount) * 100
      : 0;

  const payToday = data.settings.payday && data.settings.payday <= todayISO();
  const isEmergency = forecast.hasData && forecast.projectedBalance < 0;

  return (
    <div className="space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
            {t('dash.title')}
          </h1>
          <p className="text-navy-500 text-sm mt-1">{t('dash.subtitle')}</p>
        </div>
        {data.settings.isDemo && (
          <Badge tone="warn">
            <Sparkles size={12} /> {t('app.demo')}
          </Badge>
        )}
      </header>

      {/* Safe-to-spend hero */}
      <Card className="bg-navy-900 text-white border-navy-800">
        <div className="flex items-center justify-between">
          <span className="text-mint-300 text-sm font-semibold uppercase tracking-wide">
            {simpleMode ? t('dash.safeToSpendSimple') : t('dash.safeToSpend')}
          </span>
          <Wallet className="text-mint-400" size={20} />
        </div>
        <div className="mt-2 text-4xl sm:text-5xl font-extrabold tracking-tight">
          {formatRands(totals.safeToSpend)}
        </div>
        {totals.shortfall > 0 ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-500/15 text-red-200 px-3 py-2.5 text-sm">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{t('dash.shortfallWarning', { amt: formatRands(totals.shortfall) })}</span>
          </div>
        ) : (
          <div className="mt-3 text-navy-200 text-sm">
            {simpleMode ? t('dash.dailyGuideSimple') : t('dash.dailyGuide')}{' '}
            <span className="font-bold text-white">{formatRands(totals.dailyGuide)}</span>{' '}
            {t('dash.perDay')} {t('dash.forDays', { days: totals.daysUntilPayday })}
          </div>
        )}
      </Card>

      {/* Money Emergency mode */}
      {isEmergency && (
        <Card className="bg-red-50 border-red-200 animate-scale-in">
          <div className="flex items-center gap-2 mb-3">
            <Siren size={20} className="text-red-600" />
            <h2 className="font-bold text-red-800">{t('emergency.title')}</h2>
          </div>
          <p className="text-sm text-red-700 mb-3">{t('emergency.body')}</p>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="flex items-start gap-2 rounded-lg bg-white/60 px-3 py-2">
                <span className="text-red-500 font-bold text-sm shrink-0">{n}.</span>
                <span className="text-sm text-red-700">{t(`emergency.action${n}`)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Financial Health Score */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <HeartPulse size={18} className="text-mint-600" />
          <h2 className="font-bold text-navy-800">{t('health.title')}</h2>
        </div>
        <div className="flex items-center gap-4 mb-4">
          <div className="relative shrink-0">
            <HealthGauge score={health.score} />
          </div>
          <div className="flex-1">
            <div className="text-3xl font-extrabold text-navy-900">
              {health.score}<span className="text-lg text-navy-400">/{health.maxScore}</span>
            </div>
            <p className="text-sm text-navy-600 mt-0.5">{t(health.summaryKey, health.summaryParams)}</p>
          </div>
        </div>
        <div className="space-y-2.5">
          {health.factors.map((f) => (
            <HealthFactorRow key={f.key} factor={f} />
          ))}
        </div>
      </Card>

      {/* Next Best Action */}
      {nba && (
        <Card className="bg-mint-50 border-mint-200">
          <div className="flex items-center gap-2 mb-3">
            <TargetIcon size={18} className="text-mint-600" />
            <h2 className="font-bold text-mint-800">{t('nba.title')}</h2>
          </div>
          <p className="text-sm text-mint-800 font-medium">
            {t(nba.actionKey, {
              ...nba.actionParams,
              category: nba.actionParams?.category ? t(`cat.${nba.actionParams.category}`) : '',
            })}
          </p>
          <p className="text-sm text-mint-700 mt-1.5">
            {t(nba.impactKey, {
              ...nba.impactParams,
              category: nba.impactParams?.category ? t(`cat.${nba.impactParams.category}`) : '',
            })}
          </p>
        </Card>
      )}

      {/* Forecast section */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <ForecastIcon size={18} className="text-mint-600" />
          <h2 className="font-bold text-navy-800">{t('forecast.title')}</h2>
        </div>
        {!forecast.hasPayday ? (
          <p className="text-sm text-navy-500">{t('forecast.noPayday')}</p>
        ) : !forecast.hasData ? (
          <p className="text-sm text-navy-500">{t('forecast.insufficientData')}</p>
        ) : (
          <div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <div className="text-xs text-navy-400 font-semibold">
                  {simpleMode ? t('forecast.projectedBalanceSimple') : t('forecast.projectedBalance')}
                </div>
                <div
                  className={cn(
                    'text-xl font-extrabold mt-0.5',
                    forecast.projectedBalance < 0 ? 'text-red-600' : 'text-navy-900'
                  )}
                >
                  {formatRands(forecast.projectedBalance)}
                </div>
              </div>
              <div>
                <div className="text-xs text-navy-400 font-semibold">
                  {simpleMode ? t('forecast.projectedSafeSpendSimple') : t('forecast.projectedSafeSpend')}
                </div>
                <div className="text-xl font-extrabold mt-0.5 text-navy-900">
                  {formatRands(forecast.projectedSafeSpend)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {forecast.onTrack ? (
                <Badge tone="mint">
                  <CheckCircle2 size={12} /> {t('forecast.onTrack')}
                </Badge>
              ) : (
                <Badge tone="danger">
                  <AlertTriangle size={12} /> {t('forecast.offTrack')}
                </Badge>
              )}
              {forecast.potentialShortfall > 0 && (
                <Badge tone="warn">
                  {t('forecast.shortfall')}: {formatRands(forecast.potentialShortfall)}
                </Badge>
              )}
            </div>
            <p className="text-sm text-navy-600">
              {t(forecast.explanation, {
                amt: formatRands(Math.abs(forecast.projectedBalance)),
              })}
            </p>
          </div>
        )}
      </Card>

      {/* Insights section */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb size={18} className="text-mint-600" />
          <h2 className="font-bold text-navy-800">{t('insights.title')}</h2>
        </div>
        {insights.length === 0 ? (
          <p className="text-sm text-navy-400">{t('insights.empty')}</p>
        ) : (
          <div className="space-y-2.5">
            {insights.map((ins) => (
              <InsightRow key={ins.id} insight={ins} />
            ))}
          </div>
        )}
      </Card>

      {/* Stat grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label={t('dash.incomeReceived')}
          value={formatRands(totals.incomeReceived)}
          icon={<TrendingUp size={18} />}
          tone="mint"
        />
        <StatCard
          label={t('dash.expensesTotal')}
          value={formatRands(totals.totalExpenses)}
          icon={<TrendingDown size={18} />}
          tone="navy"
        />
        <StatCard
          label={simpleMode ? t('dash.remainingBudgetSimple') : t('dash.remainingBudget')}
          value={formatRands(totals.available)}
          icon={<Wallet size={18} />}
          tone={totals.available >= 0 ? 'mint' : 'danger'}
        />
        <StatCard
          label={t('dash.nextPayday')}
          value={data.settings.payday ? formatDate(data.settings.payday) : t('dash.notSet')}
          sub={data.settings.payday ? t('dash.daysAway', { days: totals.daysUntilPayday }) : undefined}
          icon={<CalendarClock size={18} />}
          tone="navy"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Spending breakdown */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-navy-800">{t('dash.spendingBreakdown')}</h2>
            <Badge tone="navy">{formatRands(total)}</Badge>
          </div>
          {items.length === 0 ? (
            <EmptyHint text={t('txn.emptyBody')} />
          ) : (
            <div className="space-y-3">
              <p className="sr-only">
                {t('dash.spendingSummary', {
                  total: formatRands(total),
                  count: Math.min(items.length, 6),
                  top: t(CATEGORIES[items[0].category as keyof typeof CATEGORIES]?.tKey ?? 'cat.other'),
                  topAmt: formatRands(items[0].amount),
                  topPct: items[0].percentage.toFixed(0),
                })}
              </p>
              {items.slice(0, 6).map((it) => {
                const cat = CATEGORIES[it.category as keyof typeof CATEGORIES];
                const Icon = cat?.icon;
                return (
                  <div key={it.category} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-navy-50 flex items-center justify-center text-navy-600 shrink-0">
                      {Icon ? <Icon size={16} /> : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold text-navy-700 truncate">{cat ? t(cat.tKey) : it.category}</span>
                        <span className="text-navy-500 font-medium">{formatRandsShort(it.amount)}</span>
                      </div>
                      <div className="mt-1.5">
                        <ProgressBar value={it.percentage} max={100} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Savings progress */}
        <Card>
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-navy-800">{t('dash.savingsProgress')}</h2>
            <button
              onClick={() => setPage('savings')}
              className="text-mint-600 text-sm font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-mint-300 rounded"
            >
              {t('dash.view')}
            </button>
          </div>
          <div className="flex items-end justify-between mt-2">
            <div>
              <div className="text-3xl font-extrabold text-navy-900">
                {formatRands(data.savings.currentAmount)}
              </div>
              <div className="text-sm text-navy-500 mt-0.5">
                {t('dash.ofGoal', { amt: formatRands(data.savings.targetAmount) })}
              </div>
            </div>
            <span className="text-mint-600 font-bold text-lg">{savingsPct.toFixed(0)}%</span>
          </div>
          <ProgressBar value={data.savings.currentAmount} max={data.savings.targetAmount} className="mt-3 h-3" />
          <div className="mt-3 text-sm text-navy-500">
            {t('dash.monthlyContribution')} {formatRands(data.savings.monthlyContribution)}
          </div>
        </Card>
      </div>

      {/* Guidance tips */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck size={18} className="text-mint-600" />
          <h2 className="font-bold text-navy-800">
            {simpleMode ? t('dash.financialGuidanceSimple') : t('dash.financialGuidance')}
          </h2>
        </div>
        <div className="space-y-3">
          {insights.map((ins) => (
            <InsightRow key={`guide-${ins.id}`} insight={ins} />
          ))}
        </div>
        <p className="mt-4 text-xs text-navy-400">{t('dash.disclaimer')}</p>
      </Card>

      {payToday && (
        <div className="rounded-xl bg-mint-50 border border-mint-100 px-4 py-3 text-sm text-mint-800 flex items-center gap-2">
          <CalendarClock size={16} />
          {t('dash.payToday')}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  tone: 'mint' | 'navy' | 'danger';
}) {
  const tones = {
    mint: 'bg-mint-50 text-mint-600',
    navy: 'bg-navy-50 text-navy-600',
    danger: 'bg-red-50 text-red-600',
  };
  return (
    <Card className="p-3 sm:p-4">
      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', tones[tone])}>{icon}</div>
      <div className="mt-2.5 text-lg sm:text-xl font-extrabold text-navy-900 leading-tight">{value}</div>
      <div className="text-xs text-navy-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-mint-600 font-semibold mt-0.5">{sub}</div>}
    </Card>
  );
}

function HealthGauge({ score }: { score: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const pct = score / 100;
  const dash = circumference * pct;
  const color = score >= 70 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="6" />
      <circle
        cx="36"
        cy="36"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={`${dash} ${circumference}`}
        strokeDashoffset={circumference / 4}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
      />
    </svg>
  );
}

function HealthFactorRow({ factor }: { factor: import('../lib/intelligence').HealthFactor }) {
  const { t } = useI18n();
  const statusConfig = {
    good: { icon: <CheckCircle2 size={14} />, cls: 'text-mint-600', dot: 'bg-mint-500' },
    warn: { icon: <AlertTriangle size={14} />, cls: 'text-amber-600', dot: 'bg-amber-500' },
    bad: { icon: <AlertTriangle size={14} />, cls: 'text-red-600', dot: 'bg-red-500' },
  }[factor.status];

  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', statusConfig.dot)} />
      <span className="text-navy-700 font-medium min-w-[100px] sm:min-w-[140px]">{t(factor.labelKey)}</span>
      <span className={cn('flex-1', statusConfig.cls)}>{t(factor.detailKey, factor.detailParams)}</span>
      <span className="text-navy-400 text-xs font-semibold shrink-0">{factor.score}/{factor.maxScore}</span>
    </div>
  );
}

function InsightRow({ insight }: { insight: Insight }) {
  const { t } = useI18n();
  const config = {
    good: { icon: <CheckCircle2 size={16} />, cls: 'bg-mint-50 text-mint-700 border-mint-100' },
    warn: { icon: <AlertTriangle size={16} />, cls: 'bg-amber-50 text-amber-700 border-amber-100' },
    info: { icon: <Info size={16} />, cls: 'bg-navy-50 text-navy-700 border-navy-100' },
  }[insight.tone];
  const params = insight.params;
  const categoryLabel = params?.category ? t(`cat.${params.category}`) : undefined;
  const finalParams = { ...params, category: categoryLabel ?? params?.category ?? '' };
  return (
    <div className={cn('rounded-xl border px-4 py-3 flex gap-3', config.cls)}>
      <span className="mt-0.5 shrink-0">{config.icon}</span>
      <div>
        <div className="font-bold text-sm">{t(insight.title)}</div>
        <div className="text-sm mt-0.5 opacity-90">{t(insight.body, finalParams)}</div>
      </div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-navy-100 px-4 py-6 text-center text-sm text-navy-400">
      {text}
    </div>
  );
}
