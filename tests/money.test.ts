/**
 * Money maths tests.
 *
 * These cover the guarantees the Money screen relies on: amounts parse strictly, totals use
 * integer minor units (so decimals cannot drift), budget and goal maths are exact, and
 * filters do not silently drop or duplicate entries.
 */
import { describe, expect, it } from 'vitest';
import {
  addMoney,
  budgetStatus,
  categoryBreakdown,
  filterEntries,
  formatMoney,
  fromMinor,
  goalProgress,
  monthlyEquivalent,
  monthlySeries,
  multiplyMoney,
  nextOccurrence,
  parseAmount,
  projectRecurring,
  roundMoney,
  subMoney,
  summarize,
  toMinor,
  type Budget,
  type MoneyEntry,
  type SavingsGoal,
} from '../src/lib/money';

function entry(partial: Partial<MoneyEntry> & Pick<MoneyEntry, 'type' | 'amount' | 'date'>): MoneyEntry {
  return {
    id: partial.id ?? `e-${Math.random().toString(36).slice(2)}`,
    categoryId: partial.categoryId ?? (partial.type === 'income' ? 'income_salary' : 'expense_food'),
    note: partial.note ?? '',
    createdAt: partial.createdAt ?? '2026-10-01T10:00:00.000Z',
    updatedAt: partial.updatedAt ?? '2026-10-01T10:00:00.000Z',
    ...partial,
  } as MoneyEntry;
}

describe('parseAmount', () => {
  it('accepts plain integers and decimals', () => {
    expect(parseAmount('450')).toBe(450);
    expect(parseAmount('450.5')).toBe(450.5);
    expect(parseAmount('450.55')).toBe(450.55);
    expect(parseAmount('0.01')).toBe(0.01);
    expect(parseAmount('0')).toBe(0);
  });

  it('accepts formatted input a person would actually type', () => {
    expect(parseAmount('1,234.50')).toBe(1234.5);
    expect(parseAmount('1,23,456.78')).toBe(123456.78);
    expect(parseAmount('₹ 500')).toBe(500);
    expect(parseAmount('Rs. 1,000')).toBe(1000);
    expect(parseAmount('  250  ')).toBe(250);
    expect(parseAmount(999.99)).toBe(999.99);
  });

  it('rejects values that are not unambiguously a positive amount', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('   ')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('-100')).toBeNull();
    expect(parseAmount('+100')).toBeNull();
    expect(parseAmount('1.2.3')).toBeNull();
    expect(parseAmount('1.999')).toBeNull(); // more than 2 decimals
    expect(parseAmount('12,34,5')).toBeNull();
    expect(parseAmount('NaN')).toBeNull();
    expect(parseAmount(Infinity)).toBeNull();
    expect(parseAmount(-5)).toBeNull();
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
    expect(parseAmount('1e5')).toBeNull();
    expect(parseAmount('1 2 3')).toBeNull();
  });

  it('rejects amounts beyond the supported maximum', () => {
    expect(parseAmount('1000000000001')).toBeNull();
    expect(parseAmount('1000000000000')).toBe(1_000_000_000_000);
  });

  it('normalises to two decimal places', () => {
    expect(parseAmount('10.005')).toBeNull(); // three decimals is rejected, not rounded
    expect(parseAmount('10.01')).toBe(10.01);
  });
});

describe('decimal arithmetic', () => {
  it('does not accumulate floating point drift', () => {
    // The classic 0.1 + 0.2 problem must not reach a user-visible total.
    expect(addMoney(0.1, 0.2)).toBe(0.3);
    const many = Array.from({ length: 100 }, () => 0.07);
    expect(addMoney(...many)).toBe(7);
  });

  it('rounds half-up on minor units', () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(2.675)).toBe(2.68);
    expect(toMinor(19.99)).toBe(1999);
    expect(fromMinor(1999)).toBe(19.99);
  });

  it('multiplies without drift', () => {
    expect(multiplyMoney(33.33, 3)).toBe(99.99);
    expect(multiplyMoney(100, 0.15)).toBe(15);
  });

  it('subtracts correctly across integer boundaries', () => {
    expect(subMoney(100, 99.99)).toBe(0.01);
    expect(subMoney(0.3, 0.1)).toBe(0.2);
  });
});

describe('summarize', () => {
  const entries = [
    entry({ type: 'income', amount: 30000, date: '2026-10-01' }),
    entry({ type: 'income', amount: 1500.5, date: '2026-10-15' }),
    entry({ type: 'expense', amount: 12000, date: '2026-10-02' }),
    entry({ type: 'expense', amount: 899.5, date: '2026-10-03' }),
  ];

  it('totals income and expenses and reports net recorded cash flow', () => {
    const summary = summarize(entries);
    expect(summary.income).toBe(31500.5);
    expect(summary.expense).toBe(12899.5);
    expect(summary.net).toBe(18601);
    expect(summary.entryCount).toBe(4);
    expect(summary.incomeCount).toBe(2);
    expect(summary.expenseCount).toBe(2);
  });

  it('handles an empty list', () => {
    expect(summarize([])).toEqual({ income: 0, expense: 0, net: 0, entryCount: 0, incomeCount: 0, expenseCount: 0 });
  });

  it('ignores non-finite amounts rather than poisoning the total', () => {
    const dirty = [entry({ type: 'income', amount: Number.NaN, date: '2026-10-01' }), entry({ type: 'income', amount: 100, date: '2026-10-01' })];
    expect(summarize(dirty).income).toBe(100);
  });
});

describe('categoryBreakdown', () => {
  it('groups expenses by category, largest first, with shares', () => {
    const entries = [
      entry({ type: 'expense', amount: 500, date: '2026-10-01', categoryId: 'expense_food' }),
      entry({ type: 'expense', amount: 1500, date: '2026-10-02', categoryId: 'expense_rent' }),
      entry({ type: 'expense', amount: 500, date: '2026-10-03', categoryId: 'expense_food' }),
      entry({ type: 'income', amount: 9000, date: '2026-10-03' }),
    ];
    const rows = categoryBreakdown(entries, 'expense');
    expect(rows).toHaveLength(2);
    expect(rows[0].categoryId).toBe('expense_rent');
    expect(rows[0].total).toBe(1500);
    expect(rows[0].share).toBeCloseTo(0.6, 10);
    expect(rows[1].categoryId).toBe('expense_food');
    expect(rows[1].total).toBe(1000);
    expect(rows[1].count).toBe(2);
    // Income is excluded entirely from an expense breakdown.
    expect(rows.reduce((sum, row) => sum + row.total, 0)).toBe(2500);
  });

  it('returns an empty array when there is nothing to group', () => {
    expect(categoryBreakdown([], 'expense')).toEqual([]);
  });
});

describe('budgetStatus', () => {
  const budget: Budget = {
    id: 'b1',
    categoryId: 'expense_food',
    period: 'monthly',
    limit: 5000,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  it('computes remaining budget for eligible expenses only', () => {
    const periodEntries = [
      entry({ type: 'expense', amount: 1200, date: '2026-10-02', categoryId: 'expense_food' }),
      entry({ type: 'expense', amount: 800.5, date: '2026-10-04', categoryId: 'expense_food' }),
      entry({ type: 'expense', amount: 3000, date: '2026-10-05', categoryId: 'expense_rent' }),
      entry({ type: 'income', amount: 1000, date: '2026-10-06' }),
    ];
    const status = budgetStatus(budget, periodEntries);
    expect(status.spent).toBe(2000.5);
    expect(status.remaining).toBe(2999.5);
    expect(status.overBudget).toBe(false);
    expect(status.percentUsed).toBe(40); // rounded to one decimal place by design
  });

  it('flags an over-budget category and reports the overage as a negative remainder', () => {
    const periodEntries = [entry({ type: 'expense', amount: 6000, date: '2026-10-02', categoryId: 'expense_food' })];
    const status = budgetStatus(budget, periodEntries);
    expect(status.spent).toBe(6000);
    expect(status.remaining).toBe(-1000);
    expect(status.overBudget).toBe(true);
    expect(status.percentUsed).toBe(120);
  });

  it('treats a category of "all" as every expense', () => {
    const allBudget: Budget = { ...budget, categoryId: 'all', limit: 10000 };
    const status = budgetStatus(allBudget, [
      entry({ type: 'expense', amount: 100, date: '2026-10-02', categoryId: 'expense_food' }),
      entry({ type: 'expense', amount: 250, date: '2026-10-02', categoryId: 'expense_transport' }),
    ]);
    expect(status.spent).toBe(350);
    expect(status.remaining).toBe(9650);
  });

  it('handles a zero limit without dividing by zero', () => {
    const zero: Budget = { ...budget, limit: 0 };
    expect(budgetStatus(zero, []).percentUsed).toBe(0);
    expect(budgetStatus(zero, [entry({ type: 'expense', amount: 1, date: '2026-10-01' })]).percentUsed).toBe(999);
  });
});

describe('goalProgress', () => {
  const goal: SavingsGoal = {
    id: 'g1',
    name: 'Emergency fund',
    target: 30000,
    contributions: [
      { id: 'c1', amount: 5000, date: '2026-08-01' },
      { id: 'c2', amount: 7500, date: '2026-09-01' },
      { id: 'c3', amount: 2500, date: '2026-10-01' },
    ],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  it('sums contributions and clamps the percentage', () => {
    const progress = goalProgress(goal, new Date('2026-10-11T00:00:00'));
    expect(progress.saved).toBe(15000);
    expect(progress.remaining).toBe(15000);
    expect(progress.percent).toBe(50);
    expect(progress.complete).toBe(false);
  });

  it('marks a goal complete and never reports a negative remainder', () => {
    const over: SavingsGoal = { ...goal, contributions: [{ id: 'c1', amount: 40000, date: '2026-10-01' }] };
    const progress = goalProgress(over, new Date('2026-10-11T00:00:00'));
    expect(progress.complete).toBe(true);
    expect(progress.remaining).toBe(0);
    expect(progress.percent).toBe(100);
  });

  it('estimates pace from the contribution history', () => {
    const progress = goalProgress(goal, new Date('2026-10-01T00:00:00'));
    expect(progress.monthlyPace).toBe(5000);
    expect(progress.monthsToTarget).toBe(3);
  });

  it('reports no pace when there is not enough history', () => {
    const single: SavingsGoal = { ...goal, contributions: [{ id: 'c1', amount: 1000, date: '2026-10-01' }] };
    expect(goalProgress(single).monthlyPace).toBeNull();
    expect(goalProgress(single).monthsToTarget).toBeNull();
  });
});

describe('filterEntries', () => {
  const entries = [
    entry({ type: 'expense', amount: 250, date: '2026-10-01', note: 'vegetables', categoryId: 'expense_food' }),
    entry({ type: 'expense', amount: 40, date: '2026-10-03', note: 'bus pass', categoryId: 'expense_transport' }),
    entry({ type: 'income', amount: 30000, date: '2026-10-05', note: 'salary', categoryId: 'income_salary' }),
    entry({ type: 'expense', amount: 999, date: '2026-09-20', note: 'shoes', categoryId: 'expense_other' }),
  ];

  it('sorts newest first by default', () => {
    const result = filterEntries(entries, {});
    expect(result.map((row) => row.date)).toEqual(['2026-10-05', '2026-10-03', '2026-10-01', '2026-09-20']);
  });

  it('filters by type, category and date range', () => {
    expect(filterEntries(entries, { type: 'expense' })).toHaveLength(3);
    expect(filterEntries(entries, { categoryId: 'expense_food' })).toHaveLength(1);
    expect(filterEntries(entries, { from: '2026-10-01', to: '2026-10-04' })).toHaveLength(2);
  });

  it('searches notes, amounts and dates case-insensitively', () => {
    expect(filterEntries(entries, { query: 'BUS' })).toHaveLength(1);
    expect(filterEntries(entries, { query: '999' })).toHaveLength(1);
    expect(filterEntries(entries, { query: '2026-09' })).toHaveLength(1);
    expect(filterEntries(entries, { query: 'nothing here' })).toHaveLength(0);
  });

  it('filters by amount range', () => {
    expect(filterEntries(entries, { minAmount: 100, maxAmount: 500 })).toHaveLength(1);
  });

  it('never mutates the input array', () => {
    const snapshot = entries.map((row) => row.id);
    filterEntries(entries, { type: 'expense' });
    expect(entries.map((row) => row.id)).toEqual(snapshot);
  });
});

describe('recurring projections', () => {
  it('converts frequencies to monthly equivalents', () => {
    expect(monthlyEquivalent(1200, 'monthly')).toBe(1200);
    expect(monthlyEquivalent(5200, 'yearly')).toBe(433.33);
    expect(monthlyEquivalent(100, 'weekly')).toBe(433.33);
    expect(monthlyEquivalent(100, 'none')).toBe(0);
  });

  it('projects committed recurring cost and the next due date', () => {
    const entries = [
      entry({ type: 'expense', amount: 1200, date: '2026-01-10', recurrence: { frequency: 'monthly' } }),
      entry({ type: 'expense', amount: 6000, date: '2026-04-01', recurrence: { frequency: 'yearly' } }),
      entry({ type: 'expense', amount: 500, date: '2026-10-01' }), // one-off, excluded
      entry({ type: 'income', amount: 5000, date: '2026-10-01', recurrence: { frequency: 'monthly' } }), // income excluded
    ];
    const projection = projectRecurring(entries, new Date('2026-10-11T00:00:00'));
    expect(projection.count).toBe(2);
    expect(projection.monthlyTotal).toBe(1700);
    expect(projection.yearlyTotal).toBe(20400);
    expect(projection.nextDue).toBe('2026-11-10');
  });

  it('finds the first occurrence on or after a date, including month-end safety', () => {
    expect(nextOccurrence('2026-01-31', 'monthly', '2026-02-01')).toBe('2026-02-28');
    expect(nextOccurrence('2026-10-05', 'weekly', '2026-10-11')).toBe('2026-10-12');
    expect(nextOccurrence('2026-10-20', 'monthly', '2026-10-11')).toBe('2026-10-20');
    expect(nextOccurrence('2026-01-01', 'none', '2026-10-11')).toBeNull();
    expect(nextOccurrence('not-a-date', 'monthly', '2026-10-11')).toBeNull();
  });
});

describe('monthlySeries', () => {
  it('returns a zero-filled series for months with no entries', () => {
    const series = monthlySeries([entry({ type: 'income', amount: 100, date: '2026-10-05' })], ['2026-09', '2026-10']);
    expect(series).toEqual([
      { month: '2026-09', income: 0, expense: 0 },
      { month: '2026-10', income: 100, expense: 0 },
    ]);
  });
});

describe('formatMoney', () => {
  it('formats with the requested currency and locale', () => {
    const formatted = formatMoney(1234.5, { currency: 'INR', locale: 'en-IN' });
    expect(formatted).toContain('1,234.5');
    expect(formatted).toContain('₹');
  });

  it('hides the symbol when asked and survives a bad currency code', () => {
    expect(formatMoney(1000, { hideSymbol: true, locale: 'en-US' })).toBe('1,000');
    expect(formatMoney(500, { currency: 'XXX', locale: 'en-US' })).toContain('500');
  });

  it('never renders a non-finite value as a number', () => {
    expect(formatMoney(Number.NaN, { locale: 'en-US' })).toContain('0');
  });
});
