/** Date maths tests: calendar correctness, month-end safety and week boundaries. */
import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  daysBetween,
  daysInMonth,
  endOfMonth,
  endOfWeek,
  formatClock,
  formatDate,
  isValidISODate,
  monthMatrix,
  parseClock,
  parseISODate,
  periodRange,
  recentMonthKeys,
  relativeDayLabel,
  startOfMonth,
  startOfWeek,
  toISODate,
  todayISO,
} from '../src/lib/dates';

describe('ISO date handling', () => {
  it('formats a local date without timezone drift', () => {
    expect(toISODate(new Date(2026, 9, 11))).toBe('2026-10-11');
    expect(toISODate(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(todayISO(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });

  it('validates real calendar dates only', () => {
    expect(isValidISODate('2026-10-11')).toBe(true);
    expect(isValidISODate('2024-02-29')).toBe(true); // leap year
    expect(isValidISODate('2026-02-29')).toBe(false); // not a leap year
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(isValidISODate('2026-00-10')).toBe(false);
    expect(isValidISODate('2026-04-31')).toBe(false);
    expect(isValidISODate('11-10-2026')).toBe(false);
    expect(isValidISODate('2026-1-1')).toBe(false);
    expect(isValidISODate('')).toBe(false);
    expect(isValidISODate(null)).toBe(false);
    expect(isValidISODate(20261011)).toBe(false);
  });

  it('parses or rejects', () => {
    expect(parseISODate('2026-10-11')?.getDate()).toBe(11);
    expect(parseISODate('nope')).toBeNull();
  });
});

describe('day arithmetic', () => {
  it('counts inclusive differences in both directions', () => {
    expect(daysBetween('2026-10-01', '2026-10-11')).toBe(10);
    expect(daysBetween('2026-10-11', '2026-10-01')).toBe(-10);
    expect(daysBetween('2026-10-11', '2026-10-11')).toBe(0);
  });

  it('spans month and year boundaries', () => {
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-01-31', '2026-03-01')).toBe(29);
  });

  it('returns 0 for invalid input rather than NaN', () => {
    expect(daysBetween('bad', '2026-10-11')).toBe(0);
    expect(daysBetween('2026-10-11', '')).toBe(0);
  });

  it('adds and subtracts days across DST-style boundaries safely', () => {
    expect(toISODate(addDays(new Date(2026, 2, 28), 1))).toBe('2026-03-29');
    expect(toISODate(addDays(new Date(2026, 9, 11), -11))).toBe('2026-09-30');
    expect(toISODate(addDays(new Date(2026, 9, 11), 0))).toBe('2026-10-11');
  });

  it('clamps month-end when adding months', () => {
    expect(toISODate(addMonths(new Date(2026, 0, 31), 1))).toBe('2026-02-28');
    expect(toISODate(addMonths(new Date(2026, 0, 15), 12))).toBe('2027-01-15');
    expect(toISODate(addMonths(new Date(2026, 2, 31), -1))).toBe('2026-02-28');
  });

  it('knows month lengths including leap years', () => {
    expect(daysInMonth(2026, 0)).toBe(31);
    expect(daysInMonth(2026, 1)).toBe(28);
    expect(daysInMonth(2024, 1)).toBe(29);
    expect(daysInMonth(2026, 3)).toBe(30);
  });
});

describe('week and month boundaries', () => {
  it('starts weeks on Monday by default and on Sunday when configured', () => {
    // 2026-10-11 is a Sunday.
    expect(toISODate(startOfWeek(new Date(2026, 9, 11)))).toBe('2026-10-05');
    expect(toISODate(endOfWeek(new Date(2026, 9, 11)))).toBe('2026-10-11');
    expect(toISODate(startOfWeek(new Date(2026, 9, 11), 0))).toBe('2026-10-11');
    expect(toISODate(endOfWeek(new Date(2026, 9, 11), 0))).toBe('2026-10-17');
  });

  it('computes month boundaries', () => {
    expect(toISODate(startOfMonth(new Date(2026, 9, 11)))).toBe('2026-10-01');
    expect(toISODate(endOfMonth(new Date(2026, 9, 11)))).toBe('2026-10-31');
    expect(toISODate(endOfMonth(new Date(2026, 1, 5)))).toBe('2026-02-28');
  });

  it('builds a calendar matrix with complete weeks', () => {
    const weeks = monthMatrix(2026, 9, 1);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    const flat = weeks.flat().filter(Boolean) as string[];
    expect(flat).toHaveLength(31);
    expect(flat[0]).toBe('2026-10-01');
    expect(flat[30]).toBe('2026-10-31');
    // Monday-start month matrix begins with a null padding cell for 1 Oct (a Thursday).
    expect(weeks[0].slice(0, 3)).toEqual([null, null, null]);
  });
});

describe('period ranges', () => {
  const reference = new Date(2026, 9, 11);

  it('computes today, week, month and year ranges', () => {
    expect(periodRange('today', reference)).toMatchObject({ from: '2026-10-11', to: '2026-10-11' });
    expect(periodRange('week', reference)).toMatchObject({ from: '2026-10-05', to: '2026-10-11' });
    expect(periodRange('month', reference)).toMatchObject({ from: '2026-10-01', to: '2026-10-31' });
    expect(periodRange('year', reference)).toMatchObject({ from: '2026-01-01', to: '2026-12-31' });
  });

  it('labels ranges for display', () => {
    expect(periodRange('today', reference).label).toBe('Today');
    expect(periodRange('month', reference).label).toContain('2026');
    expect(periodRange('all', reference).from).toBe('1970-01-01');
  });

  it('lists recent month keys oldest first', () => {
    expect(recentMonthKeys(3, reference)).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(recentMonthKeys(2, new Date(2026, 0, 15))).toEqual(['2025-12', '2026-01']);
  });
});

describe('display helpers', () => {
  it('formats dates deterministically', () => {
    expect(formatDate('2026-10-11', 'medium', 'en-GB')).toContain('2026');
    expect(formatDate('2026-10-11', 'numeric', 'en-GB')).toMatch(/\d{2}\/\d{2}\/2026/);
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('describes relative days in words people use', () => {
    expect(relativeDayLabel('2026-10-11', '2026-10-11')).toBe('Today');
    expect(relativeDayLabel('2026-10-12', '2026-10-11')).toBe('Tomorrow');
    expect(relativeDayLabel('2026-10-10', '2026-10-11')).toBe('Yesterday');
    expect(relativeDayLabel('2026-10-05', '2026-10-11')).toBe('6 days overdue');
    expect(relativeDayLabel('2026-10-14', '2026-10-11')).toBe('In 3 days');
  });

  it('formats and parses clock values', () => {
    expect(formatClock(0)).toBe('12:00 AM');
    expect(formatClock(8 * 60 + 30)).toBe('8:30 AM');
    expect(formatClock(13 * 60 + 5)).toBe('1:05 PM');
    expect(formatClock(23 * 60 + 59)).toBe('11:59 PM');
    expect(parseClock('08:30')).toBe(510);
    expect(parseClock('23:59')).toBe(1439);
    expect(parseClock('24:00')).toBeNull();
    expect(parseClock('8:5')).toBeNull();
    expect(parseClock('')).toBeNull();
  });
});
