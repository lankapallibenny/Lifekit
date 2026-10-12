/**
 * LIFEKIT Money tracker.
 *
 * Design commitments that are visible in this file:
 *  - Manual entry only. There is no bank connection, no scraping, no payment credential,
 *    and no network call anywhere in this screen.
 *  - Money values are parsed and summed through integer minor units (lib/money.ts), so
 *    totals never drift by a paisa.
 *  - Every destructive action asks for confirmation, and every invalid amount is rejected
 *    with a specific message instead of being silently coerced.
 *  - The screen states clearly that recorded cash flow is not a bank balance.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  EmptyState,
  IconButton,
  Notice,
  PageHeader,
  ProgressBar,
  Segmented,
  SelectField,
  StatTile,
  TextAreaField,
  TextField,
} from '../components/ui';
import { Icon } from '../components/Icons';
import { useStore } from '../state/store';
import {
  budgetStatus,
  categoryBreakdown,
  filterEntries,
  formatMoney,
  goalProgress,
  monthlySeries,
  parseAmount,
  projectRecurring,
  summarize,
  type Budget,
  type EntryType,
  type MoneyCategory,
  type MoneyEntry,
  type RecurrenceFrequency,
  type SavingsGoal,
} from '../lib/money';
import {
  formatDate,
  formatMonthKey,
  periodRange,
  recentMonthKeys,
  todayISO,
  type PeriodKind,
} from '../lib/dates';
import { createId, cleanText, downloadBlob, fileStamp } from '../lib/shared';
import { repo } from '../lib/repo';
import { entriesToCsv, parseEntriesCsv } from '../lib/csv';
import { categoryIdForName } from '../lib/defaults';
import { ROUTES, navigate } from '../router';

type Tab = 'entries' | 'budgets' | 'goals' | 'categories' | 'data';

const TABS: { value: Tab; label: string }[] = [
  { value: 'entries', label: 'Entries' },
  { value: 'budgets', label: 'Budgets' },
  { value: 'goals', label: 'Savings goals' },
  { value: 'categories', label: 'Categories' },
  { value: 'data', label: 'Import & export' },
];

interface EntryDraft {
  id: string | null;
  type: EntryType;
  amount: string;
  date: string;
  categoryId: string;
  note: string;
  recurrence: RecurrenceFrequency;
  goalId: string;
}

function emptyDraft(type: EntryType, categoryId: string): EntryDraft {
  return {
    id: null,
    type,
    amount: '',
    date: todayISO(),
    categoryId,
    note: '',
    recurrence: 'none',
    goalId: '',
  };
}

function EntryForm({
  draft,
  onClose,
  categories,
  goals,
  onSaveGoal,
}: {
  draft: EntryDraft;
  onClose: () => void;
  categories: MoneyCategory[];
  goals: SavingsGoal[];
  onSaveGoal: (goal: SavingsGoal) => Promise<void>;
}) {
  const { saveEntry, notify, data } = useStore();
  const [state, setState] = useState<EntryDraft>(draft);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);

  const options = categories.filter((c) => c.type === state.type && !c.archived);
  const editing = state.id !== null;

  // Keep the category valid when the user flips income/expense inside the dialog.
  useEffect(() => {
    if (!options.some((c) => c.id === state.categoryId)) {
      setState((prev) => ({ ...prev, categoryId: options[0]?.id ?? '' }));
    }
  }, [options, state.categoryId]);

  const validate = (): boolean => {
    const next: Record<string, string | null> = {};
    const amount = parseAmount(state.amount);
    if (state.amount.trim() === '') next.amount = 'Enter an amount.';
    else if (amount === null) next.amount = 'Use digits only, up to 2 decimals (for example 450.50). No minus signs.';
    else if (amount <= 0) next.amount = 'Amount must be greater than zero.';
    if (!state.date) next.date = 'Pick a date.';
    else if (state.date > '2999-12-31') next.date = 'That date is too far in the future.';
    if (!state.categoryId) next.categoryId = 'Choose a category.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    const amount = parseAmount(state.amount) as number;
    const now = new Date().toISOString();
    const existing = editing ? data.entries.find((e) => e.id === state.id) : undefined;
    const entry: MoneyEntry = {
      id: state.id ?? createId('mny'),
      type: state.type,
      amount,
      date: state.date,
      categoryId: state.categoryId,
      note: cleanText(state.note, 300),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ...(state.recurrence !== 'none' ? { recurrence: { frequency: state.recurrence } } : {}),
      goalId: state.goalId || null,
    };
    await saveEntry(entry);

    // If this entry is linked to a savings goal, keep the goal total in step.
    if (state.goalId) {
      const goal = data.goals.find((g) => g.id === state.goalId);
      if (goal) {
        const others = goal.contributions.filter((c) => c.id !== entry.id);
        const contribution = { id: entry.id, amount, date: state.date, note: entry.note };
        await onSaveGoal({ ...goal, contributions: [...others, contribution], updatedAt: now });
      }
    }

    notify(editing ? 'Entry updated.' : 'Entry saved on this device.', 'success');
    setSaving(false);
    onClose();
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Segmented
        label="Entry type"
        value={state.type}
        onChange={(type) => setState((prev) => ({ ...prev, type }))}
        options={[
          { value: 'expense', label: 'Expense' },
          { value: 'income', label: 'Income' },
        ]}
      />
      <div className="grid grid-2" style={{ marginTop: 'var(--space-3)' }}>
        <TextField
          label="Amount"
          inputMode="decimal"
          placeholder="0.00"
          value={state.amount}
          error={errors.amount ?? null}
          hint="Digits and up to two decimals"
          autoFocus
          onChange={(event) => setState((prev) => ({ ...prev, amount: event.target.value }))}
        />
        <TextField
          label="Date"
          type="date"
          value={state.date}
          error={errors.date ?? null}
          onChange={(event) => setState((prev) => ({ ...prev, date: event.target.value }))}
        />
      </div>
      <SelectField
        label="Category"
        value={state.categoryId}
        error={errors.categoryId ?? null}
        onChange={(event) => setState((prev) => ({ ...prev, categoryId: event.target.value }))}
        options={options.map((c) => ({ value: c.id, label: c.name }))}
      />
      <TextAreaField
        label="Note (optional)"
        value={state.note}
        maxLength={300}
        placeholder="e.g. monthly bus pass"
        onChange={(event) => setState((prev) => ({ ...prev, note: event.target.value }))}
      />
      <div className="grid grid-2">
        <SelectField
          label="Repeats"
          hint="Used only for the recurring cost estimate. LIFEKIT does not create entries for you."
          value={state.recurrence}
          onChange={(event) => setState((prev) => ({ ...prev, recurrence: event.target.value as RecurrenceFrequency }))}
          options={[
            { value: 'none', label: 'Does not repeat' },
            { value: 'weekly', label: 'Every week' },
            { value: 'monthly', label: 'Every month' },
            { value: 'yearly', label: 'Every year' },
          ]}
        />
        {state.type === 'expense' ? (
          <SelectField
            label="Savings goal (optional)"
            hint="Links this expense to a goal you are funding."
            value={state.goalId}
            onChange={(event) => setState((prev) => ({ ...prev, goalId: event.target.value }))}
            options={[{ value: '', label: 'Not linked' }, ...goals.map((g) => ({ value: g.id, label: g.name }))]}
          />
        ) : (
          <div />
        )}
      </div>
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="accent" disabled={saving} data-testid="save-entry">
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Add entry'}
        </Button>
      </div>
    </form>
  );
}

export function Money({ initialQuickAdd }: { initialQuickAdd?: string | null }): JSX.Element {
  const {
    data,
    settings,
    storage,
    online,
    saveGoal,
    deleteEntry,
    exportBackup,
  } = useStore();

  const [tab, setTab] = useState<Tab>('entries');
  const [period, setPeriod] = useState<PeriodKind>('month');
  const [customFrom, setCustomFrom] = useState(periodRange('month').from);
  const [customTo, setCustomTo] = useState(todayISO());
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<EntryType | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | 'all'>('all');
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MoneyEntry | null>(null);

  // Honour the shortcut from the Home screen or the app manifest.
  useEffect(() => {
    if (initialQuickAdd === 'expense' || initialQuickAdd === 'income') {
      const type = initialQuickAdd;
      const fallbackCategory = data.categories.find((c) => c.type === type && !c.archived)?.id ?? '';
      setDraft(emptyDraft(type, fallbackCategory));
    }
  }, [initialQuickAdd, data.categories]);

  const range = useMemo(() => {
    if (period === 'custom') {
      const from = customFrom <= customTo ? customFrom : customTo;
      const to = customFrom <= customTo ? customTo : customFrom;
      return { from, to, label: `${formatDate(from, 'short')} – ${formatDate(to, 'short')}` };
    }
    return periodRange(period, new Date(), settings.weekStartsOn);
  }, [period, customFrom, customTo, settings.weekStartsOn]);

  const inPeriod = useMemo(
    () => data.entries.filter((entry) => entry.date >= range.from && entry.date <= range.to),
    [data.entries, range.from, range.to]
  );
  const summary = summarize(inPeriod);
  const filtered = useMemo(
    () =>
      filterEntries(inPeriod, {
        query,
        type: typeFilter,
        categoryId: categoryFilter,
      }),
    [inPeriod, query, typeFilter, categoryFilter]
  );

  const breakdown = categoryBreakdown(inPeriod, 'expense');
  const maxBreakdown = breakdown[0]?.total ?? 0;
  const monthKeys = recentMonthKeys(6);
  const series = monthlySeries(data.entries, monthKeys);
  const maxSeries = Math.max(1, ...series.flatMap((s) => [s.income, s.expense]));
  const recurring = projectRecurring(data.entries, new Date());

  const money = (value: number) => formatMoney(value, { currency: settings.currency, locale: settings.locale });
  const categoryName = (id: string) => data.categories.find((c) => c.id === id)?.name ?? 'Uncategorised';

  const exportCsv = () => {
    const categoryMap = new Map(data.categories.map((c) => [c.id, c.name]));
    const csv = entriesToCsv(filtered, { categories: categoryMap, currency: settings.currency });
    downloadBlob(`lifekit-money-${fileStamp()}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  };

  return (
    <div className="stack">
      <PageHeader
        title="Money"
        description="Manual records of what came in and what went out. No bank connection, ever."
        actions={
          <>
            <Button variant="accent" icon="plus" onClick={() => setDraft(emptyDraft('expense', data.categories.find((c) => c.type === 'expense')?.id ?? ''))}>
              Add entry
            </Button>
            <Button variant="secondary" icon="download" onClick={() => navigate(ROUTES.backup)}>
              Backup
            </Button>
          </>
        }
      />

      <Notice tone="info" title="These are your notes, not a bank balance.">
        <strong>Recorded cash flow = income − expenses from the entries you typed.</strong> Your actual account balance also
        moves for reasons LIFEKIT deliberately cannot see: bank charges, standing instructions, cash, unrecorded items and
        multiple accounts. Check your statement for the authoritative figure.
      </Notice>

      {!storage.persistent ? (
        <Notice tone="danger" title="Nothing you enter here will be saved on this device.">
          Storage is unavailable, so LIFEKIT is running in memory-only mode. Use a normal browsing window.
        </Notice>
      ) : null}

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Reporting period">
          {(['today', 'week', 'month', 'year', 'all', 'custom'] as PeriodKind[]).map((kind) => (
            <button key={kind} type="button" aria-pressed={period === kind} onClick={() => setPeriod(kind)}>
              {kind === 'all' ? 'All' : kind.charAt(0).toUpperCase() + kind.slice(1)}
            </button>
          ))}
        </div>
        {period === 'custom' ? (
          <div className="row wrap">
            <TextField label="From" type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
            <TextField label="To" type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
          </div>
        ) : (
          <span className="small muted">{range.label}</span>
        )}
      </div>

      <div className="grid grid-3">
        <StatTile label="Recorded income" value={money(summary.income)} tone="income" hint={`${summary.incomeCount} entr${summary.incomeCount === 1 ? 'y' : 'ies'}`} />
        <StatTile label="Recorded expenses" value={money(summary.expense)} tone="expense" hint={`${summary.expenseCount} entr${summary.expenseCount === 1 ? 'y' : 'ies'}`} />
        <StatTile
          label="Net recorded cash flow"
          value={money(summary.net)}
          tone={summary.net >= 0 ? 'income' : 'expense'}
          hint={summary.net >= 0 ? 'More recorded in than out' : 'More recorded out than in'}
        />
      </div>

      <div className="segmented" role="tablist" aria-label="Money sections" style={{ alignSelf: 'flex-start' }}>
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            aria-pressed={tab === item.value}
            onClick={() => setTab(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'entries' ? (
        <>
          <Card
            title="Entries"
            subtitle={`${filtered.length} of ${inPeriod.length} shown for ${range.label}`}
            actions={
              <>
                <Button size="sm" variant="secondary" icon="download" onClick={exportCsv} disabled={filtered.length === 0}>
                  Export CSV
                </Button>
              </>
            }
          >
            <div className="toolbar" style={{ marginBottom: 'var(--space-3)' }}>
              <div className="grow" style={{ minWidth: 180 }}>
                <TextField
                  label="Search notes and amounts"
                  type="search"
                  placeholder="e.g. bus, 450, 2026-03"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <SelectField
                label="Type"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as EntryType | 'all')}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'expense', label: 'Expenses' },
                  { value: 'income', label: 'Income' },
                ]}
              />
              <SelectField
                label="Category"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                options={[
                  { value: 'all', label: 'All categories' },
                  ...data.categories.map((c) => ({ value: c.id, label: `${c.name} (${c.type})` })),
                ]}
              />
            </div>

            {data.entries.length === 0 ? (
              <EmptyState
                icon="wallet"
                title="No money entries yet"
                action={
                  <Button variant="accent" icon="plus" onClick={() => setDraft(emptyDraft('expense', data.categories.find((c) => c.type === 'expense')?.id ?? ''))}>
                    Add your first entry
                  </Button>
                }
              >
                Start with today: one expense and one income is enough to see how the summaries work. Everything stays on this
                device, and you can export a CSV or a backup file at any time.
              </EmptyState>
            ) : filtered.length === 0 ? (
              <EmptyState icon="search" title="No entries match these filters">
                Try clearing the search box or switching the period back to Month.
              </EmptyState>
            ) : (
              <div className="table-wrap">
                <table>
                  <caption className="visually-hidden">Money entries for the selected period</caption>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Category</th>
                      <th scope="col">Note</th>
                      <th scope="col" className="numeric">
                        Amount
                      </th>
                      <th scope="col">
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 300).map((entry) => (
                      <tr key={entry.id}>
                        <td className="nowrap">{formatDate(entry.date, 'short', settings.locale)}</td>
                        <td>
                          {categoryName(entry.categoryId)}
                          {entry.recurrence && entry.recurrence.frequency !== 'none' ? (
                            <>
                              {' '}
                              <Badge tone="info">
                                <Icon name="repeat" size={12} /> {entry.recurrence.frequency}
                              </Badge>
                            </>
                          ) : null}
                        </td>
                        <td className="truncate" style={{ maxWidth: 220 }}>
                          {entry.note || <span className="muted">—</span>}
                        </td>
                        <td className={`numeric amount ${entry.type === 'income' ? 'amount-income' : 'amount-expense'}`}>
                          {entry.type === 'income' ? '+' : '−'}
                          {money(entry.amount)}
                        </td>
                        <td>
                          <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                            <IconButton
                              icon="edit"
                              label={`Edit entry ${entry.note || entry.date}`}
                              onClick={() =>
                                setDraft({
                                  id: entry.id,
                                  type: entry.type,
                                  amount: String(entry.amount),
                                  date: entry.date,
                                  categoryId: entry.categoryId,
                                  note: entry.note ?? '',
                                  recurrence: entry.recurrence?.frequency ?? 'none',
                                  goalId: entry.goalId ?? '',
                                })
                              }
                            />
                            <IconButton
                              icon="trash"
                              label={`Delete entry ${entry.note || entry.date}`}
                              onClick={() => setPendingDelete(entry)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length > 300 ? (
                  <p className="tiny muted" style={{ marginTop: 8 }}>
                    Showing the first 300 rows. Narrow the period or search to see the rest — exports always include every
                    matching entry.
                  </p>
                ) : null}
              </div>
            )}
          </Card>

          <div className="grid grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            <Card title="Where the money went" subtitle="Expenses in this period, by category">
              {breakdown.length === 0 ? (
                <p className="small muted" style={{ margin: 0 }}>
                  No expenses recorded in this period yet.
                </p>
              ) : (
                <div className="stack-sm">
                  {breakdown.map((row) => (
                    <div key={row.categoryId}>
                      <div className="row-between">
                        <span className="small">{categoryName(row.categoryId)}</span>
                        <span className="small mono">
                          {money(row.total)} · {Math.round(row.share * 100)}%
                        </span>
                      </div>
                      <ProgressBar
                        percent={maxBreakdown > 0 ? (row.total / maxBreakdown) * 100 : 0}
                        label={`${categoryName(row.categoryId)} share of expenses`}
                        tone="never-over"
                      />
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Last six months" subtitle="Recorded income against recorded expenses">
              <div className="bars" role="img" aria-label={`Bar chart of recorded income and expenses for ${monthKeys.join(', ')}`}>
                {series.map((month) => (
                  <div className="bars-col" key={month.month}>
                    <div className="bars-stack">
                      <span
                        className="bar-income"
                        style={{ height: `${Math.round((month.income / maxSeries) * 100)}%` }}
                        title={`Income ${money(month.income)}`}
                      />
                      <span
                        className="bar-expense"
                        style={{ height: `${Math.round((month.expense / maxSeries) * 100)}%` }}
                        title={`Expenses ${money(month.expense)}`}
                      />
                    </div>
                    <span className="bars-label">{formatMonthKey(month.month, settings.locale, true).slice(0, 3)}</span>
                  </div>
                ))}
              </div>
              <div className="legend" style={{ marginTop: 8 }}>
                <span>
                  <span className="legend-swatch bar-income" /> Income
                </span>
                <span>
                  <span className="legend-swatch bar-expense" /> Expenses
                </span>
              </div>
            </Card>
          </div>

          <Card title="Recurring cost estimate" subtitle="From entries you marked as repeating">
            {recurring.count === 0 ? (
              <p className="small muted" style={{ margin: 0 }}>
                No repeating entries yet. Mark an entry as weekly, monthly or yearly and LIFEKIT will estimate the committed
                cost. Estimates only — LIFEKIT never creates entries automatically.
              </p>
            ) : (
              <>
                <div className="grid grid-2">
                  <StatTile label="Estimated per month" value={money(recurring.monthlyTotal)} hint="Estimate, not a bill" />
                  <StatTile label="Estimated per year" value={money(recurring.yearlyTotal)} hint="Estimate, not a bill" />
                </div>
                <p className="tiny muted" style={{ marginTop: 8, marginBottom: 0 }}>
                  {recurring.count} repeating entr{recurring.count === 1 ? 'y' : 'ies'}.
                  {recurring.nextDue ? ` Next occurrence on or after today: ${formatDate(recurring.nextDue, 'medium', settings.locale)}.` : ''}{' '}
                  These figures assume the pattern continues unchanged. Nothing here is a prediction or a guarantee.
                </p>
              </>
            )}
          </Card>
        </>
      ) : null}

      {tab === 'budgets' ? <BudgetsTab money={money} range={range} /> : null}
      {tab === 'goals' ? <GoalsTab money={money} /> : null}
      {tab === 'categories' ? <CategoriesTab /> : null}
      {tab === 'data' ? (
        <DataTab
          money={money}
          onExportBackup={exportBackup}
          online={online}
          currency={settings.currency}
        />
      ) : null}

      <Dialog
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit entry' : 'Add money entry'}
      >
        {draft ? (
          <EntryForm
            draft={draft}
            onClose={() => setDraft(null)}
            categories={data.categories}
            goals={data.goals.filter((g) => !g.archived)}
            onSaveGoal={saveGoal}
          />
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this entry?"
        message={
          pendingDelete ? (
            <>
              <p>
                <strong>
                  {pendingDelete.type === 'income' ? 'Income' : 'Expense'} of {money(pendingDelete.amount)}
                </strong>{' '}
                on {formatDate(pendingDelete.date, 'medium', settings.locale)}
                {pendingDelete.note ? ` — “${pendingDelete.note}”` : ''}.
              </p>
              <p>This removes the entry from your records on this device. It cannot be undone, but your next backup will no longer contain it. Consider exporting a backup first if you are unsure.</p>
            </>
          ) : null
        }
        confirmLabel="Delete entry"
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await deleteEntry(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

/* ------------------------------- budgets ------------------------------- */

function BudgetsTab({ money, range }: { money: (v: number) => string; range: { from: string; to: string; label: string } }) {
  const { data, saveBudget, deleteBudget, settings } = useStore();
  const [limit, setLimit] = useState('');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [period, setPeriod] = useState<'monthly' | 'weekly'>('monthly');
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Budget | null>(null);

  const periodEntries = data.entries.filter((entry) => entry.date >= range.from && entry.date <= range.to);

  const add = async () => {
    const parsed = parseAmount(limit);
    if (parsed === null || parsed <= 0) {
      setError('Enter a limit greater than zero, digits only.');
      return;
    }
    setError(null);
    const now = new Date().toISOString();
    const existing = data.budgets.find((b) => b.categoryId === categoryId && b.period === period);
    const budget: Budget = {
      id: existing?.id ?? createId('bud'),
      categoryId,
      period,
      limit: parsed,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await saveBudget(budget);
    setLimit('');
  };

  return (
    <>
      <Card title="Budget limits" subtitle="Optional. A limit is compared with your recorded expenses for the selected period.">
        <div className="inline-form">
          <SelectField
            label="Applies to"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            options={[
              { value: 'all', label: 'All expenses' },
              ...data.categories.filter((c) => c.type === 'expense').map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <SelectField
            label="Period"
            value={period}
            onChange={(event) => setPeriod(event.target.value as 'monthly' | 'weekly')}
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'weekly', label: 'Weekly' },
            ]}
          />
          <TextField
            label="Limit amount"
            inputMode="decimal"
            placeholder="0.00"
            value={limit}
            error={error}
            onChange={(event) => setLimit(event.target.value)}
          />
          <Button icon="plus" variant="accent" onClick={() => void add()}>
            Save limit
          </Button>
        </div>
        <p className="tiny muted" style={{ marginTop: 8, marginBottom: 0 }}>
          Saving a limit for a category and period that already has one updates it rather than creating a duplicate.
        </p>
      </Card>

      <Card title="Current limits" subtitle={`Checked against ${range.label}`}>
        {data.budgets.length === 0 ? (
          <EmptyState icon="target" title="No budget limits yet">
            You do not need a budget to use the tracker. Many people start with a single limit for “All expenses” in the
            monthly period and refine it after a month or two of records.
          </EmptyState>
        ) : (
          <div className="stack-sm">
            {data.budgets.map((budget) => {
              const status = budgetStatus(budget, periodEntries);
              const name =
                budget.categoryId === 'all'
                  ? 'All expenses'
                  : data.categories.find((c) => c.id === budget.categoryId)?.name ?? 'Unknown';
              return (
                <div key={budget.id} className="card" style={{ boxShadow: 'none' }}>
                  <div className="row-between wrap">
                    <div>
                      <strong>{name}</strong>{' '}
                      <Badge tone={budget.period === 'monthly' ? 'info' : 'neutral'}>{budget.period}</Badge>
                      {status.overBudget ? (
                        <>
                          {' '}
                          <Badge tone="danger">Over limit</Badge>
                        </>
                      ) : null}
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="small mono">
                        {money(status.spent)} / {money(status.limit)}
                      </span>
                      <IconButton icon="trash" label={`Delete ${name} ${budget.period} budget`} onClick={() => setPendingDelete(budget)} />
                    </div>
                  </div>
                  <ProgressBar percent={status.percentUsed} label={`${name} budget usage`} />
                  <p className="tiny muted" style={{ margin: '6px 0 0' }}>
                    {status.overBudget
                      ? `Recorded expenses exceed the limit by ${money(Math.abs(status.remaining))}.`
                      : `${money(status.remaining)} remains in ${range.label}.`}{' '}
                    Limits are compared with recorded expenses only ({settings.currency}).
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this budget limit?"
        message="Your entries are not affected — only the limit is removed."
        confirmLabel="Delete limit"
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await deleteBudget(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </>
  );
}

/* ------------------------------- goals ------------------------------- */

function GoalsTab({ money }: { money: (v: number) => string }) {
  const { data, saveGoal, deleteGoal } = useStore();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [contribution, setContribution] = useState<{ goalId: string; amount: string; date: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SavingsGoal | null>(null);

  const addGoal = async () => {
    const parsed = parseAmount(target);
    if (name.trim().length === 0) {
      setError('Give the goal a name.');
      return;
    }
    if (parsed === null || parsed <= 0) {
      setError('Enter a target amount greater than zero.');
      return;
    }
    setError(null);
    const now = new Date().toISOString();
    await saveGoal({
      id: createId('goal'),
      name: cleanText(name, 80),
      target: parsed,
      note: cleanText(note, 300),
      contributions: [],
      createdAt: now,
      updatedAt: now,
    });
    setName('');
    setTarget('');
    setNote('');
  };

  const addContribution = async () => {
    if (!contribution) return;
    const parsed = parseAmount(contribution.amount);
    const goal = data.goals.find((g) => g.id === contribution.goalId);
    if (!goal || parsed === null || parsed <= 0) return;
    await saveGoal({
      ...goal,
      contributions: [...goal.contributions, { id: createId('con'), amount: parsed, date: contribution.date || todayISO() }],
      updatedAt: new Date().toISOString(),
    });
    setContribution(null);
  };

  return (
    <>
      <Card title="Create a savings goal" subtitle="A target you track yourself. LIFEKIT cannot move money.">
        <div className="inline-form">
          <TextField label="Goal name" placeholder="e.g. emergency fund" value={name} error={error} onChange={(event) => setName(event.target.value)} />
          <TextField label="Target amount" inputMode="decimal" placeholder="0.00" value={target} onChange={(event) => setTarget(event.target.value)} />
          <TextField label="Note (optional)" value={note} onChange={(event) => setNote(event.target.value)} />
          <Button icon="plus" variant="accent" onClick={() => void addGoal()}>
            Create goal
          </Button>
        </div>
      </Card>

      <Card title="Your goals">
        {data.goals.length === 0 ? (
          <EmptyState icon="target" title="No savings goals yet">
            A common first goal is one month of essential spending. Add contributions as you set money aside — the progress
            bar is arithmetic on what you entered, not a forecast.
          </EmptyState>
        ) : (
          <div className="stack">
            {data.goals.map((goal) => {
              const progress = goalProgress(goal);
              return (
                <div key={goal.id} className="card" style={{ boxShadow: 'none' }}>
                  <div className="row-between wrap">
                    <div>
                      <strong>{goal.name}</strong> {progress.complete ? <Badge tone="accent">Target reached</Badge> : null}
                      {goal.note ? <p className="small muted" style={{ margin: '2px 0 0' }}>{goal.note}</p> : null}
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon="plus"
                        onClick={() => setContribution({ goalId: goal.id, amount: '', date: todayISO() })}
                      >
                        Add amount
                      </Button>
                      <IconButton icon="trash" label={`Delete goal ${goal.name}`} onClick={() => setPendingDelete(goal)} />
                    </div>
                  </div>
                  <div className="row-between" style={{ marginTop: 8 }}>
                    <span className="small mono">
                      {money(progress.saved)} of {money(progress.target)} ({progress.percent}%)
                    </span>
                    <span className="small muted">
                      {progress.remaining > 0 ? `${money(progress.remaining)} to go` : 'Target reached'}
                    </span>
                  </div>
                  <ProgressBar percent={progress.percent} label={`${goal.name} progress`} tone="never-over" />
                  {progress.monthlyPace !== null && progress.monthsToTarget !== null && progress.remaining > 0 ? (
                    <p className="tiny muted" style={{ margin: '6px 0 0' }}>
                      At your average recorded pace of {money(progress.monthlyPace)} per month, you would reach the target in
                      about {progress.monthsToTarget} month{progress.monthsToTarget === 1 ? '' : 's'}. This is an estimate
                      based on your own past entries — not a prediction or a promise.
                    </p>
                  ) : (
                    <p className="tiny muted" style={{ margin: '6px 0 0' }}>
                      {goal.contributions.length} contribution{goal.contributions.length === 1 ? '' : 's'} recorded.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog open={contribution !== null} onClose={() => setContribution(null)} title="Add to savings goal">
        {contribution ? (
          <>
            <TextField
              label="Amount"
              inputMode="decimal"
              placeholder="0.00"
              value={contribution.amount}
              onChange={(event) => setContribution({ ...contribution, amount: event.target.value })}
            />
            <TextField
              label="Date"
              type="date"
              value={contribution.date}
              onChange={(event) => setContribution({ ...contribution, date: event.target.value })}
            />
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setContribution(null)}>
                Cancel
              </Button>
              <Button variant="accent" onClick={() => void addContribution()}>
                Add amount
              </Button>
            </div>
          </>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this savings goal?"
        message={
          pendingDelete ? (
            <>
              <p>
                <strong>{pendingDelete.name}</strong> and its {pendingDelete.contributions.length} recorded contribution
                {pendingDelete.contributions.length === 1 ? '' : 's'} will be removed from this device.
              </p>
              <p>Linked money entries are not deleted.</p>
            </>
          ) : null
        }
        confirmLabel="Delete goal"
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await deleteGoal(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </>
  );
}

/* ------------------------------- categories ------------------------------- */

function CategoriesTab() {
  const { data, saveCategory, archiveCategory } = useStore();
  const [name, setName] = useState('');
  const [type, setType] = useState<EntryType>('expense');
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    const clean = cleanText(name, 40);
    if (clean.length < 2) {
      setError('Use at least two characters.');
      return;
    }
    const duplicate = data.categories.some(
      (c) => c.type === type && c.name.toLowerCase() === clean.toLowerCase()
    );
    if (duplicate) {
      setError('A category with that name already exists for this type.');
      return;
    }
    setError(null);
    await saveCategory({ id: createId('cat'), name: clean, type, custom: true });
    setName('');
  };

  return (
    <>
      <Card title="Add a category" subtitle="Custom categories work exactly like the built-in ones.">
        <div className="inline-form">
          <TextField label="Category name" value={name} error={error} onChange={(event) => setName(event.target.value)} />
          <SelectField
            label="Type"
            value={type}
            onChange={(event) => setType(event.target.value as EntryType)}
            options={[
              { value: 'expense', label: 'Expense' },
              { value: 'income', label: 'Income' },
            ]}
          />
          <Button icon="plus" variant="accent" onClick={() => void add()}>
            Add category
          </Button>
        </div>
      </Card>

      <div className="grid grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {(['expense', 'income'] as EntryType[]).map((kind) => (
          <Card key={kind} title={kind === 'expense' ? 'Expense categories' : 'Income categories'}>
            <ul className="list">
              {data.categories
                .filter((c) => c.type === kind)
                .map((category) => {
                  const used = data.entries.filter((entry) => entry.categoryId === category.id).length;
                  return (
                    <li className="list-item" key={category.id}>
                      <div className="list-item-main">
                        <div style={{ fontWeight: 550 }}>{category.name}</div>
                        <div className="tiny muted">
                          {category.custom ? 'Custom' : 'Built-in'} · {used} entr{used === 1 ? 'y' : 'ies'}
                          {category.archived ? ' · archived' : ''}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void archiveCategory(category.id, !category.archived)}
                      >
                        {category.archived ? 'Restore' : 'Archive'}
                      </Button>
                    </li>
                  );
                })}
            </ul>
            <p className="tiny muted" style={{ marginTop: 8, marginBottom: 0 }}>
              Archiving hides a category from new entries. Existing entries keep their category, so past reports do not change.
            </p>
          </Card>
        ))}
      </div>
    </>
  );
}

/* ------------------------------- import / export ------------------------------- */

function DataTab({
  money,
  onExportBackup,
  online,
  currency,
}: {
  money: (v: number) => string;
  onExportBackup: () => Promise<void>;
  online: boolean;
  currency: string;
}) {
  const { data, notify, readBackupFile, applyRestore } = useStore();
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<string[] | null>(null);
  const [restore, setRestore] = useState<Awaited<ReturnType<typeof readBackupFile>> | null>(null);
  const [busy, setBusy] = useState(false);

  const runCsvImport = async () => {
    setBusy(true);
    const result = parseEntriesCsv(importText, {
      categoryIdFor: (name) => {
        const match = data.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
        return match?.id ?? categoryIdForName(name, 'expense');
      },
    });
    if (result.entries.length > 0) {
      await repo.saveEntries(result.entries);
      notify(`${result.entries.length} entries imported from CSV.`, 'success');
    }
    const messages = [
      `Read ${result.totalRows} data row${result.totalRows === 1 ? '' : 's'}: ${result.entries.length} imported, ${result.skipped} skipped.`,
      ...result.errors,
    ];
    setImportResult(messages);
    setBusy(false);
  };

  return (
    <>
      <Card title="CSV export" subtitle="Opens in any spreadsheet. Note text is escaped so it cannot be run as a formula.">
        <p className="small muted">
          Columns: date, type, amount, currency, category, note, recurrence, created_at. Export the current filter from the
          Entries tab, or download everything here.
        </p>
        <div className="btn-row">
          <Button
            variant="secondary"
            icon="download"
            onClick={() => {
              const categoryMap = new Map(data.categories.map((c) => [c.id, c.name]));
              downloadBlob(
                `lifekit-money-all-${fileStamp()}.csv`,
                new Blob([entriesToCsv(data.entries, { categories: categoryMap, currency })], { type: 'text/csv;charset=utf-8' })
              );
            }}
            disabled={data.entries.length === 0}
          >
            Export all {data.entries.length} entries
          </Button>
          <Button variant="secondary" icon="download" onClick={() => void onExportBackup()}>
            Full JSON backup
          </Button>
          <Button variant="ghost" icon="settings" onClick={() => navigate(ROUTES.backup)}>
            Backup &amp; restore page
          </Button>
        </div>
      </Card>

      <Card title="CSV import" subtitle="Paste CSV text or choose a file. Nothing is uploaded — parsing happens here.">
        <div className="field">
          <label className="field-label" htmlFor="csv-file">
            Choose a CSV file
          </label>
          <input
            id="csv-file"
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (file.size > 5_000_000) {
                notify('That file is larger than 5 MB. Split it into smaller files.', 'error');
                return;
              }
              setImportText(await file.text());
              setImportResult(null);
            }}
          />
        </div>
        <TextAreaField
          label="Or paste CSV text"
          hint="First line must be a header containing at least: date, type, amount. Optional: category, note, recurrence."
          value={importText}
          onChange={(event) => setImportText(event.target.value)}
          rows={6}
          placeholder={'date,type,amount,category,note\n2026-10-01,expense,250,Food & groceries,vegetables'}
        />
        <div className="btn-row">
          <Button variant="accent" icon="upload" disabled={busy || importText.trim() === ''} onClick={() => void runCsvImport()}>
            {busy ? 'Checking…' : 'Validate and import'}
          </Button>
          <Button variant="ghost" onClick={() => { setImportText(''); setImportResult(null); }}>
            Clear
          </Button>
        </div>
        {importResult ? (
          <div className="notice" style={{ marginTop: 12 }}>
            <div>
              {importResult.map((line, index) => (
                <p key={index} className="small" style={{ margin: index === 0 ? 0 : '4px 0 0' }}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      <Card title="Restore a backup" subtitle="JSON files only, validated before anything is written.">
        <div className="field">
          <label className="field-label" htmlFor="backup-file">
            Choose a LIFEKIT backup file
          </label>
          <input
            id="backup-file"
            type="file"
            accept="application/json,.json"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setRestore(await readBackupFile(file));
            }}
          />
        </div>
        {restore ? (
          <div className={restore.ok ? 'notice' : 'notice notice-danger'} role={restore.ok ? undefined : 'alert'}>
            <div>
              {restore.ok ? (
                <>
                  <p className="small" style={{ margin: 0 }}>
                    <strong>Backup verified.</strong> Exported {restore.exportedAt ? new Date(restore.exportedAt).toLocaleString() : 'unknown date'}
                    {restore.appVersion ? ` by LIFEKIT ${restore.appVersion}` : ''}.
                  </p>
                  <ul className="small">
                    {Object.entries(restore.counts)
                      .filter(([, count]) => count > 0)
                      .map(([key, count]) => (
                        <li key={key}>
                          {count} {key}
                        </li>
                      ))}
                  </ul>
                  {restore.warnings.length > 0 ? (
                    <div className="notice notice-warning" style={{ marginTop: 8 }}>
                      <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                        {restore.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <Button
                    variant="danger"
                    icon="upload"
                    onClick={async () => {
                      if (restore.data) {
                        await applyRestore(restore.data);
                        setRestore(null);
                      }
                    }}
                  >
                    Replace all local records with this backup
                  </Button>
                </>
              ) : (
                <>
                  <p className="small" style={{ margin: 0 }}>
                    <strong>This file was rejected.</strong>
                  </p>
                  <ul className="small">
                    {restore.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                  <p className="small" style={{ margin: 0 }}>
                    Nothing on this device was changed.
                  </p>
                </>
              )}
            </div>
          </div>
        ) : null}
        <p className="tiny muted" style={{ marginTop: 12, marginBottom: 0 }}>
          Import runs entirely offline{online ? '' : ' — you are offline now, and this still works'}. Malformed records are
          reported and skipped rather than guessed at, and a restore replaces your local records with the file’s contents.
        </p>
      </Card>

      <Card title="What leaves this device">
        <ul className="small">
          <li>Nothing. Money entries are stored in this browser’s IndexedDB and are never uploaded.</li>
          <li>
            CSV exports and backup files are created in your browser and downloaded directly to your device. If you then
            email or upload them, that is your choice — LIFEKIT does not do it for you.
          </li>
          <li>Notifications never contain money amounts. Reminder text is built from task titles only.</li>
          <li>
            Current recorded total for reference: {money(summarize(data.entries).income)} in and{' '}
            {money(summarize(data.entries).expense)} out, from {data.entries.length} entries.
          </li>
        </ul>
      </Card>
    </>
  );
}

export default Money;
