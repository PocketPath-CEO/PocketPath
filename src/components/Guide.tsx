import { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { Button } from './ui';
import type { PageId } from './Layout';

const GUIDE_KEY = 'pocketpath.guideDone';

export function hasGuideDone(): boolean {
  try {
    return localStorage.getItem(GUIDE_KEY) === 'true';
  } catch {
    return false;
  }
}

function markGuideDone() {
  try {
    localStorage.setItem(GUIDE_KEY, 'true');
  } catch {
    // ignore
  }
}

interface Step {
  titleKey: string;
  bodyKey: string;
  page: PageId;
  highlight?: string;
}

const STEPS: Step[] = [
  { titleKey: 'guide.welcome', bodyKey: 'guide.welcomeBody', page: 'dashboard' },
  { titleKey: 'guide.dashboard', bodyKey: 'guide.dashboardBody', page: 'dashboard' },
  { titleKey: 'guide.safeToSpend', bodyKey: 'guide.safeToSpendBody', page: 'dashboard' },
  { titleKey: 'guide.transactions', bodyKey: 'guide.transactionsBody', page: 'transactions' },
  { titleKey: 'guide.budget', bodyKey: 'guide.budgetBody', page: 'budget' },
  { titleKey: 'guide.savings', bodyKey: 'guide.savingsBody', page: 'savings' },
  { titleKey: 'guide.advisor', bodyKey: 'guide.advisorBody', page: 'advisor' },
];

export function Guide({
  setPage,
  onClose,
}: {
  setPage: (p: PageId) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [stepIdx, setStepIdx] = useState(0);

  const step = STEPS[stepIdx];
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === STEPS.length - 1;

  function goNext() {
    if (isLast) {
      finish();
      return;
    }
    const next = stepIdx + 1;
    setPage(STEPS[next].page);
    setStepIdx(next);
  }

  function goBack() {
    if (isFirst) return;
    const prev = stepIdx - 1;
    setPage(STEPS[prev].page);
    setStepIdx(prev);
  }

  function finish() {
    markGuideDone();
    setPage('dashboard');
    onClose();
  }

  function skip() {
    markGuideDone();
    onClose();
  }

  return (
    <>
      {/* Spotlight overlay */}
      <div className="fixed inset-0 z-40 bg-navy-950/60 backdrop-blur-sm" onClick={skip} />

      {/* Guide card */}
      <div className="fixed bottom-20 lg:bottom-6 left-4 right-4 lg:left-auto lg:right-8 lg:w-96 z-50 animate-scale-in">
        <div className="bg-white rounded-2xl shadow-2xl border border-navy-100 overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-navy-50">
            <div
              className="h-full bg-mint-500 transition-all duration-300"
              style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }}
            />
          </div>

          {/* Close button */}
          <button
            onClick={skip}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-navy-300 hover:text-navy-600 hover:bg-navy-50 transition-colors"
            aria-label={t('guide.skip')}
          >
            <X size={18} />
          </button>

          <div className="px-5 py-5">
            <div className="text-xs font-bold text-mint-600 uppercase tracking-wide mb-2">
              {t('guide.step', { current: stepIdx + 1, total: STEPS.length })}
            </div>
            <h2 className="text-lg font-extrabold text-navy-900 mb-2 pr-6">
              {t(step.titleKey)}
            </h2>
            <p className="text-sm text-navy-600 mb-4">{t(step.bodyKey)}</p>

            {/* Buttons */}
            <div className="flex items-center justify-between gap-2">
              {!isFirst ? (
                <Button variant="ghost" size="sm" onClick={goBack}>
                  <ChevronLeft size={16} /> {t('guide.back')}
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={skip}>
                  {t('guide.skip')}
                </Button>
              )}
              <Button size="sm" onClick={goNext}>
                {isLast ? t('guide.finish') : t('guide.next')}
                {!isLast && <ChevronRight size={16} />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
