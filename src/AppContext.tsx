import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ReactNode,
} from 'react';
import type { AppData, Transaction, BudgetTarget, SavingsGoal, Settings } from './types';
import { makeSampleData } from './sampleData';
import { computeTotals } from './lib/calculations';
import { supabase } from './lib/supabase';
import { loadCloudData, saveCloudData } from './lib/sync';
import { useAuth } from './components/AuthContext';

const STORAGE_KEY = 'pocketpath.data.v1';

interface AppContextValue {
  data: AppData;
  totals: ReturnType<typeof import('./lib/calculations').computeTotals>;
  syncStatus: 'idle' | 'saving' | 'saved' | 'error' | 'offline' | 'conflict';
  canReloadCloud: boolean;
  cloudNeedsImport: boolean;
  lastSyncError: string | null;
  importFromLocal: () => void;
  loadFromCloud: () => Promise<void>;
  retrySync: () => void;
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  togglePaid: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setTargets: (targets: BudgetTarget[]) => void;
  updateSavings: (patch: Partial<SavingsGoal>) => void;
  resetToDemo: () => void;
  clearAll: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function loadLocalData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed && parsed.version === 1 && Array.isArray(parsed.transactions)) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  const sample = makeSampleData();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sample));
  } catch {
    // ignore
  }
  return sample;
}

function emptyData(): AppData {
  return {
    transactions: [],
    targets: [],
    savings: { targetAmount: 0, currentAmount: 0, monthlyContribution: 0 },
    settings: { payday: '', monthlyIncome: 0, isDemo: false },
    version: 1,
  };
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableSerialize).join(',') + ']';
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record).sort().map((key) => JSON.stringify(key) + ':' + stableSerialize(record[key])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

function hasUserData(data: AppData): boolean {
  return !data.settings.isDemo && (
    data.transactions.length > 0 ||
    data.targets.length > 0 ||
    data.savings.targetAmount > 0 ||
    data.savings.currentAmount > 0 ||
    data.savings.monthlyContribution > 0 ||
    data.settings.monthlyIncome > 0 ||
    Boolean(data.settings.payday)
  );
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState<AppData>(() => loadLocalData());
  const [syncStatus, setSyncStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error' | 'offline' | 'conflict'
  >('idle');
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [cloudNeedsImport, setCloudNeedsImport] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlight = useRef(false);
  const pendingSave = useRef<{ userId: string; data: AppData } | null>(null);
  const cloudLoadUserId = useRef<string | null>(null);
  const cloudReadyUserId = useRef<string | null>(null);
  const lastSyncedData = useRef<AppData | null>(null);
  const currentUserId = useRef<string | null>(user?.id ?? null);
  const dataRef = useRef(data);
  useEffect(() => {
    currentUserId.current = user?.id ?? null;
    dataRef.current = data;
  }, [user?.id, data]);

  const flushPending = useCallback(() => {
    if (saveInFlight.current) return;
    const pending = pendingSave.current;
    if (!pending) return;

    pendingSave.current = null;
    saveInFlight.current = true;
    if (currentUserId.current === pending.userId) setSyncStatus('saving');

    saveCloudData(pending.userId, pending.data)
      .then(() => {
        if (currentUserId.current !== pending.userId) return;
        lastSyncedData.current = pending.data;
        if (pendingSave.current?.data === pending.data) pendingSave.current = null;
        setLastSyncError(null);
        setSyncStatus(pendingSave.current ? 'saving' : 'saved');
      })
      .catch((err: unknown) => {
        if (currentUserId.current !== pending.userId) return;
        if (!pendingSave.current) {
          setSyncStatus('error');
          setLastSyncError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        saveInFlight.current = false;
        if (pendingSave.current && pendingSave.current.userId === currentUserId.current) {
          flushPending();
        }
      });
  }, []);

  // Load cloud data first. Never upload a local snapshot until the user has
  // resolved an existing local/cloud mismatch or explicitly chosen local data.
  useEffect(() => {
    if (!user) {
      cloudLoadUserId.current = null;
      cloudReadyUserId.current = null;
      lastSyncedData.current = null;
      pendingSave.current = null;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setCloudNeedsImport(false);
      setSyncStatus('idle');
      setLastSyncError(null);
      return;
    }
    if (cloudLoadUserId.current === user.id) return;

    cloudLoadUserId.current = user.id;
    cloudReadyUserId.current = null;
    lastSyncedData.current = null;
    pendingSave.current = null;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setCloudNeedsImport(false);
    setSyncStatus('saving');
    setLastSyncError(null);

    let cancelled = false;
    loadCloudData(user.id)
      .then((cloudData) => {
        if (cancelled || currentUserId.current !== user.id) return;
        const localData = dataRef.current;
        const localHasUserData = hasUserData(localData);

        if (cloudData && localHasUserData && stableSerialize(localData) !== stableSerialize(cloudData)) {
          setCloudNeedsImport(false);
          setSyncStatus('conflict');
          return;
        }

        if (!cloudData && localHasUserData) {
          setCloudNeedsImport(true);
          setSyncStatus('conflict');
          return;
        }

        const nextData = cloudData ?? emptyData();
        lastSyncedData.current = nextData;
        cloudReadyUserId.current = user.id;
        setData(nextData);
        setCloudNeedsImport(false);
        setSyncStatus(cloudData ? 'saved' : 'idle');
      })
      .catch((err: unknown) => {
        if (cancelled || currentUserId.current !== user.id) return;
        setSyncStatus('error');
        setLastSyncError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Debounce edits, then serialize cloud writes and always flush the newest
  // snapshot after an in-flight write finishes.
  useEffect(() => {
    if (!user || !supabase || cloudReadyUserId.current !== user.id) return;
    if (data === lastSyncedData.current) return;

    pendingSave.current = { userId: user.id, data };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      flushPending();
    }, 1500);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [data, user, flushPending]);

  // Keep a local fallback so edits remain available offline.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage may be unavailable or full; the UI remains usable for this session.
    }
  }, [data]);

  const totals = useMemo(
    () => computeTotals(data.transactions, data.settings.payday, data.savings),
    [data.transactions, data.settings.payday, data.savings]
  );

  const importFromLocal = useCallback(() => {
    const local = loadLocalData();
    setData(local);
    if (user && supabase) {
      cloudReadyUserId.current = user.id;
      cloudLoadUserId.current = user.id;
      lastSyncedData.current = null;
      pendingSave.current = { userId: user.id, data: local };
      setCloudNeedsImport(false);
      setSyncStatus('saving');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      flushPending();
    }
  }, [user, flushPending]);

  const loadFromCloud = useCallback(async () => {
    if (!user || !supabase || saveInFlight.current) return;
    if (
      cloudReadyUserId.current === user.id &&
      (dataRef.current !== lastSyncedData.current || pendingSave.current !== null)
    ) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    pendingSave.current = null;
    cloudReadyUserId.current = null;
    setSyncStatus('saving');
    try {
      const cloudData = await loadCloudData(user.id);
      if (currentUserId.current !== user.id) return;
      if (!cloudData && hasUserData(dataRef.current)) {
        setCloudNeedsImport(true);
        setSyncStatus('conflict');
        return;
      }
      const nextData = cloudData ?? emptyData();
      lastSyncedData.current = nextData;
      cloudReadyUserId.current = user.id;
      setData(nextData);
      setCloudNeedsImport(false);
      setLastSyncError(null);
      setSyncStatus(cloudData ? 'saved' : 'idle');
    } catch (err: unknown) {
      if (currentUserId.current !== user.id) return;
      cloudReadyUserId.current = null;
      setSyncStatus('error');
      setLastSyncError(err instanceof Error ? err.message : String(err));
    }
  }, [user]);

  const retrySync = useCallback(() => {
    if (!user || !supabase) return;
    if (cloudReadyUserId.current !== user.id) {
      void loadFromCloud();
      return;
    }
    pendingSave.current = { userId: user.id, data: dataRef.current };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    flushPending();
  }, [user, loadFromCloud, flushPending]);

  const canReloadCloud = Boolean(
    user && supabase && !saveInFlight.current && !pendingSave.current &&
    (cloudReadyUserId.current === user.id
      ? data === lastSyncedData.current
      : syncStatus === 'conflict' && !cloudNeedsImport)
  );

  const value = useMemo<AppContextValue>(
    () => ({
      data,
      totals,
      syncStatus,
      lastSyncError,
      canReloadCloud,
      cloudNeedsImport,
      importFromLocal,
      loadFromCloud,
      retrySync,
      addTransaction: (t) =>
        setData((d) => ({ ...d, settings: { ...d.settings, isDemo: false }, transactions: [{ ...t, id: uid() }, ...d.transactions] })),
      updateTransaction: (id, patch) =>
        setData((d) => ({
          ...d,
          settings: { ...d.settings, isDemo: false },
          transactions: d.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      deleteTransaction: (id) =>
        setData((d) => ({
          ...d,
          settings: { ...d.settings, isDemo: false },
          transactions: d.transactions.filter((t) => t.id !== id),
        })),
      togglePaid: (id) =>
        setData((d) => ({
          ...d,
          settings: { ...d.settings, isDemo: false },
          transactions: d.transactions.map((t) =>
            t.id === id ? { ...t, paid: !t.paid } : t
          ),
        })),
      updateSettings: (patch) =>
        setData((d) => ({ ...d, settings: { ...d.settings, ...patch, isDemo: false } })),
      setTargets: (targets) =>
        setData((d) => ({ ...d, targets, settings: { ...d.settings, isDemo: false } })),
      updateSavings: (patch) =>
        setData((d) => ({
          ...d,
          savings: { ...d.savings, ...patch },
          settings: { ...d.settings, isDemo: false },
        })),
      resetToDemo: () => setData(makeSampleData()),
      clearAll: () => setData(emptyData()),
    }),
    [data, totals, syncStatus, lastSyncError, canReloadCloud, cloudNeedsImport, importFromLocal, loadFromCloud, retrySync]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
