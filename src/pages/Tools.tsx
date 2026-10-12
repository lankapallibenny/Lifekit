/**
 * LIFEKIT offline tools.
 *
 * Ten small utilities that work with no network and no account: calculator, unit
 * converter, percentage calculator, date calculator, checklist maker, notes, study timer,
 * savings goal calculator, printable shopping list and a recurring expense planner.
 *
 * Everything here is arithmetic and local storage. No tool claims financial outcomes, and
 * the calculator parses expressions with a hand-written evaluator rather than eval().
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Notice,
  PageHeader,
  Segmented,
  SelectField,
  StatTile,
  TextAreaField,
  TextField,
} from '../components/ui';
import { Icon } from '../components/Icons';
import { useStore } from '../state/store';
import { evaluate, percentChange, percentOf, savingsPlan, subtractPercent, whatPercent } from '../lib/calc';
import { UNIT_CATEGORIES, convertUnit, formatNumber, type UnitCategory } from '../lib/units';
import {
  addDays,
  daysBetween,
  formatClock,
  formatDate,
  parseISODate,
  todayISO,
  toISODate,
} from '../lib/dates';
import { formatMoney, monthlyEquivalent, parseAmount, projectRecurring, summarize } from '../lib/money';
import { cleanMultiline, cleanText, createId, downloadBlob, fileStamp } from '../lib/shared';
import { checklistToCsv } from '../lib/csv';
import type { Checklist } from '../lib/models';

type Tab =
  | 'calculator'
  | 'converter'
  | 'percentage'
  | 'dates'
  | 'checklists'
  | 'notes'
  | 'timer'
  | 'savings'
  | 'shopping'
  | 'recurring';

const TABS: { value: Tab; label: string }[] = [
  { value: 'calculator', label: 'Calculator' },
  { value: 'converter', label: 'Unit converter' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'dates', label: 'Date calculator' },
  { value: 'checklists', label: 'Checklists' },
  { value: 'notes', label: 'Notes' },
  { value: 'timer', label: 'Study timer' },
  { value: 'savings', label: 'Savings goal' },
  { value: 'shopping', label: 'Shopping list' },
  { value: 'recurring', label: 'Recurring costs' },
];

/* ------------------------------- calculator ------------------------------- */

function Calculator(): JSX.Element {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const historyRef = useRef<string[]>([]);

  const compute = (value: string) => {
    const outcome = evaluate(value);
    if (outcome.ok) {
      setResult(outcome.value);
      setError(null);
      historyRef.current = [`${value} = ${outcome.value}`, ...historyRef.current].slice(0, 5);
    } else {
      setError(outcome.error);
      setResult(null);
    }
  };

  const press = (key: string) => {
    setError(null);
    if (key === 'C') {
      setExpression('');
      setResult(null);
      return;
    }
    if (key === 'DEL') {
      setExpression((current) => current.slice(0, -1));
      return;
    }
    if (key === '=') {
      compute(expression);
      return;
    }
    setExpression((current) => current + key);
  };

  const keys = ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '%', '+', '(', ')', 'DEL', 'C'];

  return (
    <Card title="Calculator" subtitle="Typed or tapped. Percent divides by 100, so 200*10% is 20.">
      <div className="calc-display" aria-live="polite">
        <div className="calc-expression">{expression || '\u00A0'}</div>
        <div className="calc-value" data-testid="calc-value">
          {error ? '—' : result !== null ? formatNumber(result, 10) : '0'}
        </div>
      </div>

      <div style={{ marginTop: 'var(--space-3)' }}>
        <TextField
          label="Expression"
          value={expression}
          placeholder="e.g. (1250+340)*12/100"
          inputMode="text"
          autoComplete="off"
          error={error}
          onChange={(event) => {
            setExpression(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              compute(expression);
            }
          }}
        />
      </div>

      <div className="calc-grid">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            data-variant={['/', '*', '-', '+', '%'].includes(key) ? 'op' : undefined}
            onClick={() => press(key)}
            aria-label={key === 'DEL' ? 'Delete last character' : key === 'C' ? 'Clear' : key}
          >
            {key === 'DEL' ? '⌫' : key}
          </button>
        ))}
        <button type="button" data-variant="equals" onClick={() => press('=')} aria-label="Equals">
          =
        </button>
      </div>

      <p className="tiny muted" style={{ marginTop: 12, marginBottom: 0 }}>
        Uses a hand-written parser: only numbers, + − × ÷, brackets and percent are accepted, so there is nothing here that can
        execute code.
      </p>
    </Card>
  );
}

/* ------------------------------- converter ------------------------------- */

function Converter(): JSX.Element {
  const [category, setCategory] = useState<UnitCategory>('length');
  const info = UNIT_CATEGORIES.find((c) => c.id === category) as (typeof UNIT_CATEGORIES)[number];
  const [from, setFrom] = useState(info.units[0].id);
  const [to, setTo] = useState(info.units[1].id);
  const [value, setValue] = useState('1');

  useEffect(() => {
    const next = UNIT_CATEGORIES.find((c) => c.id === category);
    if (next) {
      setFrom(next.units[0].id);
      setTo(next.units[1].id);
    }
  }, [category]);

  const parsed = Number(value.replace(/,/g, ''));
  const converted = Number.isFinite(parsed) ? convertUnit(category, parsed, from, to) : null;

  return (
    <Card title="Unit converter" subtitle="Exact definitions where they exist; approximations are labelled.">
      <SelectField
        label="What are you converting?"
        value={category}
        onChange={(event) => setCategory(event.target.value as UnitCategory)}
        options={UNIT_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
      />
      <TextField
        label="Value"
        inputMode="decimal"
        value={value}
        error={value.trim() !== '' && !Number.isFinite(parsed) ? 'Enter a number.' : null}
        onChange={(event) => setValue(event.target.value)}
      />
      <div className="grid grid-2">
        <SelectField
          label="From"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          options={info.units.map((u) => ({ value: u.id, label: u.label }))}
        />
        <SelectField
          label="To"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          options={info.units.map((u) => ({ value: u.id, label: u.label }))}
        />
      </div>
      <div className="stat" role="status" aria-live="polite">
        <div className="stat-label">Result</div>
        <div className="stat-value" data-testid="converter-result">
          {converted === null ? '—' : `${formatNumber(converted)} ${info.units.find((u) => u.id === to)?.label.split(' ')[0] ?? ''}`}
        </div>
        <div className="tiny muted">
          {converted === null
            ? 'Enter a value to convert.'
            : `${formatNumber(parsed)} ${info.units.find((u) => u.id === from)?.label} = ${formatNumber(converted)} ${info.units.find((u) => u.id === to)?.label.split(' ')[0]}`}
        </div>
      </div>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <Button
          size="sm"
          variant="secondary"
          icon="repeat"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
        >
          Swap units
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setValue('1')}>
          Reset value
        </Button>
      </div>
      <p className="tiny muted" style={{ marginTop: 12, marginBottom: 0 }}>
        Indian land units (cent, guntha) use standardised values. Month and year conversions use average lengths (30.44 and
        365.25 days) and are approximate. Data units use binary multiples (1 GB = 1024 MB).
      </p>
    </Card>
  );
}

/* ------------------------------- percentage ------------------------------- */

function PercentageTools(): JSX.Element {
  const [mode, setMode] = useState<'of' | 'what' | 'change' | 'discount'>('of');
  const [a, setA] = useState('');
  const [b, setB] = useState('');

  const na = Number(a);
  const nb = Number(b);
  const validA = a.trim() !== '' && Number.isFinite(na);
  const validB = b.trim() !== '' && Number.isFinite(nb);

  let output: string | null = null;
  let detail = '';
  if (mode === 'of' && validA && validB) {
    output = formatNumber(percentOf(na, nb), 6);
    detail = `${na}% of ${nb} = ${output}`;
  } else if (mode === 'what' && validA && validB) {
    const percent = whatPercent(na, nb);
    output = percent === null ? null : `${formatNumber(percent, 4)}%`;
    detail = percent === null ? 'The whole cannot be zero.' : `${na} is ${formatNumber(percent, 4)}% of ${nb}`;
  } else if (mode === 'change' && validA && validB) {
    const change = percentChange(na, nb);
    output = change === null ? null : `${change > 0 ? '+' : ''}${formatNumber(change, 4)}%`;
    detail = change === null ? 'The starting value cannot be zero.' : `From ${na} to ${nb} is a change of ${formatNumber(change, 4)}%`;
  } else if (mode === 'discount' && validA && validB) {
    output = formatNumber(subtractPercent(na, nb), 6);
    detail = `${na} after ${nb}% off = ${output}`;
  }

  return (
    <Card title="Percentage calculator" subtitle="Four everyday percentage questions, answered with one method.">
      <Segmented
        label="What do you want to work out?"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'of', label: '% of a number' },
          { value: 'what', label: 'What percent' },
          { value: 'change', label: '% change' },
          { value: 'discount', label: 'Price after discount' },
        ]}
      />
      <div className="grid grid-2" style={{ marginTop: 'var(--space-3)' }}>
        <TextField
          label={mode === 'what' ? 'Part' : mode === 'change' ? 'Original value' : 'Amount'}
          inputMode="decimal"
          value={a}
          error={a.trim() !== '' && !validA ? 'Enter a number.' : null}
          onChange={(event) => setA(event.target.value)}
        />
        <TextField
          label={mode === 'change' ? 'New value' : mode === 'discount' ? 'Discount percent' : mode === 'of' ? 'Number' : 'Whole'}
          inputMode="decimal"
          value={b}
          error={b.trim() !== '' && !validB ? 'Enter a number.' : null}
          onChange={(event) => setB(event.target.value)}
        />
      </div>
      <div className="stat" role="status" aria-live="polite">
        <div className="stat-label">Answer</div>
        <div className="stat-value" data-testid="percentage-result">
          {output ?? '—'}
        </div>
        <div className="tiny muted">{detail || 'Fill both boxes to see the answer.'}</div>
      </div>
      <p className="tiny muted" style={{ marginTop: 12, marginBottom: 0 }}>
        Remember that successive discounts multiply: 20% off then another 20% off is 36% off overall, not 40%.
      </p>
    </Card>
  );
}

/* ------------------------------- date tools ------------------------------- */

function DateTools(): JSX.Element {
  const [mode, setMode] = useState<'between' | 'add' | 'age'>('between');
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [days, setDays] = useState('30');
  const [direction, setDirection] = useState<'add' | 'subtract'>('add');
  const [birthDate, setBirthDate] = useState('');

  const diff = daysBetween(from, to);
  const shift = Number(days);
  const shifted =
    Number.isFinite(shift) && parseISODate(from)
      ? toISODate(addDays(new Date(`${from}T00:00:00`), direction === 'add' ? shift : -shift))
      : null;

  const age = (() => {
    if (!parseISODate(birthDate)) return null;
    const birth = new Date(`${birthDate}T00:00:00`);
    const now = new Date();
    if (birth > now) return null;
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    let dayDiff = now.getDate() - birth.getDate();
    if (dayDiff < 0) {
      months--;
      dayDiff += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    }
    if (months < 0) {
      years--;
      months += 12;
    }
    return { years, months, days: dayDiff, totalDays: daysBetween(birthDate, todayISO()) };
  })();

  return (
    <Card title="Date and days calculator" subtitle="Whole days, date shifting and age — all in local calendar time.">
      <Segmented
        label="Date calculation"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'between', label: 'Days between' },
          { value: 'add', label: 'Add or subtract days' },
          { value: 'age', label: 'Age' },
        ]}
      />

      {mode === 'between' ? (
        <>
          <div className="grid grid-2" style={{ marginTop: 'var(--space-3)' }}>
            <TextField label="From" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            <TextField label="To" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          <div className="grid grid-2">
            <StatTile label="Calendar days between" value={`${diff} day${Math.abs(diff) === 1 ? '' : 's'}`} />
            <StatTile label="Weeks and days" value={`${Math.floor(Math.abs(diff) / 7)} weeks ${Math.abs(diff) % 7} days`} hint={diff < 0 ? 'The second date is earlier' : undefined} />
          </div>
        </>
      ) : null}

      {mode === 'add' ? (
        <>
          <div className="grid grid-2" style={{ marginTop: 'var(--space-3)' }}>
            <TextField label="Start date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            <TextField label="Number of days" inputMode="numeric" value={days} onChange={(event) => setDays(event.target.value)} />
          </div>
          <Segmented
            label="Direction"
            value={direction}
            onChange={setDirection}
            options={[
              { value: 'add', label: 'Add days' },
              { value: 'subtract', label: 'Subtract days' },
            ]}
          />
          <div className="stat" style={{ marginTop: 'var(--space-3)' }}>
            <div className="stat-label">Resulting date</div>
            <div className="stat-value" data-testid="date-result">
              {shifted ? formatDate(shifted, 'long') : '—'}
            </div>
            <div className="tiny muted">{shifted ? `${direction === 'add' ? '+' : '−'}${days} days from ${formatDate(from, 'medium')}` : 'Enter a valid date and number of days.'}</div>
          </div>
        </>
      ) : null}

      {mode === 'age' ? (
        <>
          <TextField
            label="Date of birth"
            type="date"
            value={birthDate}
            max={todayISO()}
            hint="Calculated on this device. LIFEKIT does not send this anywhere."
            onChange={(event) => setBirthDate(event.target.value)}
          />
          <div className="grid grid-2">
            <StatTile label="Age" value={age ? `${age.years} years ${age.months} months` : '—'} hint={age ? `${age.days} additional days` : 'Pick a date'} />
            <StatTile label="Total days lived" value={age ? formatNumber(age.totalDays) : '—'} />
          </div>
        </>
      ) : null}

      <p className="tiny muted" style={{ marginTop: 12, marginBottom: 0 }}>
        Counts use whole calendar days and ignore time zones and daylight-saving shifts, which is what matters for deadlines and
        leave planning.
      </p>
    </Card>
  );
}

/* ------------------------------- checklists ------------------------------- */

function ChecklistTools({ kind }: { kind: 'custom' | 'shopping' }): JSX.Element {
  const { data, saveChecklist, deleteChecklist } = useStore();
  const lists = data.checklists.filter((list) => list.kind === kind);
  const [title, setTitle] = useState('');
  const [activeId, setActiveId] = useState<string | null>(lists[0]?.id ?? null);
  const [newItem, setNewItem] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Checklist | null>(null);

  useEffect(() => {
    if (!activeId && lists.length > 0) setActiveId(lists[0].id);
  }, [lists, activeId]);

  const active = lists.find((list) => list.id === activeId) ?? null;

  const create = async () => {
    const clean = cleanText(title, 120);
    if (clean.length < 2) return;
    const now = new Date().toISOString();
    const list: Checklist = {
      id: createId('list'),
      title: clean,
      kind,
      items: [],
      createdAt: now,
      updatedAt: now,
    };
    await saveChecklist(list);
    setActiveId(list.id);
    setTitle('');
  };

  const addItem = async () => {
    if (!active) return;
    const text = cleanText(newItem, 200);
    if (text.length === 0) return;
    await saveChecklist({
      ...active,
      items: [...active.items, { id: createId('ci'), text, done: false }],
      updatedAt: new Date().toISOString(),
    });
    setNewItem('');
  };

  const toggleItem = async (itemId: string) => {
    if (!active) return;
    await saveChecklist({
      ...active,
      items: active.items.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <>
      <Card
        title={kind === 'shopping' ? 'Shopping lists' : 'Checklists'}
        subtitle={kind === 'shopping' ? 'Plan the shop, then tick items off in the aisle. Print or export when you leave the house.' : 'One-off checklists for anything you do repeatedly.'}
      >
        <div className="inline-form">
          <TextField
            label={kind === 'shopping' ? 'New shopping list' : 'New checklist'}
            placeholder={kind === 'shopping' ? 'e.g. weekly groceries' : 'e.g. before a trip'}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Button icon="plus" variant="accent" onClick={() => void create()}>
            Create
          </Button>
        </div>

        {lists.length === 0 ? (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <EmptyState icon={kind === 'shopping' ? 'list' : 'check-square'} title={kind === 'shopping' ? 'No shopping list yet' : 'No checklists yet'}>
              {kind === 'shopping'
                ? 'Create a list, add items as you notice them, and print it or export a CSV before you go shopping.'
                : 'Checklists are useful for packing, month-end tasks, exam preparation and safety steps.'}
            </EmptyState>
          </div>
        ) : (
          <div className="row wrap" style={{ gap: 8, marginTop: 'var(--space-3)' }}>
            {lists.map((list) => (
              <button
                key={list.id}
                type="button"
                className="chip"
                aria-pressed={list.id === activeId}
                onClick={() => setActiveId(list.id)}
              >
                {list.title} ({list.items.filter((item) => item.done).length}/{list.items.length})
              </button>
            ))}
          </div>
        )}
      </Card>

      {active ? (
        <Card
          title={active.title}
          subtitle={`${active.items.filter((item) => item.done).length} of ${active.items.length} done`}
          actions={
            <div className="btn-row">
              <Button
                size="sm"
                variant="secondary"
                icon="print"
                onClick={() => {
                  downloadBlob(
                    `${active.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${fileStamp()}.csv`,
                    new Blob([checklistToCsv(active.title, active.items)], { type: 'text/csv;charset=utf-8' })
                  );
                }}
              >
                Export CSV
              </Button>
              <Button size="sm" variant="secondary" icon="print" onClick={() => window.print()}>
                Print
              </Button>
              <IconButton icon="trash" label={`Delete list ${active.title}`} onClick={() => setPendingDelete(active)} />
            </div>
          }
        >
          <div className="inline-form">
            <TextField
              label="Add an item"
              value={newItem}
              placeholder={kind === 'shopping' ? 'e.g. 2 kg rice' : 'next step'}
              onChange={(event) => setNewItem(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void addItem();
                }
              }}
            />
            <Button icon="plus" variant="secondary" onClick={() => void addItem()}>
              Add
            </Button>
          </div>
          {active.items.length === 0 ? (
            <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
              Nothing on this list yet. Items are saved as soon as you add them.
            </p>
          ) : (
            <ul className="list" style={{ marginTop: 12 }}>
              {active.items.map((item) => (
                <li className="list-item" key={item.id}>
                  <input
                    type="checkbox"
                    checked={item.done}
                    aria-label={`Mark ${item.text} as ${item.done ? 'not done' : 'done'}`}
                    onChange={() => void toggleItem(item.id)}
                    style={{ width: 22, height: 22, marginTop: 2, accentColor: 'var(--accent)' }}
                  />
                  <span className="grow" style={{ textDecoration: item.done ? 'line-through' : 'none' }}>
                    {item.text}
                  </span>
                  <IconButton
                    icon="trash"
                    label={`Remove ${item.text}`}
                    onClick={() =>
                      void saveChecklist({
                        ...active,
                        items: active.items.filter((row) => row.id !== item.id),
                        updatedAt: new Date().toISOString(),
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          )}
          {kind === 'shopping' && active.items.length > 0 ? (
            <div className="btn-row" style={{ marginTop: 12 }}>
              <Button
                size="sm"
                variant="ghost"
                icon="check"
                onClick={() =>
                  void saveChecklist({
                    ...active,
                    items: active.items.map((item) => ({ ...item, done: false })),
                    updatedAt: new Date().toISOString(),
                  })
                }
              >
                Un-tick everything for the next trip
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this list?"
        message={pendingDelete ? <><strong>{pendingDelete.title}</strong> and its {pendingDelete.items.length} item(s) will be removed from this device.</> : null}
        confirmLabel="Delete list"
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) {
            await deleteChecklist(pendingDelete.id);
            setActiveId(null);
          }
          setPendingDelete(null);
        }}
      />
    </>
  );
}

/* ------------------------------- notes ------------------------------- */

function NotesTool(): JSX.Element {
  const { data, saveNote, deleteNote } = useStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.notes
      .filter((note) => (q === '' ? true : `${note.title} ${note.body}`.toLowerCase().includes(q)))
      .sort((a, b) => (a.pinned === b.pinned ? b.updatedAt.localeCompare(a.updatedAt) : a.pinned ? -1 : 1));
  }, [data.notes, search]);

  const active = data.notes.find((note) => note.id === activeId) ?? null;

  return (
    <>
      <Card
        title="Notes"
        subtitle="Plain text, stored locally. Suitable for addresses, reference numbers and drafts."
        actions={
          <Button
            size="sm"
            variant="accent"
            icon="plus"
            onClick={async () => {
              const now = new Date().toISOString();
              const note = { id: createId('note'), title: 'New note', body: '', pinned: false, createdAt: now, updatedAt: now };
              await saveNote(note);
              setActiveId(note.id);
            }}
          >
            New note
          </Button>
        }
      >
        <TextField label="Search notes" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        {data.notes.length === 0 ? (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <EmptyState icon="note" title="No notes yet">
              Notes are for text you want to find again quickly: account reference numbers, addresses, a shopping idea, a letter
              draft. Do not store passwords here — use a dedicated password manager.
            </EmptyState>
          </div>
        ) : (
          <ul className="row wrap" style={{ gap: 8, listStyle: 'none', padding: 0, marginTop: 'var(--space-3)' }}>
            {visible.map((note) => (
              <li key={note.id}>
                <button type="button" className="chip" aria-pressed={note.id === activeId} onClick={() => setActiveId(note.id)}>
                  {note.pinned ? '★ ' : ''}
                  {note.title.slice(0, 32) || 'Untitled'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {active ? (
        <Card
          title="Editing note"
          actions={
            <div className="btn-row">
              <Button
                size="sm"
                variant="ghost"
                icon="bookmark"
                onClick={() => void saveNote({ ...active, pinned: !active.pinned, updatedAt: new Date().toISOString() })}
              >
                {active.pinned ? 'Unpin' : 'Pin'}
              </Button>
              <IconButton icon="trash" label="Delete note" onClick={() => setPendingDelete(active.id)} />
            </div>
          }
        >
          <TextField
            label="Title"
            value={active.title}
            maxLength={120}
            onChange={(event) => void saveNote({ ...active, title: cleanText(event.target.value, 120), updatedAt: new Date().toISOString() })}
          />
          <TextAreaField
            label="Note"
            value={active.body}
            rows={10}
            hint="Saved automatically as you type."
            onChange={(event) => void saveNote({ ...active, body: cleanMultiline(event.target.value, 20_000), updatedAt: new Date().toISOString() })}
          />
          <p className="tiny muted" style={{ margin: 0 }}>
            Last updated {new Date(active.updatedAt).toLocaleString()}. Notes are not encrypted at rest on this device beyond
            whatever protection your browser and operating system provide — see Settings → Privacy for the shared-device warning.
          </p>
        </Card>
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this note?"
        message="The note will be removed from this device. This cannot be undone."
        confirmLabel="Delete note"
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await deleteNote(pendingDelete);
          setActiveId(null);
          setPendingDelete(null);
        }}
      />
    </>
  );
}

/* ------------------------------- study timer ------------------------------- */

function StudyTimer(): JSX.Element {
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [phase, setPhase] = useState<'focus' | 'break'>('focus');
  const [remaining, setRemaining] = useState(focusMinutes * 60);
  const [running, setRunning] = useState(false);
  const [rounds, setRounds] = useState(0);
  const [logged, setLogged] = useState(0);

  useEffect(() => {
    setRemaining((phase === 'focus' ? focusMinutes : breakMinutes) * 60);
  }, [focusMinutes, breakMinutes, phase]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(id);
          setRunning(false);
          if (phase === 'focus') {
            setRounds((r) => r + 1);
            setLogged((minutes) => minutes + focusMinutes);
            setPhase('break');
          } else {
            setPhase('focus');
          }
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, phase, focusMinutes]);

  const total = (phase === 'focus' ? focusMinutes : breakMinutes) * 60;
  const progress = total > 0 ? ((total - remaining) / total) * 100 : 0;
  const circumference = 2 * Math.PI * 70;

  return (
    <Card title="Study timer" subtitle="A simple focus-and-break cycle. Nothing is scheduled in the background.">
      <div style={{ textAlign: 'center' }}>
        <svg className="timer-ring" viewBox="0 0 160 160" role="img" aria-label={`${phase === 'focus' ? 'Focus' : 'Break'} time remaining`}>
          <circle cx="80" cy="80" r="70" fill="none" stroke="var(--surface-strong)" strokeWidth="12" />
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke={phase === 'focus' ? 'var(--accent)' : 'var(--info)'}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress / 100)}
            transform="rotate(-90 80 80)"
          />
        </svg>
        <div className="timer-time" aria-live="polite" data-testid="timer-value">
          {String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          {phase === 'focus' ? 'Focus block' : 'Break'} · {rounds} completed round{rounds === 1 ? '' : 's'} ·{' '}
          {formatClock(logged)} of focus logged
        </p>
      </div>

      <div className="btn-row" style={{ justifyContent: 'center', marginTop: 'var(--space-4)' }}>
        <Button variant={running ? 'secondary' : 'accent'} icon={running ? 'close' : 'timer'} onClick={() => setRunning(!running)}>
          {running ? 'Pause' : remaining === total ? 'Start' : 'Resume'}
        </Button>
        <Button
          variant="ghost"
          icon="repeat"
          onClick={() => {
            setRunning(false);
            setRemaining(total);
          }}
        >
          Reset
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setRunning(false);
            setPhase(phase === 'focus' ? 'break' : 'focus');
            setRemaining(0);
          }}
        >
          Skip phase
        </Button>
      </div>

      <div className="grid grid-2" style={{ marginTop: 'var(--space-4)' }}>
        <TextField
          label="Focus length (minutes)"
          type="number"
          min={5}
          max={120}
          value={String(focusMinutes)}
          onChange={(event) => setFocusMinutes(Math.min(120, Math.max(5, Number(event.target.value) || 25)))}
        />
        <TextField
          label="Break length (minutes)"
          type="number"
          min={1}
          max={60}
          value={String(breakMinutes)}
          onChange={(event) => setBreakMinutes(Math.min(60, Math.max(1, Number(event.target.value) || 5)))}
        />
      </div>

      <Notice tone="info" title="How to use it honestly.">
        The timer only runs while this screen is open — browsers cannot reliably count time in a background tab. Short blocks
        with real breaks work better than long sessions; log the completed rounds in the planner if you want a record.
      </Notice>
    </Card>
  );
}

/* ------------------------------- savings calculator ------------------------------- */

function SavingsCalculator(): JSX.Element {
  const { settings } = useStore();
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');
  const [months, setMonths] = useState('12');
  const [monthly, setMonthly] = useState('');

  const parsedTarget = parseAmount(target) ?? 0;
  const parsedCurrent = parseAmount(current) ?? 0;
  const parsedMonths = Number(months);
  const parsedMonthly = parseAmount(monthly) ?? 0;

  const plan = useMemo(
    () =>
      savingsPlan({
        target: parsedTarget,
        current: parsedCurrent,
        months: Number.isFinite(parsedMonths) ? parsedMonths : null,
        monthlyAmount: parsedMonthly,
      }),
    [parsedTarget, parsedCurrent, parsedMonths, parsedMonthly]
  );

  const money = (value: number) => formatMoney(value, { currency: settings.currency, locale: settings.locale });

  return (
    <Card title="Savings goal calculator" subtitle="Arithmetic only — no interest assumptions and no promises.">
      <div className="grid grid-2">
        <TextField label="Target amount" inputMode="decimal" placeholder="0.00" value={target} onChange={(event) => setTarget(event.target.value)} />
        <TextField label="Already saved" inputMode="decimal" placeholder="0.00" value={current} onChange={(event) => setCurrent(event.target.value)} />
        <TextField label="Months available" inputMode="numeric" value={months} onChange={(event) => setMonths(event.target.value)} />
        <TextField label="Or: amount per month" inputMode="decimal" placeholder="0.00" value={monthly} onChange={(event) => setMonthly(event.target.value)} />
      </div>

      <div className="grid grid-2">
        <StatTile label="Still needed" value={money(plan.gap)} />
        <StatTile
          label={`Monthly amount for ${Number.isFinite(parsedMonths) && parsedMonths > 0 ? Math.floor(parsedMonths) : '—'} months`}
          value={plan.monthlyRequired === null ? '—' : money(plan.monthlyRequired)}
          hint="Simple division of the gap"
        />
        <StatTile
          label="Months at the given monthly amount"
          value={plan.monthsToTarget === null ? '—' : `${plan.monthsToTarget}`}
          hint={plan.monthsToTarget !== null && plan.monthsToTarget > 120 ? 'That is over ten years — check the numbers' : undefined}
        />
      </div>

      <Notice tone="warning" title="This is arithmetic, not advice.">
        The calculation ignores inflation, interest, fees and any change in income. LIFEKIT cannot tell you what you can afford
        and does not provide financial advice. Treat the numbers as a starting point for your own planning.
      </Notice>
    </Card>
  );
}

/* ------------------------------- recurring expenses ------------------------------- */

function RecurringPlanner(): JSX.Element {
  const { data, settings, notify, saveEntry } = useStore();
  const projection = projectRecurring(data.entries, new Date());
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');

  const money = (value: number) => formatMoney(value, { currency: settings.currency, locale: settings.locale });
  const recurring = data.entries.filter((entry) => entry.type === 'expense' && entry.recurrence && entry.recurrence.frequency !== 'none');

  const add = async () => {
    const parsed = parseAmount(amount);
    if (!label.trim() || parsed === null || parsed <= 0) {
      notify('Add a description and an amount greater than zero.', 'error');
      return;
    }
    const now = new Date().toISOString();
    await saveEntry({
      id: createId('mny'),
      type: 'expense',
      amount: parsed,
      date: todayISO(),
      categoryId: data.categories.find((c) => c.id === 'expense_utilities')?.id ?? 'expense_other',
      note: cleanText(label, 300),
      recurrence: { frequency },
      createdAt: now,
      updatedAt: now,
    });
    setLabel('');
    setAmount('');
    notify('Recurring entry added to the Money tracker.', 'success');
  };

  return (
    <>
      <Card title="Recurring cost estimate" subtitle="Built from the entries you marked as repeating">
        <div className="grid grid-3">
          <StatTile label="Estimated per month" value={money(projection.monthlyTotal)} hint="Estimate, not a bill" />
          <StatTile label="Estimated per year" value={money(projection.yearlyTotal)} hint="Estimate, not a bill" />
          <StatTile label="Repeating entries" value={String(projection.count)} />
        </div>
        <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
          {projection.nextDue
            ? `The next occurrence on or after today is ${formatDate(projection.nextDue, 'medium', settings.locale)}.`
            : 'Add a repeating cost below to see when the next one falls due.'}{' '}
          These figures assume every pattern continues unchanged. LIFEKIT does not create transactions automatically and does not
          know your actual bills.
        </p>
      </Card>

      <Card title="Add a recurring cost" subtitle="Creates one entry in the Money tracker and marks it as repeating">
        <div className="inline-form">
          <TextField label="What is it?" placeholder="e.g. electricity bill" value={label} onChange={(event) => setLabel(event.target.value)} />
          <TextField label="Amount" inputMode="decimal" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} />
          <SelectField
            label="Repeats"
            value={frequency}
            onChange={(event) => setFrequency(event.target.value as typeof frequency)}
            options={[
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'yearly', label: 'Yearly' },
            ]}
          />
          <Button icon="plus" variant="accent" onClick={() => void add()}>
            Add
          </Button>
        </div>
        <p className="tiny muted" style={{ marginTop: 8, marginBottom: 0 }}>
          Adding a repeating cost does not raise a reminder by itself — set one in the planner if you want to be nudged before
          the bill arrives.
        </p>
      </Card>

      <Card title="Your repeating entries">
        {recurring.length === 0 ? (
          <EmptyState icon="repeat" title="Nothing marked as repeating yet">
            Mark a subscription, rent, EMI or insurance premium as repeating and LIFEKIT will total up the committed monthly
            cost. This is useful before taking on a new instalment.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <caption className="visually-hidden">Entries marked as repeating</caption>
              <thead>
                <tr>
                  <th scope="col">Description</th>
                  <th scope="col">Pattern</th>
                  <th scope="col" className="numeric">
                    Amount
                  </th>
                  <th scope="col" className="numeric">
                    Per month
                  </th>
                </tr>
              </thead>
              <tbody>
                {recurring.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.note || data.categories.find((c) => c.id === entry.categoryId)?.name}</td>
                    <td>{entry.recurrence?.frequency}</td>
                    <td className="numeric amount">{money(entry.amount)}</td>
                    <td className="numeric">{money(monthlyEquivalent(entry.amount, entry.recurrence?.frequency ?? 'none'))}</td>
                  </tr>
                ))}
                <tr>
                  <th scope="row" colSpan={3}>
                    Total recorded expenses to date
                  </th>
                  <td className="numeric">{money(summarize(data.entries).expense)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

/* ------------------------------- main ------------------------------- */

export function Tools(): JSX.Element {
  const [tab, setTab] = useState<Tab>('calculator');

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
    const requested = params.get('tab');
    if (requested && TABS.some((item) => item.value === requested)) setTab(requested as Tab);
  }, []);

  return (
    <div className="stack">
      <PageHeader
        title="Offline tools"
        description="Ten small utilities that need no internet, no account and no permission."
      />

      <div className="chip-row no-print" role="tablist" aria-label="Offline tools">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            aria-pressed={tab === item.value}
            className="chip"
            onClick={() => setTab(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'calculator' ? <Calculator /> : null}
      {tab === 'converter' ? <Converter /> : null}
      {tab === 'percentage' ? <PercentageTools /> : null}
      {tab === 'dates' ? <DateTools /> : null}
      {tab === 'checklists' ? <ChecklistTools kind="custom" /> : null}
      {tab === 'shopping' ? <ChecklistTools kind="shopping" /> : null}
      {tab === 'notes' ? <NotesTool /> : null}
      {tab === 'timer' ? <StudyTimer /> : null}
      {tab === 'savings' ? <SavingsCalculator /> : null}
      {tab === 'recurring' ? <RecurringPlanner /> : null}

      <Card title="About these tools">
        <ul className="small">
          <li>Every calculation runs on this device. There is no server, no API key and no paid service involved.</li>
          <li>Nothing here is AI-generated at runtime. Formulas are fixed, written in advance and covered by automated tests.</li>
          <li>The calculator, converter and percentage tools keep no data. Checklists, notes and shopping lists are saved locally.</li>
          <li>Estimates are labelled as estimates. LIFEKIT never presents a projection as a guaranteed outcome.</li>
        </ul>
        <p className="tiny muted" style={{ marginBottom: 0 }}>
          <Icon name="lock" size={14} style={{ verticalAlign: '-2px' }} /> Tools that store data write to this browser’s local
          storage only. Export a backup from Settings to keep your own copy.
        </p>
      </Card>
    </div>
  );
}

export default Tools;
