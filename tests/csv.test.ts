/**
 * CSV export/import tests.
 *
 * Two guarantees are verified here: exported files cannot execute anything in a spreadsheet
 * (formula injection), and imported files are never trusted — every malformed row is
 * reported instead of being guessed at or partially applied.
 */
import { describe, expect, it } from 'vitest';
import { csvEscape, entriesToCsv, neutralizeCell, parseCsv, parseEntriesCsv, toCsv } from '../src/lib/csv';
import type { MoneyEntry } from '../src/lib/money';

function entry(partial: Partial<MoneyEntry>): MoneyEntry {
  return {
    id: partial.id ?? 'e1',
    type: partial.type ?? 'expense',
    amount: partial.amount ?? 100,
    date: partial.date ?? '2026-10-01',
    categoryId: partial.categoryId ?? 'expense_food',
    note: partial.note ?? '',
    createdAt: partial.createdAt ?? '2026-10-01T00:00:00.000Z',
    updatedAt: partial.updatedAt ?? '2026-10-01T00:00:00.000Z',
    ...partial,
  } as MoneyEntry;
}

describe('formula injection protection', () => {
  it('prefixes dangerous leading characters', () => {
    expect(neutralizeCell('=1+1')).toBe("'=1+1");
    expect(neutralizeCell('+A1')).toBe("'+A1");
    expect(neutralizeCell('-2')).toBe("'-2");
    expect(neutralizeCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(neutralizeCell('\tcmd')).toBe("'\tcmd");
  });

  it('leaves ordinary text untouched', () => {
    expect(neutralizeCell('groceries')).toBe('groceries');
    expect(neutralizeCell('₹1,200')).toBe('₹1,200');
  });

  it('neutralises and quotes in the same pass', () => {
    expect(csvEscape('=HYPERLINK("http://evil","x")')).toBe('"\'=HYPERLINK(""http://evil"",""x"")"');
    expect(csvEscape('plain')).toBe('plain');
    expect(csvEscape('has,comma')).toBe('"has,comma"');
    expect(csvEscape('has"quote')).toBe('"has""quote"');
    expect(csvEscape('line\nbreak')).toBe('"line\nbreak"');
    expect(csvEscape(null)).toBe('');
  });

  it('keeps a malicious note inert in a full export', () => {
    const csv = entriesToCsv([entry({ note: '=cmd|" /c calc"!A0' })]);
    expect(csv).toContain("'=cmd");
    expect(csv.split('\r\n')[1]).toMatch(/^'?/);
    // The dangerous cell must be quoted so it stays a single field.
    expect(csv).toContain('"\'=cmd');
  });
});

describe('csv serialisation', () => {
  it('escapes fields and uses CRLF line endings per RFC 4180', () => {
    const csv = toCsv([
      ['a', 'b'],
      ['x,y', 'z"q'],
    ]);
    expect(csv).toBe('a,b\r\n"x,y","z""q"');
  });

  it('exports a header row followed by the entries, oldest first', () => {
    const csv = entriesToCsv([
      entry({ id: 'b', date: '2026-10-05', amount: 250.5, note: 'lunch' }),
      entry({ id: 'a', date: '2026-10-01', amount: 100, note: 'tea' }),
    ]);
    const rows = parseCsv(csv);
    expect(rows[0]).toEqual(['date', 'type', 'amount', 'currency', 'category', 'note', 'recurrence', 'created_at']);
    expect(rows[1][0]).toBe('2026-10-01');
    expect(rows[2][0]).toBe('2026-10-05');
    expect(rows[2][2]).toBe('250.50');
  });

  it('maps category ids to readable names when a map is provided', () => {
    const csv = entriesToCsv([entry({ categoryId: 'expense_food' })], { categories: new Map([['expense_food', 'Food & groceries']]) });
    expect(csv).toContain('Food & groceries');
  });
});

describe('csv parsing', () => {
  it('handles quoted fields, embedded commas, newlines and doubled quotes', () => {
    const rows = parseCsv('a,b\n"x,y","line1\nline2"\n"quote""d",z');
    expect(rows).toEqual([
      ['a', 'b'],
      ['x,y', 'line1\nline2'],
      ['quote"d', 'z'],
    ]);
  });

  it('strips a UTF-8 BOM and tolerates CRLF', () => {
    const rows = parseCsv('\uFEFFa,b\r\n1,2\r\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('ignores blank lines', () => {
    expect(parseCsv('a,b\n\n1,2\n\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('money import validation', () => {
  const options = { categoryIdFor: (name: string) => (name ? `cat_${name.toLowerCase()}` : 'expense_other') };

  it('imports a well-formed file and reports the count', () => {
    const csv = 'date,type,amount,category,note\n2026-10-01,expense,250.50,Food,vegetables\n2026-10-02,income,30000,Salary,october';
    const result = parseEntriesCsv(csv, options);
    expect(result.entries).toHaveLength(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    expect(result.entries[0]).toMatchObject({ type: 'expense', amount: 250.5, date: '2026-10-01', note: 'vegetables' });
    expect(result.entries[1].type).toBe('income');
  });

  it('fails clearly when required columns are missing', () => {
    const result = parseEntriesCsv('when,what,howmuch\n2026-10-01,expense,250', options);
    expect(result.entries).toHaveLength(0);
    expect(result.errors[0]).toMatch(/Missing required column/);
  });

  it('reports each bad row with its line number and imports the good ones', () => {
    const csv = [
      'date,type,amount,category,note',
      '2026-10-01,expense,250,Food,ok',
      '01-10-2026,expense,100,Food,bad date',
      '2026-10-02,transfer,100,Food,bad type',
      '2026-10-03,expense,abc,Food,bad amount',
      '2026-10-04,expense,-50,Food,negative',
      '2026-10-05,expense,0,Food,zero',
    ].join('\n');
    const result = parseEntriesCsv(csv, options);
    expect(result.entries).toHaveLength(1);
    expect(result.skipped).toBe(5);
    expect(result.errors.some((error) => error.startsWith('Line 3'))).toBe(true);
    expect(result.errors.some((error) => error.includes('must be income or expense'))).toBe(true);
    expect(result.errors.some((error) => error.includes('not a valid positive number'))).toBe(true);
  });

  it('accepts common synonyms for the type column', () => {
    const csv = 'date,type,amount\n2026-10-01,spent,100\n2026-10-02,debit,50\n2026-10-03,received,900\n2026-10-04,credit,900';
    const result = parseEntriesCsv(csv, options);
    expect(result.entries.map((row) => row.type)).toEqual(['expense', 'expense', 'income', 'income']);
  });

  it('is case-insensitive about headers', () => {
    const csv = 'DATE,TYPE,AMOUNT\n2026-10-01,EXPENSE,10';
    expect(parseEntriesCsv(csv, options).entries).toHaveLength(1);
  });

  it('refuses absurdly large files rather than hanging', () => {
    const rows = ['date,type,amount', ...Array.from({ length: 30 }, (_, i) => `2026-10-01,expense,${i + 1}`)];
    const result = parseEntriesCsv(rows.join('\n'), { ...options, maxRows: 10 });
    expect(result.entries).toHaveLength(0);
    expect(result.errors[0]).toMatch(/at most 10/);
  });

  it('handles an empty file without throwing', () => {
    const result = parseEntriesCsv('', options);
    expect(result.entries).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  it('truncates very long notes instead of storing unbounded text', () => {
    const long = 'x'.repeat(500);
    const result = parseEntriesCsv(`date,type,amount,note\n2026-10-01,expense,10,${long}`, options);
    const note = result.entries[0]?.note ?? '';
    expect(note.length).toBeLessThanOrEqual(300);
  });

  it('gives every imported entry a unique id and a timestamp', () => {
    const csv = 'date,type,amount\n2026-10-01,expense,10\n2026-10-01,expense,20';
    const result = parseEntriesCsv(csv, options);
    const ids = new Set(result.entries.map((row) => row.id));
    expect(ids.size).toBe(2);
    expect(result.entries[0]!.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
