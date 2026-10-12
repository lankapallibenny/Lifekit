/** LIFEKIT date helpers. All calendar maths is done in local time on ISO yyyy-mm-dd strings. */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(now = new Date()): string {
  return toISODate(now);
}

export function isValidISODate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false;
  const d = parseISODate(value);
  return d !== null && toISODate(d) === value;
}

export function parseISODate(value: string): Date | null {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function addMonths(d: Date, months: number): Date {
  const targetMonth = d.getMonth() + months;
  const day = d.getDate();
  const candidate = new Date(d.getFullYear(), targetMonth, 1);
  const lastDay = daysInMonth(candidate.getFullYear(), candidate.getMonth());
  return new Date(candidate.getFullYear(), candidate.getMonth(), Math.min(day, lastDay));
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function startOfWeek(d: Date, weekStartsOn: 0 | 1 = 1): Date {
  const day = d.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  return addDays(startOfDay(d), -diff);
}

export function endOfWeek(d: Date, weekStartsOn: 0 | 1 = 1): Date {
  return addDays(startOfWeek(d, weekStartsOn), 6);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), daysInMonth(d.getFullYear(), d.getMonth()));
}

export function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

/** Inclusive day difference (b - a) in whole days, DST-safe because we compare local midnights. */
export function daysBetween(aISO: string, bISO: string): number {
  const a = parseISODate(aISO);
  const b = parseISODate(bISO);
  if (!a || !b) return 0;
  const MS = 86_400_000;
  // Round to absorb any DST shift inside the interval.
  return Math.round((b.getTime() - a.getTime()) / MS);
}

export interface DateRange {
  from: string;
  to: string;
  label: string;
}

export type PeriodKind = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';

export function periodRange(
  kind: PeriodKind,
  reference = new Date(),
  weekStartsOn: 0 | 1 = 1,
  allTimeStart = '1970-01-01'
): DateRange {
  switch (kind) {
    case 'today': {
      const t = toISODate(reference);
      return { from: t, to: t, label: 'Today' };
    }
    case 'week': {
      const from = startOfWeek(reference, weekStartsOn);
      const to = endOfWeek(reference, weekStartsOn);
      return {
        from: toISODate(from),
        to: toISODate(to),
        label: `Week of ${formatDate(toISODate(from), 'medium')}`,
      };
    }
    case 'month': {
      const from = startOfMonth(reference);
      const to = endOfMonth(reference);
      return { from: toISODate(from), to: toISODate(to), label: formatMonth(reference) };
    }
    case 'year': {
      return {
        from: toISODate(startOfYear(reference)),
        to: toISODate(new Date(reference.getFullYear(), 11, 31)),
        label: String(reference.getFullYear()),
      };
    }
    case 'custom':
      return { from: toISODate(startOfMonth(reference)), to: toISODate(reference), label: 'Custom range' };
    case 'all':
    default:
      return { from: allTimeStart, to: toISODate(reference), label: 'All recorded' };
  }
}

export function inRange(iso: string, range: { from: string; to: string }): boolean {
  return iso >= range.from && iso <= range.to;
}

/** Last `count` month keys (yyyy-mm), oldest first, ending with the reference month. */
export function recentMonthKeys(count: number, reference = new Date()): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = addMonths(startOfMonth(reference), -i);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export type DateStyle = 'short' | 'medium' | 'long' | 'weekday' | 'numeric';

/** Locale-aware formatting with an explicit fallback so tests are deterministic. */
export function formatDate(iso: string, style: DateStyle = 'medium', locale = 'en-GB'): string {
  const date = parseISODate(iso);
  if (!date) return iso;
  try {
    const options: Intl.DateTimeFormatOptions =
      style === 'short'
        ? { day: 'numeric', month: 'short' }
        : style === 'long'
          ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
          : style === 'weekday'
            ? { weekday: 'short' }
            : style === 'numeric'
              ? { day: '2-digit', month: '2-digit', year: 'numeric' }
              : { day: 'numeric', month: 'short', year: 'numeric' };
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch {
    const d = String(date.getDate()).padStart(2, '0');
    const m = MONTHS[date.getMonth()].slice(0, 3);
    if (style === 'long') return `${WEEKDAYS[date.getDay()]}, ${d} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
    if (style === 'weekday') return WEEKDAYS[date.getDay()].slice(0, 3);
    if (style === 'numeric') return `${d}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    return style === 'short' ? `${d} ${m}` : `${d} ${m} ${date.getFullYear()}`;
  }
}

export function formatMonth(d: Date, locale = 'en-GB'): string {
  try {
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d);
  } catch {
    return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }
}

export function formatMonthKey(key: string, locale = 'en-GB', short = false): string {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  const d = new Date(y, m - 1, 1);
  try {
    return new Intl.DateTimeFormat(locale, { month: short ? 'short' : 'long', year: 'numeric' }).format(d);
  } catch {
    return `${MONTHS[m - 1].slice(0, short ? 3 : undefined)} ${y}`;
  }
}

export function weekdayLabel(index: number): string {
  return WEEKDAYS[((index % 7) + 7) % 7];
}

export function monthMatrix(year: number, monthIndex: number, weekStartsOn: 0 | 1 = 1): (string | null)[][] {
  const first = new Date(year, monthIndex, 1);
  const total = daysInMonth(year, monthIndex);
  const lead = (first.getDay() - weekStartsOn + 7) % 7;
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let day = 1; day <= total; day++) cells.push(toISODate(new Date(year, monthIndex, day)));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** "Today", "Tomorrow", "3 days overdue", "in 5 days". */
export function relativeDayLabel(iso: string, today = todayISO()): string {
  const diff = daysBetween(today, iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0) return `${Math.abs(diff)} days overdue`;
  if (diff <= 7) return `In ${diff} days`;
  return formatDate(iso, 'medium');
}

export function greetingKey(now = new Date()): 'morning' | 'afternoon' | 'evening' {
  const h = now.getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export function nowISO(now = new Date()): string {
  return now.toISOString();
}

export function formatClock(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm} ${suffix}`;
}

export function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec((value ?? '').trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}
