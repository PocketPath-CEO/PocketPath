import { useState } from 'react';
import { Wallet, Mail, Lock, AlertCircle, Loader2, Globe } from 'lucide-react';
import { useAuth } from '../components/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { cn } from '../components/ui';

export function AuthPage() {
  const { signUp, signIn, configured } = useAuth();
  const { t, lang, setLang, languages } = useI18n();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const fn = mode === 'signup' ? signUp : signIn;
    const { error: err } = await fn(email.trim(), password);
    setBusy(false);

    if (err) {
      setError(err);
    }
  }

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex items-center gap-2.5 justify-center mb-6">
          <div className="h-10 w-10 rounded-xl bg-mint-500 flex items-center justify-center font-extrabold text-navy-900 text-xl">
            P
          </div>
          <span className="font-extrabold text-2xl text-white tracking-tight">PocketPath</span>
        </div>

        {!configured ? (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-4 text-sm text-red-200 flex items-start gap-2">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{t('auth.notConfigured')}</span>
          </div>
        ) : (
          <div className="rounded-2xl bg-white shadow-xl p-6 space-y-5">
            <div>
              <h1 className="text-xl font-extrabold text-navy-900">
                {mode === 'signup' ? t('auth.createAccount') : t('auth.signIn')}
              </h1>
              <p className="text-sm text-navy-500 mt-1">
                {mode === 'signup' ? t('auth.signupHint') : t('auth.signinHint')}
              </p>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-600 flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-navy-700 flex items-center gap-1.5 mb-1.5">
                  <Mail size={14} /> {t('auth.email')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-navy-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint-300 focus:border-mint-400"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-navy-700 flex items-center gap-1.5 mb-1.5">
                  <Lock size={14} /> {t('auth.password')}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  className="w-full rounded-xl border border-navy-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint-300 focus:border-mint-400"
                  placeholder={t('auth.passwordPlaceholder')}
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className={cn(
                  'w-full rounded-xl bg-mint-500 text-white font-semibold py-2.5 text-sm',
                  'transition-all active:scale-[0.98] hover:bg-mint-600',
                  'disabled:opacity-50 disabled:pointer-events-none',
                  'inline-flex items-center justify-center gap-2'
                )}
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Wallet size={16} />
                )}
                {mode === 'signup' ? t('auth.createAccount') : t('auth.signIn')}
              </button>
            </form>

            <div className="text-center text-sm text-navy-500">
              {mode === 'signup' ? (
                <>
                  {t('auth.haveAccount')}{' '}
                  <button
                    onClick={() => { setMode('signin'); setError(null); }}
                    className="text-mint-600 font-semibold hover:underline"
                  >
                    {t('auth.signIn')}
                  </button>
                </>
              ) : (
                <>
                  {t('auth.noAccount')}{' '}
                  <button
                    onClick={() => { setMode('signup'); setError(null); }}
                    className="text-mint-600 font-semibold hover:underline"
                  >
                    {t('auth.createAccount')}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Language selector */}
        <div className="mt-4">
          <div className="flex items-center justify-center gap-1.5 text-navy-400 text-xs mb-2">
            <Globe size={14} />
            <span>{t('onb.chooseLang')}</span>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {languages.map((l) => (
              <button
                key={l.id}
                onClick={() => setLang(l.id)}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all',
                  lang === l.id
                    ? 'bg-mint-500 text-navy-900'
                    : 'bg-white/10 text-navy-300 hover:bg-white/20'
                )}
                aria-pressed={lang === l.id}
              >
                {l.nativeLabel}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
