import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  PiggyBank,
  Menu,
  X,
  Sparkles,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react';
import { cn } from './ui';
import { useI18n } from '../i18n/I18nContext';

export type PageId =
  | 'dashboard'
  | 'transactions'
  | 'budget'
  | 'savings'
  | 'advisor'
  | 'settings';

interface NavItem {
  id: PageId;
  icon: LucideIcon;
  tKey: string;
}

const PRIMARY_NAV: NavItem[] = [
  { id: 'dashboard', icon: LayoutDashboard, tKey: 'nav.dashboard' },
  { id: 'transactions', icon: ArrowLeftRight, tKey: 'nav.transactions' },
  { id: 'budget', icon: Wallet, tKey: 'nav.budget' },
  { id: 'savings', icon: PiggyBank, tKey: 'nav.savings' },
];

const SECONDARY_NAV: NavItem[] = [
  { id: 'advisor', icon: Sparkles, tKey: 'nav.advisor' },
  { id: 'settings', icon: SettingsIcon, tKey: 'nav.settings' },
];

const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV];

export function Layout({
  page,
  setPage,
  children,
}: {
  page: PageId;
  setPage: (p: PageId) => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-navy-900 text-white flex-col">
        <Brand />
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto no-scrollbar">
          {PRIMARY_NAV.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              label={t(item.tKey)}
              active={page === item.id}
              onClick={() => setPage(item.id)}
            />
          ))}
          <div className="pt-3 mt-3 border-t border-navy-800 space-y-1">
            {SECONDARY_NAV.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                label={t(item.tKey)}
                active={page === item.id}
                onClick={() => setPage(item.id)}
              />
            ))}
          </div>
        </nav>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-navy-900 text-white px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-mint-500 flex items-center justify-center font-extrabold text-navy-900">
            P
          </div>
          <span className="font-extrabold text-lg tracking-tight">PocketPath</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="p-2 rounded-lg hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-mint-400"
          aria-label={t('nav.settings')}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Mobile slide-down menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-14 z-30 bg-navy-900 text-white animate-fade-in">
          <nav className="px-3 py-3 space-y-1">
            {ALL_NAV.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                label={t(item.tKey)}
                active={page === item.id}
                onClick={() => {
                  setPage(item.id);
                  setMobileMenuOpen(false);
                }}
                mobile
              />
            ))}
          </nav>
        </div>
      )}

      {/* Main content */}
      <main className="lg:ml-64 pb-24 lg:pb-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">{children}</div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-navy-50 flex"
        aria-label="Primary"
      >
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon;
          const active = page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-mint-300',
                active ? 'text-mint-600' : 'text-navy-400'
              )}
              aria-label={t(item.tKey)}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={22} />
              <span className="text-[11px] font-semibold">{t(item.tKey)}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function Brand() {
  const { t } = useI18n();
  return (
    <div className="px-5 py-6 flex items-center gap-2.5">
      <div className="h-9 w-9 rounded-xl bg-mint-500 flex items-center justify-center font-extrabold text-navy-900 text-lg">
        P
      </div>
      <div>
        <div className="font-extrabold text-lg tracking-tight leading-none">PocketPath</div>
        <div className="text-[11px] text-navy-300 mt-0.5">{t('app.tagline')}</div>
      </div>
    </div>
  );
}

function NavButton({
  item,
  label,
  active,
  onClick,
  mobile,
}: {
  item: NavItem;
  label: string;
  active: boolean;
  onClick: () => void;
  mobile?: boolean;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-mint-400',
        active
          ? 'bg-mint-500 text-navy-900'
          : 'text-navy-100 hover:bg-navy-800',
        mobile && 'py-3'
      )}
      aria-current={active ? 'page' : undefined}
    >
      <Icon size={20} />
      {label}
    </button>
  );
}
