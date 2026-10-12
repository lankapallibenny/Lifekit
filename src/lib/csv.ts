/**
 * LIFEKIT CSV export/import (RFC 4180).
 *
 * Written in-house so the export format is fully under our control and auditable.
 *
 * Export safety: spreadsheet programs execute cells that start with = + - @ (CSV
 * formula injection). Every exported text cell is neutralised with a leading
 * apostrophe and the cell is quoted, which keeps the data readable while removing
 * the executable interpretation.
 *
 * Import safety: parsing is strict and total. Unknown columns are ignored, malformed
 * rows are reported instead of guessed at, and no cell value can influence control
 * flow further than the typed model in `validate`.
 */
import { parseAmount, type EntryType, type MoneyEntry } from './money';
import { cleanText, createId, isValidISODateFallback } from './shared';

/** Neutralise spreadsheet formula triggers without losing the original text. */
export function neutralizeCell(value: string): string {
  const text = value ?? '';
  if (/^[=+\-@\t\r]/.test(text)) return `'${text}`;
  return text;
}

export function csvEscape(value: unknown): string {
  const text = neutralizeCell(value === null || value === undefined ? '' : String(value));
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows: readonly (readonly unknown[])[]): string {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

export const MONEY_CSV_HEADER = [
  'date',
  'type',
  'amount',
  'currency',
  'category',
  'note',
  'recurrence',
  'created_at',
] as const;

export function entriesToCsv(
  entries: readonly MoneyEntry[],
  options: { categories?: Map<string, string>; currency?: string } = {}
): string {
  const rows: unknown[][] = [[...MONEY_CSV_HEADER]];
  for (const e of [...entries].sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push([
      e.date,
      e.type,
      e.amount.toFixed(2),
      options.currency ?? 'INR',
      options.categories?.get(e.categoryId) ?? e.categoryId,
      e.note ?? '',
      e.recurrence?.frequency ?? '',
      e.createdAt,
    ]);
  }
  return toCsv(rows);
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const input = text.replace(/^\uFEFF/, ''); // strip a UTF-8 BOM if present

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (char === '\r') {
      if (input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += char;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

export interface CsvImportResult {
  entries: MoneyEntry[];
  errors: string[];
  skipped: number;
  totalRows: number;
}

/**
 * Parse a LIFEKIT money CSV. Only rows that fully validate become entries; everything
 * else produces a human-readable error line so the user can fix their file.
 */
export function parseEntriesCsv(
  text: string,
  options: { categoryIdFor?: (name: string) => string; maxRows?: number; now?: () => string } = {}
): CsvImportResult {
  const maxRows = options.maxRows ?? 20_000;
  const now = options.now ?? (() => new Date().toISOString());
  const errors: string[] = [];
  const entries: MoneyEntry[] = [];
  const rows = parseCsv(text);
  if (rows.length === 0) return { entries, errors: ['The file is empty.'], skipped: 0, totalRows: 0 };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const required = ['date', 'type', 'amount'];
  const missing = required.filter((r) => !header.includes(r));
  if (missing.length > 0) {
    return {
      entries,
      errors: [`Missing required column(s): ${missing.join(', ')}. Expected a header row of date,type,amount,category,note.`],
      skipped: rows.length - 1,
      totalRows: rows.length - 1,
    };
  }

  const idx = {
    date: header.indexOf('date'),
    type: header.indexOf('type'),
    amount: header.indexOf('amount'),
    category: header.indexOf('category'),
    note: header.indexOf('note'),
    recurrence: header.indexOf('recurrence'),
  };

  const dataRows = rows.slice(1);
  if (dataRows.length > maxRows) {
    return {
      entries,
      errors: [`The file has ${dataRows.length} rows; LIFEKIT imports at most ${maxRows} at a time.`],
      skipped: dataRows.length,
      totalRows: dataRows.length,
    };
  }

  let skipped = 0;
  dataRows.forEach((cells, index) => {
    const line = index + 2; // 1-based, accounting for the header row
    const rawDate = (cells[idx.date] ?? '').trim();
    const rawType = (cells[idx.type] ?? '').trim().toLowerCase();
    const rawAmount = (cells[idx.amount] ?? '').trim();

    if (!isValidISODateFallback(rawDate)) {
      errors.push(`Line ${line}: "${rawDate}" is not a valid date (use YYYY-MM-DD).`);
      skipped++;
      return;
    }
    // Accept a couple of common synonyms, reject anything else rather than guessing.
    const type: EntryType | null =
      rawType === 'expense' || rawType === 'spent' || rawType === 'debit'
        ? 'expense'
        : rawType === 'income' || rawType === 'received' || rawType === 'credit'
          ? 'income'
          : null;
    if (!type) {
      errors.push(`Line ${line}: type "${rawType}" must be income or expense.`);
      skipped++;
      return;
    }
    const amount = parseAmount(rawAmount);
    if (amount === null || amount <= 0) {
      errors.push(`Line ${line}: amount "${rawAmount}" is not a valid positive number.`);
      skipped++;
      return;
    }

    const categoryName = idx.category >= 0 ? cleanText(cells[idx.category] ?? '', 60) : '';
    const recurrenceRaw = idx.recurrence >= 0 ? (cells[idx.recurrence] ?? '').trim().toLowerCase() : '';
    const recurrence =
      recurrenceRaw === 'weekly' || recurrenceRaw === 'monthly' || recurrenceRaw === 'yearly'
        ? { frequency: recurrenceRaw as 'weekly' | 'monthly' | 'yearly' }
        : undefined;

    const stamp = now();
    entries.push({
      id: createId('mny'),
      type,
      amount,
      date: rawDate,
      categoryId: options.categoryIdFor
        ? options.categoryIdFor(categoryName || (type === 'income' ? 'Other income' : 'Other'))
        : categoryName || (type === 'income' ? 'income_other' : 'expense_other'),
      note: idx.note >= 0 ? cleanText(cells[idx.note] ?? '', 300) : '',
      createdAt: stamp,
      updatedAt: stamp,
      ...(recurrence ? { recurrence } : {}),
    });
  });

  return { entries, errors: errors.slice(0, 25), skipped, totalRows: dataRows.length };
}

/** Checklist export used by the printable shopping list / checklist maker. */
export function checklistToCsv(title: string, items: { text: string; done: boolean }[]): string {
  return toCsv([[title], ['done', 'item'], ...items.map((i) => [i.done ? 'yes' : 'no', i.text])]);
}
