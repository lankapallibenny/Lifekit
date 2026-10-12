/**
 * LIFEKIT money maths.
 *
 * All arithmetic that produces money values goes through integer minor units
 * (paise/cents) so that 0.1 + 0.2 style floating-point drift can never reach a
 * user-visible total. Input parsing is deliberately conservative: anything that
 * is not an unambiguous, non-negative amount is rejected rather than guessed.
 */

export type EntryType = 'income' | 'expense';
export type RecurrenceFrequency = 'weekly' | 'monthly' | 'yearly' | 'none';

export interface Recurrence {
  frequency: RecurrenceFrequency;
  /** Optional end date (ISO yyyy-mm-dd) after which no further occurrences are expected. */
  until?: string | null;
}

export interface MoneyEntry {
  id: string;
  type: EntryType;
  /** Major units (e.g. rupees), always >= 0, rounded to 2 decimals on write. */
  amount: number;
  /** Local calendar date, ISO yyyy-mm-dd. */
  date: string;
  categoryId: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  recurrence?: Recurrence;
  /** Optional link to a savings goal this entry contributes to. */
  goalId?: string | null;
}

export interface MoneyCategory {
  id: string;
  name: string;
  type: EntryType;
  /** Bundled categories ship with LIFEKIT; custom ones are user-created. */
  custom?: boolean;
  archived?: boolean;
}

export interface Budget {
  id: string;
  /** 'all' applies to every expense category in the period. */
  categoryId: string | 'all';
  period: 'weekly' | 'monthly';
  limit: number;
  createdAt: string;
  updatedAt: string;
}

export interface GoalContribution {
  id: string;
  amount: number;
  date: string;
  note?: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target: number;
  note?: string;
  contributions: GoalContribution[];
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
}

export const MAX_AMOUNT = 1_000_000_000_000; // 1 trillion major units — beyond any personal record
const MAX_DECIMALS = 2;

export function toMinor(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  const scaled = amount * 100;
  // Binary floating point cannot represent 1.005 exactly, so scaling it gives
  // 100.49999999999999 and a naive round() would produce 100 instead of 101. For values in
  // the normal personal-finance range we correct the representation error before rounding.
  // Very large amounts skip the correction because toPrecision() would itself lose digits.
  const corrected = Math.abs(scaled) < 1e12 ? Number.parseFloat(scaled.toPrecision(12)) : scaled;
  return Math.round(corrected);
}

export function fromMinor(minor: number): number {
  return Math.round(minor) / 100;
}

/**
 * Parse a user-typed amount. Accepts "1234", "1,234.50", "₹ 500", "500.5", "1 234.56".
 * Rejects blanks, sign prefixes, unparseable text and values above MAX_AMOUNT.
 * Returns null when the value cannot be used, so callers can show a specific error.
 */
export function parseAmount(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0 || input > MAX_AMOUNT) return null;
    return fromMinor(toMinor(input));
  }

  // Remove currency symbols and currency words, then normalise the space characters people
  // paste in from documents and banking apps.
  let text = String(input)
    .replace(/[\u20B9$€£¥]/g, ' ')
    // Only recognised currency words are removed ("Rs.", "INR", "USD", "rupees"). Anything
    // else containing letters — "1e5", "abc" — then fails the numeric pattern below instead
    // of being partially stripped into a different number.
    .replace(/\b(rs|inr|usd|eur|gbp|rupees?|dollars?|euros?|pounds?|yen)\b\.?/gi, ' ')
    .replace(/[\u00A0\u2009\u202F]/g, ' ')
    .trim();
  if (text === '') return null;

  const groups = text.split(/\s+/).filter((part) => part !== '');
  // Whitespace is only accepted as a thousands separator: "1 234.50" is a number, "1 2 3"
  // is not, and it must never be silently collapsed into 123.
  if (groups.length > 1) {
    const head = groups[0];
    const middle = groups.slice(1, -1);
    const tail = groups[groups.length - 1];
    const headOk = /^\d{1,3}$/.test(head);
    const middleOk = middle.every((part) => /^\d{3}$/.test(part));
    const tailOk = /^\d{3}(\.\d{1,2})?$/.test(tail) || (groups.length === 2 && /^\d{1,3}(\.\d{1,2})?$/.test(tail));
    if (!headOk || !middleOk || !tailOk) return null;
    text = groups.join('');
  }

  if (text.startsWith('-') || text.startsWith('+')) return null;
  // Accept plain digits, and comma grouping in either the international (1,234) or the
  // Indian (1,23,456) style — but nothing else, so no exponent notation and no stray symbols.
  const pattern = /^\d+(\.\d{1,2})?$|^\d{1,3}(,\d{3})+(\.\d{1,2})?$|^\d{1,3}(,\d{2,3})*(\.\d{1,2})?$/;
  if (!pattern.test(text)) return null;

  const plain = text.replace(/,/g, '');
  const value = Number(plain);
  if (!Number.isFinite(value) || value < 0 || value > MAX_AMOUNT) return null;
  const decimals = plain.includes('.') ? plain.split('.')[1].length : 0;
  if (decimals > MAX_DECIMALS) return null;
  return fromMinor(toMinor(value));
}

/** Round a computed amount to 2 decimals using integer minor units. */
export function roundMoney(amount: number): number {
  return fromMinor(toMinor(amount));
}

export function addMoney(...amounts: number[]): number {
  return fromMinor(amounts.reduce((sum, a) => sum + toMinor(a), 0));
}

export function subMoney(a: number, b: number): number {
  return fromMinor(toMinor(a) - toMinor(b));
}

export function multiplyMoney(amount: number, factor: number): number {
  return fromMinor(Math.round(toMinor(amount) * factor));
}

export interface MoneySummary {
  income: number;
  expense: number;
  net: number;
  entryCount: number;
  incomeCount: number;
  expenseCount: number;
}

/** Totals over any list of entries. `net` is *recorded cash flow*, never a bank balance. */
export function summarize(entries: readonly MoneyEntry[]): MoneySummary {
  let incomeMinor = 0;
  let expenseMinor = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  for (const e of entries) {
    if (!Number.isFinite(e.amount)) continue;
    if (e.type === 'income') {
      incomeMinor += toMinor(e.amount);
      incomeCount++;
    } else {
      expenseMinor += toMinor(e.amount);
      expenseCount++;
    }
  }
  return {
    income: fromMinor(incomeMinor),
    expense: fromMinor(expenseMinor),
    net: fromMinor(incomeMinor - expenseMinor),
    entryCount: incomeCount + expenseCount,
    incomeCount,
    expenseCount,
  };
}

export interface CategoryTotal {
  categoryId: string;
  total: number;
  count: number;
  share: number; // 0..1 of the filtered total
}

/** Expense (or income) breakdown by category, largest first. */
export function categoryBreakdown(
  entries: readonly MoneyEntry[],
  type: EntryType = 'expense'
): CategoryTotal[] {
  const totals = new Map<string, { minor: number; count: number }>();
  let grand = 0;
  for (const e of entries) {
    if (e.type !== type) continue;
    const minor = toMinor(e.amount);
    grand += minor;
    const current = totals.get(e.categoryId) ?? { minor: 0, count: 0 };
    current.minor += minor;
    current.count += 1;
    totals.set(e.categoryId, current);
  }
  return [...totals.entries()]
    .map(([categoryId, v]) => ({
      categoryId,
      total: fromMinor(v.minor),
      count: v.count,
      share: grand > 0 ? v.minor / grand : 0,
    }))
    .sort((a, b) => b.total - a.total || a.categoryId.localeCompare(b.categoryId));
}

export interface BudgetStatus {
  budgetId: string;
  categoryId: string | 'all';
  limit: number;
  spent: number;
  remaining: number;
  percentUsed: number; // 0..100+ (capped at 999 for display safety)
  overBudget: boolean;
}

/** Budget status for one budget over an already period-filtered entry list. */
export function budgetStatus(budget: Budget, periodEntries: readonly MoneyEntry[]): BudgetStatus {
  const eligible = periodEntries.filter(
    (e) => e.type === 'expense' && (budget.categoryId === 'all' || e.categoryId === budget.categoryId)
  );
  const spent = summarize(eligible).expense;
  const limitMinor = toMinor(budget.limit);
  const spentMinor = toMinor(spent);
  const remainingMinor = limitMinor - spentMinor;
  const percentUsed =
    limitMinor > 0 ? Math.min(999, Math.round((spentMinor / limitMinor) * 1000) / 10) : spentMinor > 0 ? 999 : 0;
  return {
    budgetId: budget.id,
    categoryId: budget.categoryId,
    limit: budget.limit,
    spent,
    remaining: fromMinor(remainingMinor),
    percentUsed,
    overBudget: remainingMinor < 0,
  };
}

export interface GoalProgress {
  saved: number;
  target: number;
  remaining: number;
  percent: number; // 0..100
  complete: boolean;
  monthlyPace: number | null; // average saved per month over the contribution history
  monthsToTarget: number | null; // naive linear estimate, clearly labelled as an estimate in the UI
}

export function goalProgress(goal: SavingsGoal, today = new Date()): GoalProgress {
  const savedMinor = goal.contributions.reduce((sum, c) => sum + toMinor(c.amount), 0);
  const targetMinor = toMinor(goal.target);
  const remainingMinor = Math.max(0, targetMinor - savedMinor);
  const percent = targetMinor > 0 ? Math.min(100, Math.round((savedMinor / targetMinor) * 1000) / 10) : 0;

  let monthlyPace: number | null = null;
  let monthsToTarget: number | null = null;
  if (goal.contributions.length >= 2) {
    const dates = goal.contributions.map((c) => new Date(c.date + 'T00:00:00')).sort((a, b) => a.getTime() - b.getTime());
    const first = dates[0];
    const last = today > dates[dates.length - 1] ? today : dates[dates.length - 1];
    const months = Math.max(1, (last.getFullYear() - first.getFullYear()) * 12 + (last.getMonth() - first.getMonth()) + 1);
    const paceMinor = Math.round(savedMinor / months);
    monthlyPace = fromMinor(paceMinor);
    if (paceMinor > 0) monthsToTarget = Math.ceil(remainingMinor / paceMinor);
  }
  return {
    saved: fromMinor(savedMinor),
    target: goal.target,
    remaining: fromMinor(remainingMinor),
    percent,
    complete: targetMinor > 0 && savedMinor >= targetMinor,
    monthlyPace,
    monthsToTarget,
  };
}

export interface EntryFilter {
  query?: string;
  type?: EntryType | 'all';
  categoryId?: string | 'all';
  from?: string | null; // inclusive ISO date
  to?: string | null; // inclusive ISO date
  minAmount?: number | null;
  maxAmount?: number | null;
}

/** Search + filter used by the Money screen and the tests. */
export function filterEntries(entries: readonly MoneyEntry[], filter: EntryFilter): MoneyEntry[] {
  const q = (filter.query ?? '').trim().toLowerCase();
  return entries
    .filter((e) => {
      if (filter.type && filter.type !== 'all' && e.type !== filter.type) return false;
      if (filter.categoryId && filter.categoryId !== 'all' && e.categoryId !== filter.categoryId) return false;
      if (filter.from && e.date < filter.from) return false;
      if (filter.to && e.date > filter.to) return false;
      if (filter.minAmount != null && e.amount < filter.minAmount) return false;
      if (filter.maxAmount != null && e.amount > filter.maxAmount) return false;
      if (q) {
        const haystack = `${e.note ?? ''} ${e.amount} ${e.date} ${e.type}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
}

/** Monthly income/expense series for lightweight sparkline-style charts. */
export function monthlySeries(entries: readonly MoneyEntry[], months: string[]): { month: string; income: number; expense: number }[] {
  return months.map((month) => {
    const inMonth = entries.filter((e) => e.date.startsWith(month));
    const s = summarize(inMonth);
    return { month, income: s.income, expense: s.expense };
  });
}

/** Normalise a monthly figure from a recurrence frequency. Used for *estimates* only. */
export function monthlyEquivalent(amount: number, frequency: RecurrenceFrequency): number {
  switch (frequency) {
    case 'weekly':
      return multiplyMoney(amount, 52 / 12);
    case 'monthly':
      return roundMoney(amount);
    case 'yearly':
      return multiplyMoney(amount, 1 / 12);
    default:
      return 0;
  }
}

export interface RecurringProjection {
  monthlyTotal: number;
  yearlyTotal: number;
  count: number;
  nextDue: string | null;
}

/**
 * Basic recurring expense planner: projects committed recurring costs.
 * These are estimates based on the reminders the user entered — never a promise.
 */
export function projectRecurring(
  entries: readonly MoneyEntry[],
  today: Date
): RecurringProjection {
  const recurring = entries.filter(
    (e) => e.type === 'expense' && e.recurrence && e.recurrence.frequency !== 'none'
  );
  let monthlyMinor = 0;
  for (const e of recurring) {
    monthlyMinor += toMinor(monthlyEquivalent(e.amount, e.recurrence!.frequency));
  }
  const todayISO = toISODateSafe(today);
  const upcoming = recurring
    .map((e) => nextOccurrence(e.date, e.recurrence!.frequency, todayISO))
    .filter((d): d is string => Boolean(d))
    .sort();
  return {
    monthlyTotal: fromMinor(monthlyMinor),
    yearlyTotal: fromMinor(monthlyMinor * 12),
    count: recurring.length,
    nextDue: upcoming[0] ?? null,
  };
}

function toISODateSafe(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * First occurrence on/after `fromISO` for a simple recurrence rule.
 *
 * Calendar safety: a monthly pattern keeps the anchor day of the original date and clamps
 * it to the length of each target month, so a bill dated the 31st falls due on 28 or 30
 * February rather than skipping into March. Yearly patterns behave the same way for 29 Feb.
 */
export function nextOccurrence(startISO: string, frequency: RecurrenceFrequency, fromISO: string): string | null {
  if (frequency === 'none') return null;
  const start = new Date(startISO + 'T00:00:00');
  const from = new Date(fromISO + 'T00:00:00');
  if (Number.isNaN(start.getTime()) || Number.isNaN(from.getTime())) return null;
  if (start >= from) return startISO;

  const clampToMonth = (year: number, monthIndex: number, day: number): Date => {
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    return new Date(year, monthIndex, Math.min(day, lastDay));
  };

  if (frequency === 'weekly') {
    const dayMs = 86_400_000;
    const weeks = Math.ceil((from.getTime() - start.getTime()) / (7 * dayMs));
    const candidate = new Date(start.getFullYear(), start.getMonth(), start.getDate() + weeks * 7);
    return toISODateSafe(candidate);
  }

  if (frequency === 'yearly') {
    let years = Math.max(0, from.getFullYear() - start.getFullYear());
    let candidate = clampToMonth(start.getFullYear() + years, start.getMonth(), start.getDate());
    if (candidate < from) {
      years += 1;
      candidate = clampToMonth(start.getFullYear() + years, start.getMonth(), start.getDate());
    }
    return toISODateSafe(candidate);
  }

  // Monthly: step in whole months from the original anchor day.
  let monthsAhead = Math.max(
    0,
    (from.getFullYear() - start.getFullYear()) * 12 + (from.getMonth() - start.getMonth())
  );
  let candidate = clampToMonth(start.getFullYear(), start.getMonth() + monthsAhead, start.getDate());
  if (candidate < from) {
    monthsAhead += 1;
    candidate = clampToMonth(start.getFullYear(), start.getMonth() + monthsAhead, start.getDate());
  }
  return toISODateSafe(candidate);
}

const CURRENCY_FALLBACK: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥' };

/** Format with Intl when available, with a predictable fallback for older budget devices. */
export function formatMoney(
  amount: number,
  options: { currency?: string; locale?: string; hideSymbol?: boolean; showDecimals?: boolean } = {}
): string {
  const { currency = 'INR', locale = 'en-IN', hideSymbol = false, showDecimals = true } = options;
  const safe = roundMoney(Number.isFinite(amount) ? amount : 0);
  try {
    return new Intl.NumberFormat(locale, {
      style: hideSymbol ? 'decimal' : 'currency',
      currency,
      minimumFractionDigits: showDecimals && !Number.isInteger(safe) ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    const symbol = hideSymbol ? '' : CURRENCY_FALLBACK[currency] ?? `${currency} `;
    const fixed = showDecimals && !Number.isInteger(safe) ? safe.toFixed(2) : String(Math.round(safe));
    return symbol + fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
}
