import { useMemo, useState } from 'react';
import { Plus, Trash2, Check, Circle, Filter, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useApp } from '../AppContext';
import { useI18n } from '../i18n/I18nContext';
import { Card, Button, Badge, cn } from '../components/ui';
import { Modal } from '../components/Modal';
import { CATEGORIES, EXPENSE_CATEGORY_IDS } from '../categories';
import { formatRands, formatDate, todayISO } from '../lib/format';
import type { CategoryId, Transaction, TxnType } from '../types';

export function Transactions() {
  const { data, addTransaction, deleteTransaction, togglePaid } = useApp();
  const { t } = useI18n();
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');

  const filtered = useMemo(() => {
    const sorted = [...data.transactions].sort((a, b) => b.date.localeCompare(a.date));
    if (filter === 'all') return sorted;
    return sorted.filter((t) => t.type === filter);
  }, [data.transactions, filter]);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
            {t('txn.title')}
          </h1>
          <p className="text-navy-500 text-sm mt-1">{t('txn.subtitle')}</p>
        </div>
        <Button onClick={() => setModalOpen(true)} size="md" className="shrink-0">
          <Plus size={18} /> {t('txn.add')}
        </Button>
      </header>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 border border-navy-50 w-fit" role="tablist">
        {(['all', 'income', 'expense'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-mint-300',
              filter === f ? 'bg-navy-900 text-white' : 'text-navy-500 hover:bg-navy-50'
            )}
            role="tab"
            aria-selected={filter === f}
          >
            {f === 'all' ? t('txn.all') : f === 'income' ? t('txn.income') : t('txn.expense')}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <div className="mx-auto h-12 w-12 rounded-full bg-navy-50 flex items-center justify-center text-navy-400">
              <Filter size={20} />
            </div>
            <p className="mt-3 text-navy-500 font-medium">{t('txn.empty')}</p>
            <p className="text-sm text-navy-400 mt-1">{t('txn.emptyBody')}</p>
            <Button onClick={() => setModalOpen(true)} className="mt-4">
              <Plus size={18} /> {t('txn.addTransaction')}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((t) => (
            <TxnRow
              key={t.id}
              txn={t}
              onTogglePaid={() => togglePaid(t.id)}
              onDelete={() => deleteTransaction(t.id)}
            />
          ))}
        </div>
      )}

      <AddTransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={(t) => {
          addTransaction(t);
          setModalOpen(false);
        }}
      />
    </div>
  );
}

function TxnRow({
  txn,
  onTogglePaid,
  onDelete,
}: {
  txn: Transaction;
  onTogglePaid: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const cat = CATEGORIES[txn.category];
  const Icon = cat.icon;
  const isIncome = txn.type === 'income';

  return (
    <Card className="p-3 sm:p-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
            isIncome ? 'bg-mint-50 text-mint-600' : 'bg-navy-50 text-navy-600'
          )}
        >
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-navy-800 text-sm leading-snug">{txn.description}</span>
            {txn.essential && <Badge tone="navy">{t('txn.essential')}</Badge>}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-navy-400 mt-0.5 flex-wrap">
            <span className="truncate max-w-[7rem] sm:max-w-none">{t(cat.tKey)}</span>
            <span className="shrink-0">·</span>
            <span className="shrink-0">{formatDate(txn.date)}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={cn('font-bold', isIncome ? 'text-mint-600' : 'text-navy-800')}>
            {isIncome ? '+' : '−'}
            {formatRands(txn.amount)}
          </div>
          <button
            onClick={onTogglePaid}
            className={cn(
              'mt-1 inline-flex items-center gap-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-mint-300 rounded px-1',
              txn.paid ? 'text-mint-600' : 'text-navy-400 hover:text-navy-600'
            )}
          >
            {txn.paid ? <Check size={12} /> : <Circle size={12} />}
            {isIncome
              ? txn.paid
                ? t('txn.received')
                : t('txn.pending')
              : txn.paid
                ? t('txn.paid')
                : t('txn.unpaid')}
          </button>
        </div>
        <button
          onClick={onDelete}
          className="p-2 rounded-lg text-navy-300 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-red-200"
          aria-label={t('txn.delete')}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </Card>
  );
}

function AddTransactionModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (t: Omit<Transaction, 'id'>) => void;
}) {
  const { t } = useI18n();
  const [type, setType] = useState<TxnType>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState<CategoryId>('groceries');
  const [essential, setEssential] = useState(false);
  const [paid, setPaid] = useState(true);
  const [error, setError] = useState('');

  function reset() {
    setType('expense');
    setAmount('');
    setDescription('');
    setDate(todayISO());
    setCategory('groceries');
    setEssential(false);
    setPaid(true);
    setError('');
  }

  function handleSubmit() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError(t('txn.errAmount'));
      return;
    }
    if (!description.trim()) {
      setError(t('txn.errDesc'));
      return;
    }
    if (!date) {
      setError(t('txn.errDate'));
      return;
    }
    onAdd({
      type,
      amount: amt,
      date,
      description: description.trim(),
      category: type === 'income' ? 'income' : category,
      essential: type === 'expense' ? essential : false,
      paid,
    });
    reset();
  }

  return (
    <Modal open={open} onClose={onClose} title={t('txn.addTransaction')}>
      <div className="space-y-4">
        {/* Type toggle */}
        <div className="flex gap-1 bg-navy-50 rounded-xl p-1" role="tablist">
          <button
            onClick={() => {
              setType('expense');
              setPaid(true);
            }}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-mint-300',
              type === 'expense' ? 'bg-white text-navy-800 shadow-sm' : 'text-navy-500'
            )}
            role="tab"
            aria-selected={type === 'expense'}
          >
            <ArrowDownLeft size={15} /> {t('txn.expense')}
          </button>
          <button
            onClick={() => {
              setType('income');
              setPaid(true);
            }}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-mint-300',
              type === 'income' ? 'bg-white text-navy-800 shadow-sm' : 'text-navy-500'
            )}
            role="tab"
            aria-selected={type === 'income'}
          >
            <ArrowUpRight size={15} /> {t('txn.income')}
          </button>
        </div>

        <Field label={t('txn.amount')}>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t('txn.amountPlaceholder')}
            className={inputCls}
          />
        </Field>

        <Field label={t('txn.description')}>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={type === 'income' ? t('txn.descPlaceholderIncome') : t('txn.descPlaceholderExpense')}
            className={inputCls}
          />
        </Field>

        {type === 'expense' && (
          <Field label={t('txn.category')}>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryId)}
              className={inputCls}
            >
              {EXPENSE_CATEGORY_IDS.map((id) => (
                <option key={id} value={id}>
                  {t(CATEGORIES[id].tKey)}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label={t('txn.date')}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>

        {type === 'expense' && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={essential}
              onChange={(e) => setEssential(e.target.checked)}
              className="h-4 w-4 rounded accent-mint-500"
            />
            <span className="text-sm text-navy-700">{t('txn.markEssential')}</span>
          </label>
        )}

        <div className="flex items-center gap-2">
          <span className="text-sm text-navy-700 font-medium">
            {type === 'income' ? t('txn.receivedQ') : t('txn.paidQ')}
          </span>
          <button
            onClick={() => setPaid(true)}
            className={cn(
              'px-3 py-1 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-mint-300',
              paid ? 'bg-mint-500 text-white' : 'bg-navy-50 text-navy-500'
            )}
          >
            {type === 'income' ? t('txn.received') : t('txn.paid')}
          </button>
          <button
            onClick={() => setPaid(false)}
            className={cn(
              'px-3 py-1 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-mint-300',
              !paid ? 'bg-navy-900 text-white' : 'bg-navy-50 text-navy-500'
            )}
          >
            {type === 'income' ? t('txn.pending') : t('txn.unpaid')}
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 text-red-600 text-sm px-3 py-2" role="alert">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            {t('txn.cancel')}
          </Button>
          <Button onClick={handleSubmit} className="flex-1">
            {t('txn.addType', { type: type === 'income' ? t('txn.income') : t('txn.expense') })}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const inputCls =
  'w-full rounded-xl border border-navy-100 px-3 py-2.5 text-navy-800 focus:outline-none focus:ring-2 focus:ring-mint-300 focus:border-mint-300 transition-colors';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-navy-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
