import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { translate, type LangId, LANGUAGES } from './translations';

const LANG_KEY = 'pocketpath.lang';
const SIMPLE_KEY = 'pocketpath.simpleMode';

interface I18nValue {
  lang: LangId;
  setLang: (l: LangId) => void;
  simpleMode: boolean;
  setSimpleMode: (v: boolean) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  languages: typeof LANGUAGES;
}

const I18nContext = createContext<I18nValue | null>(null);

function loadLang(): LangId {
  try {
    const v = localStorage.getItem(LANG_KEY) as LangId | null;
    if (v && LANGUAGES.some((l) => l.id === v)) return v;
  } catch {
    // ignore
  }
  return 'en';
}

function loadSimpleMode(): boolean {
  try {
    return localStorage.getItem(SIMPLE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangId>(() => loadLang());
  const [simpleMode, setSimpleModeState] = useState<boolean>(() => loadSimpleMode());

  const setLang = useCallback((l: LangId) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      // ignore
    }
  }, []);

  const setSimpleMode = useCallback((v: boolean) => {
    setSimpleModeState(v);
    try {
      localStorage.setItem(SIMPLE_KEY, String(v));
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(lang, key, params),
    [lang]
  );

  const value: I18nValue = {
    lang,
    setLang,
    simpleMode,
    setSimpleMode,
    t,
    languages: LANGUAGES,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
