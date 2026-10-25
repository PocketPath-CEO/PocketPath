import { useState } from 'react';
import { Globe, Compass } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { Button, cn } from '../components/ui';

const ONBOARD_KEY = 'pocketpath.onboarded';

export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARD_KEY) === 'true';
  } catch {
    return false;
  }
}

function markOnboarded() {
  try {
    localStorage.setItem(ONBOARD_KEY, 'true');
  } catch {
    // ignore
  }
}

export function Onboarding({
  onComplete,
  onTakeTour,
}: {
  onComplete: () => void;
  onTakeTour: () => void;
}) {
  const { t, lang, setLang, languages } = useI18n();
  const [step, setStep] = useState<'lang' | 'intro'>('lang');

  function finish(takeTour: boolean) {
    markOnboarded();
    if (takeTour) {
      onTakeTour();
    } else {
      onComplete();
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-navy-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="bg-navy-900 text-white px-5 py-6 text-center">
          <div className="h-12 w-12 rounded-2xl bg-mint-500 flex items-center justify-center font-extrabold text-navy-900 text-2xl mx-auto">
            P
          </div>
          <h1 className="text-xl font-extrabold mt-3">{t('onb.welcome')}</h1>
          <p className="text-navy-300 text-sm mt-1">{t('onb.subtitle')}</p>
        </div>

        {step === 'lang' && (
          <div className="px-5 py-5">
            <div className="flex items-center gap-2 mb-3">
              <Globe size={18} className="text-mint-600" />
              <h2 className="font-bold text-navy-800">{t('onb.chooseLang')}</h2>
            </div>
            <p className="text-sm text-navy-400 mb-3">{t('onb.langHint')}</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {languages.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLang(l.id)}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-mint-300',
                    lang === l.id
                      ? 'border-mint-500 bg-mint-50 text-mint-700'
                      : 'border-navy-100 text-navy-600 hover:bg-navy-50'
                  )}
                  aria-pressed={lang === l.id}
                >
                  {l.nativeLabel}
                </button>
              ))}
            </div>
            <Button onClick={() => setStep('intro')} className="w-full">
              {t('onb.continue')}
            </Button>
          </div>
        )}

        {step === 'intro' && (
          <div className="px-5 py-5">
            <p className="text-sm text-navy-600 mb-4">{t('onb.intro')}</p>
            <div className="space-y-2">
              <Button onClick={() => finish(true)} className="w-full">
                <Compass size={16} /> {t('onb.takeTour')}
              </Button>
              <Button variant="secondary" onClick={() => finish(false)} className="w-full">
                {t('onb.skipTour')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
