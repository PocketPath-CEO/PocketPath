import {
  createContext,
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
  syncStatus: 'idle' | 'saving' | 'saved' | 'error' | 'offline';
  lastSyncError: string | null;
  importFromLocal: () => void;
  loadFromCloud: () => Promise<void>;
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

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState<AppData>(() => loadLocalData());
  const [syncStatus, setSyncStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error' | 'offline'
  >('idle');
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedCloud = useRef(false);

  // Load cloud data when user signs in
  useEffect(() => {
    if (!user) {
      hasLoadedCloud.current = false;
      return;
    }
    if (hasLoadedCloud.current) return;
    hasLoadedCloud.current = true;

    setSyncStatus('saving');
    loadCloudData(user.id)
      .then((cloudData) => {
        if (cloudData) {
          setData(cloudData);
          setSyncStatus('saved');
        } else {
          setData(emptyData());
          setSyncStatus('idle');
        }
      })
      .catch((err: unknown) => {
        setSyncStatus('error');
        setLastSyncError(err instanceof Error ? err.message : String(err));
      });
  }, [user]);

  // Debounced save to cloud when data changes and user is signed in
  useEffect(() => {
    if (!user || !supabase) return;
    if (syncStatus === 'saving' && !hasLoadedCloud.current) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => {
      setSyncStatus('saving');
      saveCloudData(user.id, data)
        .then(() => {
          setSyncStatus('saved');
          setLastSyncError(null);
        })
        .catch((err: unknown) => {
          setSyncStatus('error');
          setLastSyncError(err instanceof Error ? err.message : String(err));
        });
    }, 1500);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [data, user]);

  // Always keep localStorage in sync (offline fallback)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
  }, [data]);

  const totals = useMemo(
    () => computeTotals(data.transactions, data.settings.payday, data.savings),
    [data.transactions, data.settings.payday, data.savings]
  );

  const importFromLocal = () => {
    const local = loadLocalData();
    setData(local);
    setSyncStatus('idle');
  };

  const loadFromCloud = async () => {
    if (!user) return;
    setSyncStatus('saving');
    try {
      const cloudData = await loadCloudData(user.id);
      if (cloudData) {
        setData(cloudData);
        setSyncStatus('saved');
      } else {
        setSyncStatus('idle');
      }
    } catch (err: unknown) {
      setSyncStatus('error');
      setLastSyncError(err instanceof Error ? err.message : String(err));
    }
  };

  const value = useMemo<AppContextValue>(
    () => ({
      data,
      totals,
      syncStatus,
      lastSyncError,
      importFromLocal,
      loadFromCloud,
      addTransaction: (t) =>
        setData((d) => ({ ...d, transactions: [{ ...t, id: uid() }, ...d.transactions] })),
      updateTransaction: (id, patch) =>
        setData((d) => ({
          ...d,
          transactions: d.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      deleteTransaction: (id) =>
        setData((d) => ({
          ...d,
          transactions: d.transactions.filter((t) => t.id !== id),
        })),
      togglePaid: (id) =>
        setData((d) => ({
          ...d,
          transactions: d.transactions.map((t) =>
            t.id === id ? { ...t, paid: !t.paid } : t
          ),
        })),
      updateSettings: (patch) =>
        setData((d) => ({ ...d, settings: { ...d.settings, ...patch, isDemo: false } })),
      setTargets: (targets) => setData((d) => ({ ...d, targets })),
      updateSavings: (patch) =>
        setData((d) => ({ ...d, savings: { ...d.savings, ...patch } })),
      resetToDemo: () => setData(makeSampleData()),
      clearAll: () => setData(emptyData()),
    }),
    [data, totals, syncStatus, lastSyncError, user]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
