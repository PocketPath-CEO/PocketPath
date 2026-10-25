import { useState, useRef } from 'react';
import {
  RotateCcw,
  Trash2,
  BookOpen,
  ShieldCheck,
  Info,
  Globe,
  Sparkles,
  HelpCircle,
  Download,
  Upload,
  Lock,
  Eye,
  FileJson,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Cloud,
  CloudOff,
  RefreshCw,
  LogOut,
  Loader2,
} from 'lucide-react';
import { useApp } from '../AppContext';
import { useAuth } from '../components/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { Card, Button, cn } from '../components/ui';
import { Modal } from '../components/Modal';
import type { AppData } from '../types';

export function Settings({ onGuideStart }: { onGuideStart: () => void }) {
  const { data, resetToDemo, clearAll, syncStatus, lastSyncError, importFromLocal, loadFromCloud, retrySync, canReloadCloud, cloudNeedsImport } = useApp();
  const { user, signOut, configured } = useAuth();
  const { t, lang, setLang, simpleMode, setSimpleMode, languages } = useI18n();
  const [resetOpen, setResetOpen] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function exportJSON() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'pocketpath-export.json');
    setMsg({ type: 'success', text: t('export.success') });
  }

  function exportCSV() {
    const rows = [
      ['id', 'type', 'amount', 'date', 'description', 'category', 'essential', 'paid'],
      ...data.transactions.map((tx) => [
        tx.id,
        tx.type,
        String(tx.amount),
        tx.date,
        tx.description,
        tx.category,
        String(tx.essential),
        String(tx.paid),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv' }), 'pocketpath-transactions.csv');
    setMsg({ type: 'success', text: t('export.success') });
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as AppData;
        if (!parsed.transactions || !parsed.settings || !parsed.savings) {
          throw new Error('invalid');
        }
        localStorage.setItem('pocketpath.data.v1', JSON.stringify(parsed));
        setMsg({ type: 'success', text: t('export.importSuccess') });
        setTimeout(() => window.location.reload(), 800);
      } catch {
        setMsg({ type: 'error', text: t('export.importError') });
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
          {t('set.title')}
        </h1>
        <p className="text-navy-500 text-sm mt-1">{t('set.subtitle')}</p>
      </header>

      {/* Cloud sync status */}
      {configured && user && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Cloud size={18} className="text-mint-600" />
            <h2 className="font-bold text-navy-800">{t('sync.title')}</h2>
          </div>
          <p className="text-sm text-navy-400 mb-3">
            {t('sync.signedInAs')} <span className="font-semibold text-navy-600">{user.email}</span>
          </p>
          <div className="flex items-center gap-2 mb-3">
            {syncStatus === 'saving' && (
              <span className="inline-flex items-center gap-1.5 text-sm text-navy-500">
                <Loader2 size={14} className="animate-spin" /> {t('sync.saving')}
              </span>
            )}
            {syncStatus === 'saved' && (
              <span className="inline-flex items-center gap-1.5 text-sm text-mint-600">
                <CheckCircle2 size={14} /> {t('sync.saved')}
              </span>
            )}
            {syncStatus === 'error' && (
              <span className="inline-flex items-center gap-1.5 text-sm text-red-600">
                <AlertTriangle size={14} /> {t('sync.error')}
              </span>
            )}
            {syncStatus === 'conflict' && (
              <span className="inline-flex items-center gap-1.5 text-sm text-amber-700">
                <AlertTriangle size={14} /> {t('sync.conflictTitle')}
              </span>
            )}
            {syncStatus === 'offline' && (
              <span className="inline-flex items-center gap-1.5 text-sm text-amber-600">
                <CloudOff size={14} /> {t('sync.offline')}
              </span>
            )}
            {syncStatus === 'idle' && (
              <span className="inline-flex items-center gap-1.5 text-sm text-navy-400">
                <Cloud size={14} /> {t('sync.idle')}
              </span>
            )}
          </div>
          {lastSyncError && (
            <p className="text-xs text-red-500 mb-2">{lastSyncError}</p>
          )}
          {syncStatus === 'error' && (
            <p className="text-xs text-navy-500 mb-3">{t('sync.errorExplain')}</p>
          )}
          {syncStatus === 'conflict' && (
            <p className="text-xs text-amber-800 mb-3">
              {t(cloudNeedsImport ? 'sync.localPending' : 'sync.conflictBody')}
            </p>
          )}
          <div className="space-y-2">
            {syncStatus === 'error' && (
              <Button
                variant="secondary"
                onClick={() => retrySync()}
                className="w-full justify-start"
              >
                <RefreshCw size={16} /> {t('sync.retry')}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => loadFromCloud()}
              disabled={!canReloadCloud}
              className="w-full justify-start"
            >
              <RefreshCw size={16} /> {t('sync.reloadCloud')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setImportOpen(true)}
              className="w-full justify-start"
            >
              <Upload size={16} /> {t('sync.importLocal')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => signOut()}
              className="w-full justify-start text-red-600 hover:bg-red-50"
            >
              <LogOut size={16} /> {t('sync.signOut')}
            </Button>
          </div>
        </Card>
      )}

      {!configured && (
        <Card className="bg-amber-50 border-amber-100">
          <div className="flex items-center gap-2 mb-1">
            <CloudOff size={18} className="text-amber-600" />
            <h2 className="font-bold text-amber-800">{t('sync.notConfiguredTitle')}</h2>
          </div>
          <p className="text-sm text-amber-700">{t('sync.notConfiguredBody')}</p>
        </Card>
      )}

      {/* Language */}

      {msg && (
        <div
          className={cn(
            'rounded-xl px-4 py-3 text-sm flex items-center gap-2 animate-scale-in',
            msg.type === 'success'
              ? 'bg-mint-50 text-mint-700 border border-mint-100'
              : 'bg-red-50 text-red-600 border border-red-100'
          )}
          role="alert"
        >
          {msg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {msg.text}
        </div>
      )}

      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Globe size={18} className="text-mint-600" />
          <h2 className="font-bold text-navy-800">{t('set.language')}</h2>
        </div>
        <p className="text-sm text-navy-400 mb-3">{t('set.languageHint')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
      </Card>

      {/* Simple Mode */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={18} className="text-mint-600" />
          <h2 className="font-bold text-navy-800">{t('set.simpleMode')}</h2>
        </div>
        <p className="text-sm text-navy-400 mb-3">{t('set.simpleModeHint')}</p>
        <div className="flex gap-1 bg-navy-50 rounded-xl p-1 w-fit">
          <button
            onClick={() => setSimpleMode(false)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-mint-300',
              !simpleMode ? 'bg-white text-navy-800 shadow-sm' : 'text-navy-500'
            )}
          >
            {t('set.simpleOff')}
          </button>
          <button
            onClick={() => setSimpleMode(true)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-mint-300',
              simpleMode ? 'bg-mint-500 text-white shadow-sm' : 'text-navy-500'
            )}
          >
            {t('set.simpleOn')}
          </button>
        </div>
      </Card>

      {/* Guide */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen size={18} className="text-mint-600" />
          <h2 className="font-bold text-navy-800">{t('set.guide')}</h2>
        </div>
        <p className="text-sm text-navy-400 mb-3">{t('set.guideHint')}</p>
        <Button variant="secondary" onClick={onGuideStart}>
          <BookOpen size={16} /> {t('set.guideMe')}
        </Button>
      </Card>

      {/* Privacy & Security */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Lock size={18} className="text-mint-600" />
          <h2 className="font-bold text-navy-800">{t('privacy.title')}</h2>
        </div>
        <p className="text-sm text-navy-400 mb-4">{t('privacy.subtitle')}</p>
        <div className="space-y-3">
          <PrivacyItem
            icon={<Eye size={16} />}
            title={t('privacy.localTitle')}
            body={t('privacy.localBody')}
          />
          <PrivacyItem
            icon={<Lock size={16} />}
            title={t('privacy.noCredentialsTitle')}
            body={t('privacy.noCredentialsBody')}
          />
          <PrivacyItem
            icon={<ShieldCheck size={16} />}
            title={t('privacy.noTrackingTitle')}
            body={t('privacy.noTrackingBody')}
          />
          <PrivacyItem
            icon={<Trash2 size={16} />}
            title={t('privacy.deleteTitle')}
            body={t('privacy.deleteBody')}
          />
        </div>
        <p className="mt-4 text-xs text-navy-400">{t('privacy.disclaimer')}</p>
      </Card>

      {/* Data export & import */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Download size={18} className="text-mint-600" />
          <h2 className="font-bold text-navy-800">{t('export.title')}</h2>
        </div>
        <p className="text-sm text-navy-400 mb-4">{t('export.subtitle')}</p>
        <div className="space-y-2">
          <Button variant="secondary" onClick={exportJSON} className="w-full justify-start">
            <FileJson size={16} /> {t('export.json')}
          </Button>
          <Button variant="secondary" onClick={exportCSV} className="w-full justify-start">
            <FileSpreadsheet size={16} /> {t('export.csv')}
          </Button>
          <div>
            <Button variant="secondary" onClick={() => fileRef.current?.click()} className="w-full justify-start">
              <Upload size={16} /> {t('export.import')}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImport}
              className="hidden"
            />
            <p className="text-xs text-navy-400 mt-1.5">{t('export.importHint')}</p>
          </div>
        </div>
      </Card>

      {/* Stay Safe */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={18} className="text-mint-600" />
          <h2 className="font-bold text-navy-800">{t('set.staySafe')}</h2>
        </div>
        <p className="text-sm text-navy-400 mb-3">{t('set.staySafeHint')}</p>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="rounded-lg bg-navy-50 px-3 py-2.5">
              <div className="font-semibold text-sm text-navy-800">{t(`safe.tip${n}.title`)}</div>
              <p className="text-sm text-navy-500 mt-0.5">{t(`safe.tip${n}.body`)}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-navy-400">{t('safe.disclaimer')}</p>
      </Card>

      {/* Data & Privacy (reset) */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Info size={18} className="text-mint-600" />
          <h2 className="font-bold text-navy-800">{t('set.data')}</h2>
        </div>
        <p className="text-sm text-navy-400 mb-4">{t('set.dataHint')}</p>
        <div className="space-y-2">
          <Button variant="secondary" onClick={() => setResetOpen(true)} className="w-full justify-start">
            <RotateCcw size={16} /> {t('set.resetDemo')}
          </Button>
        </div>
      </Card>

      {/* About */}
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <HelpCircle size={18} className="text-mint-600" />
          <h2 className="font-bold text-navy-800">{t('set.about')}</h2>
        </div>
        <p className="text-sm text-navy-600">{t('set.aboutBody')}</p>
        <p className="text-xs text-navy-400 mt-3">{t('set.version')}: 1.0.0</p>
      </Card>

      {/* Reset modal */}
      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title={t('reset.title')}>
        <p className="text-sm text-navy-600 mb-4">{t('reset.body')}</p>
        <div className="space-y-2">
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={() => {
              resetToDemo();
              setResetOpen(false);
            }}
          >
            <RotateCcw size={16} /> {t('reset.demo')}
          </Button>
          <Button
            variant="danger"
            className="w-full justify-start"
            onClick={() => {
              clearAll();
              setResetOpen(false);
            }}
          >
            <Trash2 size={16} /> {t('reset.clear')}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setResetOpen(false)}>
            {t('reset.cancel')}
          </Button>
        </div>
      </Modal>

      {/* Import local data modal */}
      <Modal open={importOpen} onClose={() => setImportOpen(false)} title={t('sync.importLocal')}>
        <p className="text-sm text-navy-600 mb-4">{t('sync.importConfirm')}</p>
        <div className="space-y-2">
          <Button
            variant="primary"
            className="w-full"
            onClick={() => {
              importFromLocal();
              setImportOpen(false);
              setMsg({ type: 'success', text: t('sync.importDone') });
            }}
          >
            <Upload size={16} /> {t('sync.importConfirmBtn')}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setImportOpen(false)}>
            {t('common.cancel')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function PrivacyItem({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-navy-100 px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-mint-600 shrink-0">{icon}</span>
        <span className="font-bold text-sm text-navy-800">{title}</span>
      </div>
      <p className="text-sm text-navy-600 pl-6">{body}</p>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
