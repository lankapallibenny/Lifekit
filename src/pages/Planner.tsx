/**
 * LIFEKIT Daily Life Planner.
 *
 * Tasks, study planning, personal goals and habits in one screen, all stored locally.
 * Notifications are optional here: the planner is fully usable with notification
 * permission denied or never requested. Reminder times are stored on the task itself and
 * only matter if the user has switched reminders on in Notification settings.
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
  TextAreaField,
  TextField,
  ToggleRow,
} from '../components/ui';
import { Icon } from '../components/Icons';
import { useStore } from '../state/store';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  formatClock,
  formatDate,
  formatMonth,
  monthMatrix,
  parseClock,
  relativeDayLabel,
  startOfMonth,
  startOfWeek,
  todayISO,
  weekdayLabel,
} from '../lib/dates';
import { cleanMultiline, cleanText, createId } from '../lib/shared';
import type { Habit, Priority, Task, TaskKind } from '../lib/models';
import { navigate, ROUTES } from '../router';

type Tab = 'tasks' | 'study' | 'goals' | 'habits';
type View = 'day' | 'week' | 'month';

const PRIORITY_TONE: Record<Priority, 'danger' | 'warning' | 'neutral'> = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
};

interface TaskDraft {
  id: string | null;
  title: string;
  notes: string;
  kind: TaskKind;
  priority: Priority;
  dueDate: string;
  reminder: string;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  tag: string;
  targetValue: string;
  currentValue: string;
}

function blankDraft(overrides: Partial<TaskDraft> = {}): TaskDraft {
  return {
    id: null,
    title: '',
    notes: '',
    kind: 'task',
    priority: 'medium',
    dueDate: todayISO(),
    reminder: '',
    recurrence: 'none',
    tag: '',
    targetValue: '',
    currentValue: '',
    ...overrides,
  };
}

function draftFromTask(task: Task): TaskDraft {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes ?? '',
    kind: task.kind,
    priority: task.priority,
    dueDate: task.dueDate ?? '',
    reminder: task.reminderAt != null ? `${String(Math.floor(task.reminderAt / 60)).padStart(2, '0')}:${String(task.reminderAt % 60).padStart(2, '0')}` : '',
    recurrence:
      task.recurrence?.frequency === 'weekly'
        ? 'weekly'
        : task.recurrence?.frequency === 'monthly'
          ? 'monthly'
          : task.recurrence?.frequency === 'yearly'
            ? 'monthly'
            : 'none',
    tag: task.tag ?? '',
    targetValue: task.targetValue != null ? String(task.targetValue) : '',
    currentValue: task.currentValue != null ? String(task.currentValue) : '',
  };
}

function TaskDialog({
  draft,
  onClose,
  existingTags,
}: {
  draft: TaskDraft;
  onClose: () => void;
  existingTags: string[];
}) {
  const { saveTask, notify } = useStore();
  const [state, setState] = useState<TaskDraft>(draft);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [repeatForever, setRepeatForever] = useState(draft.recurrence !== 'none');

  const submit = async () => {
    const next: Record<string, string | null> = {};
    if (state.title.trim().length === 0) next.title = 'Give the task a title.';
    if (state.title.length > 200) next.title = 'Keep the title under 200 characters.';
    const reminder = state.reminder.trim() === '' ? null : parseClock(state.reminder);
    if (state.reminder.trim() !== '' && reminder === null) next.reminder = 'Use a 24-hour time such as 08:30.';
    const target = state.targetValue.trim() === '' ? null : Number(state.targetValue);
    if (state.kind === 'goal' && (target === null || !Number.isFinite(target) || target <= 0)) {
      next.targetValue = 'A goal needs a target value greater than zero.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const now = new Date().toISOString();
    const task: Task = {
      id: state.id ?? createId('task'),
      title: cleanText(state.title, 200),
      notes: cleanMultiline(state.notes, 2000),
      kind: state.kind,
      status: 'open',
      priority: state.priority,
      dueDate: state.dueDate || null,
      reminderAt: reminder,
      reminderFired: false,
      tag: cleanText(state.tag, 40),
      targetValue: target,
      currentValue: state.currentValue.trim() === '' ? (target !== null ? 0 : null) : Number(state.currentValue),
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      ...(repeatForever && state.recurrence !== 'none'
        ? { recurrence: { frequency: state.recurrence === 'daily' ? 'weekly' : state.recurrence } }
        : {}),
    };
    await saveTask(task);
    notify(state.id ? 'Task updated.' : 'Task added.', 'success');
    onClose();
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <TextField
        label="Title"
        value={state.title}
        error={errors.title ?? null}
        maxLength={200}
        autoFocus
        onChange={(event) => setState({ ...state, title: event.target.value })}
      />
      <div className="grid grid-2">
        <SelectField
          label="Type"
          value={state.kind}
          onChange={(event) => setState({ ...state, kind: event.target.value as TaskKind })}
          options={[
            { value: 'task', label: 'Task' },
            { value: 'study', label: 'Study session' },
            { value: 'goal', label: 'Personal goal' },
          ]}
        />
        <SelectField
          label="Priority"
          value={state.priority}
          onChange={(event) => setState({ ...state, priority: event.target.value as Priority })}
          options={[
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' },
          ]}
        />
      </div>
      <div className="grid grid-2">
        <TextField
          label="Due date"
          type="date"
          value={state.dueDate}
          onChange={(event) => setState({ ...state, dueDate: event.target.value })}
        />
        <TextField
          label="Reminder time (optional)"
          type="time"
          hint="Only delivered if you enable reminders in Notification settings."
          value={state.reminder}
          error={errors.reminder ?? null}
          onChange={(event) => setState({ ...state, reminder: event.target.value })}
        />
      </div>
      {state.kind === 'study' ? (
        <TextField
          label="Subject or course tag"
          value={state.tag}
          maxLength={40}
          placeholder="e.g. Mathematics"
          list="lifekit-tags"
          onChange={(event) => setState({ ...state, tag: event.target.value })}
        />
      ) : null}
      <datalist id="lifekit-tags">
        {existingTags.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
      {state.kind === 'goal' ? (
        <div className="grid grid-2">
          <TextField
            label="Target value"
            inputMode="numeric"
            placeholder="e.g. 20"
            value={state.targetValue}
            error={errors.targetValue ?? null}
            onChange={(event) => setState({ ...state, targetValue: event.target.value })}
          />
          <TextField
            label="Current value"
            inputMode="numeric"
            placeholder="0"
            value={state.currentValue}
            onChange={(event) => setState({ ...state, currentValue: event.target.value })}
          />
        </div>
      ) : null}
      <TextAreaField
        label="Notes (optional)"
        value={state.notes}
        maxLength={2000}
        onChange={(event) => setState({ ...state, notes: event.target.value })}
      />
      <ToggleRow
        label="Repeating task"
        description="Records the pattern so you can recreate it. LIFEKIT does not duplicate tasks automatically."
        checked={repeatForever}
        onChange={(checked) => {
          setRepeatForever(checked);
          if (checked && state.recurrence === 'none') setState({ ...state, recurrence: 'weekly' });
        }}
      />
      {repeatForever ? (
        <SelectField
          label="Repeats"
          value={state.recurrence}
          onChange={(event) => setState({ ...state, recurrence: event.target.value as TaskDraft['recurrence'] })}
          options={[
            { value: 'weekly', label: 'Every week' },
            { value: 'monthly', label: 'Every month' },
          ]}
        />
      ) : null}
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="accent" data-testid="save-task">
          {state.id ? 'Save changes' : 'Add task'}
        </Button>
      </div>
    </form>
  );
}

function TaskRow({
  task,
  onEdit,
  onDelete,
}: {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { saveTask } = useStore();
  const today = todayISO();
  const overdue = task.status === 'open' && task.dueDate !== null && task.dueDate < today;
  const complete = task.status === 'done';

  return (
    <li className="list-item">
      <input
        type="checkbox"
        checked={complete}
        aria-label={complete ? `Mark “${task.title}” as not done` : `Mark “${task.title}” as done`}
        onChange={async () => {
          await saveTask({
            ...task,
            status: complete ? 'open' : 'done',
            completedAt: complete ? null : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }}
        style={{ width: 24, height: 24, marginTop: 2, accentColor: 'var(--accent)', flexShrink: 0 }}
      />
      <div className="list-item-main">
        <div style={{ fontWeight: 550, textDecoration: complete ? 'line-through' : 'none' }}>
          {task.title}
          {task.kind === 'study' ? (
            <>
              {' '}
              <Badge tone="info">Study</Badge>
            </>
          ) : null}
          {task.kind === 'goal' ? (
            <>
              {' '}
              <Badge tone="accent">Goal</Badge>
            </>
          ) : null}
        </div>
        <div className="tiny muted row wrap" style={{ gap: 8 }}>
          {task.dueDate ? <span>{relativeDayLabel(task.dueDate, today)}</span> : <span>No date</span>}
          <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
          {task.reminderAt != null ? <span>Reminder {formatClock(task.reminderAt)}</span> : null}
          {task.tag ? <span>#{task.tag}</span> : null}
          {overdue ? <Badge tone="danger">Overdue</Badge> : null}
          {task.recurrence ? (
            <span>
              <Icon name="repeat" size={12} style={{ verticalAlign: '-2px' }} /> {task.recurrence.frequency}
            </span>
          ) : null}
        </div>
        {task.kind === 'goal' && task.targetValue ? (
          <div style={{ marginTop: 6 }}>
            <ProgressBar
              percent={task.targetValue > 0 ? ((task.currentValue ?? 0) / task.targetValue) * 100 : 0}
              label={`${task.title} progress`}
              tone="never-over"
            />
            <span className="tiny muted">
              {task.currentValue ?? 0} of {task.targetValue}
            </span>
          </div>
        ) : null}
        {task.notes ? (
          <p className="small muted" style={{ margin: '6px 0 0' }}>
            {task.notes}
          </p>
        ) : null}
      </div>
      <div className="row" style={{ gap: 4 }}>
        <IconButton icon="edit" label={`Edit ${task.title}`} onClick={onEdit} />
        <IconButton icon="trash" label={`Delete ${task.title}`} onClick={onDelete} />
      </div>
    </li>
  );
}

function HabitsTab(): JSX.Element {
  const { data, saveHabit, deleteHabit, toggleHabit } = useStore();
  const [name, setName] = useState('');
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [reminder, setReminder] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Habit | null>(null);
  const today = todayISO();
  const weekStart = startOfWeek(new Date(), 1);
  const weekDates = Array.from({ length: 7 }, (_, index) => todayISO(addDays(weekStart, index)));

  const streak = (habitId: string): number => {
    const done = new Set(data.habitLogs.filter((log) => log.habitId === habitId && log.done).map((log) => log.date));
    let count = 0;
    let cursor = new Date();
    for (let i = 0; i < 365; i++) {
      const iso = todayISO(cursor);
      if (done.has(iso)) count++;
      else if (i > 0) break;
      cursor = addDays(cursor, -1);
    }
    return count;
  };

  const add = async () => {
    const clean = cleanText(name, 80);
    if (clean.length < 2) {
      setError('Give the habit a short name.');
      return;
    }
    if (days.length === 0) {
      setError('Choose at least one day of the week.');
      return;
    }
    setError(null);
    await saveHabit({
      id: createId('habit'),
      name: clean,
      days: [...days].sort(),
      reminderAt: reminder.trim() === '' ? null : parseClock(reminder),
      createdAt: new Date().toISOString(),
    });
    setName('');
    setReminder('');
  };

  return (
    <>
      <Card title="New habit" subtitle="Small, repeatable actions. Tracking is optional and never nagging.">
        <div className="inline-form">
          <TextField label="Habit" placeholder="e.g. record today’s spending" value={name} error={error} onChange={(event) => setName(event.target.value)} />
          <TextField label="Reminder time (optional)" type="time" value={reminder} onChange={(event) => setReminder(event.target.value)} />
          <Button icon="plus" variant="accent" onClick={() => void add()}>
            Add habit
          </Button>
        </div>
        <fieldset style={{ border: 0, padding: 0, margin: 'var(--space-3) 0 0' }}>
          <legend className="field-label">Repeat on</legend>
          <div className="row wrap">
            {[0, 1, 2, 3, 4, 5, 6].map((day) => (
              <label key={day} className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={days.includes(day)}
                  onChange={(event) =>
                    setDays((current) => (event.target.checked ? [...current, day] : current.filter((d) => d !== day)))
                  }
                  style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
                />
                {weekdayLabel(day).slice(0, 3)}
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      <Card title="This week" subtitle={`${formatDate(weekDates[0], 'short')} – ${formatDate(weekDates[6], 'short')}`}>
        {data.habits.filter((habit) => !habit.archived).length === 0 ? (
          <EmptyState icon="target" title="No habits yet">
            Add one habit above. A single habit is easier to keep than five, and missing a day is information rather than
            failure.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <caption className="visually-hidden">Habit tracker for the current week</caption>
              <thead>
                <tr>
                  <th scope="col">Habit</th>
                  {weekDates.map((date) => (
                    <th key={date} scope="col" className="center">
                      {formatDate(date, 'weekday').slice(0, 2)}
                      <span className="visually-hidden"> {formatDate(date, 'medium')}</span>
                    </th>
                  ))}
                  <th scope="col" className="numeric">
                    Streak
                  </th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.habits
                  .filter((habit) => !habit.archived)
                  .map((habit) => (
                    <tr key={habit.id}>
                      <th scope="row" style={{ fontWeight: 550 }}>
                        {habit.name}
                        {habit.reminderAt != null ? <div className="tiny muted">Reminder {formatClock(habit.reminderAt)}</div> : null}
                      </th>
                      {weekDates.map((date) => {
                        const scheduled = habit.days.includes(new Date(date + 'T00:00:00').getDay());
                        const log = data.habitLogs.find((l) => l.habitId === habit.id && l.date === date);
                        const done = Boolean(log?.done);
                        return (
                          <td key={date} className="center">
                            <input
                              type="checkbox"
                              checked={done}
                              disabled={!scheduled}
                              aria-label={`${habit.name} on ${formatDate(date, 'medium')}${scheduled ? '' : ' (not scheduled)'}`}
                              onChange={() => void toggleHabit(habit.id, date)}
                              style={{ width: 22, height: 22, accentColor: 'var(--accent)' }}
                            />
                          </td>
                        );
                      })}
                      <td className="numeric">
                        {streak(habit.id)} day{streak(habit.id) === 1 ? '' : 's'}
                      </td>
                      <td>
                        <IconButton icon="trash" label={`Delete habit ${habit.name}`} onClick={() => setPendingDelete(habit)} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="tiny muted" style={{ marginTop: 8, marginBottom: 0 }}>
          Today is {formatDate(today, 'medium')}. Days not scheduled for a habit are disabled. Streaks count consecutive days
          ending today.
        </p>
      </Card>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this habit?"
        message={
          pendingDelete ? (
            <>
              <strong>{pendingDelete.name}</strong> and its recorded ticks will be removed from this device. Other habits are
              not affected.
            </>
          ) : null
        }
        confirmLabel="Delete habit"
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await deleteHabit(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </>
  );
}

export function Planner(): JSX.Element {
  const { data, deleteTask, saveTask, notify } = useStore();
  const [tab, setTab] = useState<Tab>('tasks');
  const [view, setView] = useState<View>('day');
  const [cursor, setCursor] = useState(() => new Date());
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'open' | 'done' | 'all'>('open');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);

  // Honour ?tab=habits style deep links from the Home dashboard.
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
    const requested = params.get('tab');
    if (requested === 'habits' || requested === 'goals' || requested === 'study' || requested === 'tasks') setTab(requested);
  }, []);

  const tags = useMemo(
    () => [...new Set(data.tasks.map((task) => task.tag).filter((tag): tag is string => Boolean(tag)))],
    [data.tasks]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.tasks
      .filter((task) => (statusFilter === 'all' ? true : task.status === statusFilter))
      .filter((task) => (priorityFilter === 'all' ? true : task.priority === priorityFilter))
      .filter((task) => (tab === 'study' ? task.kind === 'study' : tab === 'goals' ? task.kind === 'goal' : true))
      .filter((task) =>
        q === ''
          ? true
          : `${task.title} ${task.notes ?? ''} ${task.tag ?? ''}`.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        if (a.dueDate === b.dueDate) return (a.reminderAt ?? 0) - (b.reminderAt ?? 0);
        if (a.dueDate === null) return 1;
        if (b.dueDate === null) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [data.tasks, query, statusFilter, priorityFilter, tab]);

  const range = useMemo(() => {
    if (view === 'day') {
      const iso = todayISO(cursor);
      return { from: iso, to: iso, label: formatDate(iso, 'long') };
    }
    if (view === 'week') {
      const from = startOfWeek(cursor, 1);
      const to = endOfWeek(cursor, 1);
      return {
        from: todayISO(from),
        to: todayISO(to),
        label: `${formatDate(todayISO(from), 'short')} – ${formatDate(todayISO(to), 'medium')}`,
      };
    }
    const from = startOfMonth(cursor);
    const to = endOfMonth(cursor);
    return { from: todayISO(from), to: todayISO(to), label: formatMonth(cursor) };
  }, [cursor, view]);

  const viewTasks = visible.filter((task) => {
    if (view === 'day') return task.dueDate === range.from || task.dueDate === null;
    if (!task.dueDate) return false;
    return task.dueDate >= range.from && task.dueDate <= range.to;
  });

  const overdue = data.tasks.filter((task) => task.status === 'open' && task.dueDate && task.dueDate < todayISO());
  const openCount = data.tasks.filter((task) => task.status === 'open').length;
  const doneThisWeek = data.tasks.filter(
    (task) => task.status === 'done' && task.completedAt && task.completedAt.slice(0, 10) >= todayISO(startOfWeek(new Date(), 1))
  ).length;

  const monthCells = view === 'month' ? monthMatrix(cursor.getFullYear(), cursor.getMonth(), 1) : [];

  return (
    <div className="stack">
      <PageHeader
        title="Planner"
        description="Tasks, study sessions, personal goals and habits — all stored on this device."
        actions={
          <>
            <Button variant="accent" icon="plus" onClick={() => setDraft(blankDraft({ kind: tab === 'study' ? 'study' : tab === 'goals' ? 'goal' : 'task' }))}>
              Add task
            </Button>
            <Button variant="secondary" icon="bell" onClick={() => navigate(ROUTES.notificationSettings)}>
              Reminder settings
            </Button>
          </>
        }
      />

      {overdue.length > 0 ? (
        <Notice tone="warning" title={`${overdue.length} task${overdue.length === 1 ? '' : 's'} overdue.`}>
          Overdue tasks stay in the list until you complete or reschedule them.
        </Notice>
      ) : null}

      <div className="grid grid-3">
        <div className="stat">
          <div className="stat-label">Open</div>
          <div className="stat-value">{openCount}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Overdue</div>
          <div className="stat-value">{overdue.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Completed this week</div>
          <div className="stat-value">{doneThisWeek}</div>
        </div>
      </div>

      <div className="segmented" role="tablist" aria-label="Planner sections" style={{ alignSelf: 'flex-start' }}>
        {(
          [
            { value: 'tasks', label: 'Tasks' },
            { value: 'study', label: 'Study planner' },
            { value: 'goals', label: 'Goals' },
            { value: 'habits', label: 'Habits' },
          ] as { value: Tab; label: string }[]
        ).map((item) => (
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

      {tab === 'habits' ? <HabitsTab /> : null}

      {tab !== 'habits' ? (
        <>
          <Card
            title={tab === 'study' ? 'Study sessions' : tab === 'goals' ? 'Personal goals' : 'All tasks'}
            subtitle={`${viewTasks.length} shown · ${range.label}`}
            actions={
              <div className="row wrap">
                <Segmented
                  label="Planner view"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: 'day', label: 'Day' },
                    { value: 'week', label: 'Week' },
                    { value: 'month', label: 'Month' },
                  ]}
                />
              </div>
            }
          >
            <div className="row wrap" style={{ marginBottom: 'var(--space-3)' }}>
              <IconButton
                icon="chevron-left"
                label={view === 'day' ? 'Previous day' : view === 'week' ? 'Previous week' : 'Previous month'}
                onClick={() =>
                  setCursor((current) =>
                    view === 'month' ? addMonths(current, -1) : addDays(current, view === 'week' ? -7 : -1)
                  )
                }
              />
              <span className="small grow" style={{ fontWeight: 600, textAlign: 'center' }}>
                {range.label}
              </span>
              <IconButton
                icon="chevron-right"
                label={view === 'day' ? 'Next day' : view === 'week' ? 'Next week' : 'Next month'}
                onClick={() =>
                  setCursor((current) =>
                    view === 'month' ? addMonths(current, 1) : addDays(current, view === 'week' ? 7 : 1)
                  )
                }
              />
              <Button size="sm" variant="ghost" onClick={() => setCursor(new Date())}>
                Today
              </Button>
            </div>

            <div className="toolbar" style={{ marginBottom: 'var(--space-3)' }}>
              <div className="grow" style={{ minWidth: 180 }}>
                <TextField
                  label="Search tasks"
                  type="search"
                  placeholder="title, note or tag"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <SelectField
                label="Status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'open' | 'done' | 'all')}
                options={[
                  { value: 'open', label: 'Open' },
                  { value: 'done', label: 'Completed' },
                  { value: 'all', label: 'All' },
                ]}
              />
              <SelectField
                label="Priority"
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value as Priority | 'all')}
                options={[
                  { value: 'all', label: 'Any priority' },
                  { value: 'high', label: 'High' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'low', label: 'Low' },
                ]}
              />
            </div>

            {view === 'month' ? (
              <div className="table-wrap" style={{ marginBottom: 'var(--space-4)' }}>
                <table>
                  <caption className="visually-hidden">Month overview showing how many tasks are due each day</caption>
                  <thead>
                    <tr>
                      {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                        <th key={day} scope="col" className="center">
                          {weekdayLabel(day).slice(0, 2)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthCells.map((week, index) => (
                      <tr key={index}>
                        {week.map((date, cellIndex) => {
                          if (!date) return <td key={cellIndex} className="center muted">·</td>;
                          const dayTasks = data.tasks.filter((task) => task.dueDate === date);
                          const isToday = date === todayISO();
                          return (
                            <td key={date} className="center" style={isToday ? { background: 'var(--accent-soft)' } : undefined}>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ minHeight: 32, borderRadius: 8 }}
                                onClick={() => {
                                  setCursor(new Date(date + 'T00:00:00'));
                                  setView('day');
                                }}
                                aria-label={`${formatDate(date, 'medium')}, ${dayTasks.length} task${dayTasks.length === 1 ? '' : 's'}`}
                              >
                                {Number(date.slice(8, 10))}
                                {dayTasks.length > 0 ? <span className="tiny"> •{dayTasks.length}</span> : null}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {visible.length === 0 ? (
              <EmptyState
                icon="check-square"
                title={tab === 'study' ? 'No study sessions planned' : tab === 'goals' ? 'No personal goals yet' : 'No tasks yet'}
                action={<Button variant="accent" icon="plus" onClick={() => setDraft(blankDraft({ kind: tab === 'study' ? 'study' : tab === 'goals' ? 'goal' : 'task' }))}>Add one now</Button>}
              >
                {tab === 'study'
                  ? 'Add a study session with a subject tag and a due date. Blocks of 40–50 minutes with a break work better than marathon sessions.'
                  : tab === 'goals'
                    ? 'A personal goal needs a target value you can count, such as 20 practice tests or 12 books.'
                    : 'Start with three tasks: one for today, one for this week, and one that has been sitting unfinished.'}
              </EmptyState>
            ) : viewTasks.length === 0 ? (
              <EmptyState icon="calendar" title={`Nothing scheduled in this ${view}`}>
                Tasks exist in other periods. Use the arrows to move, or switch the view to Month to see everything at once.
              </EmptyState>
            ) : (
              <ul className="list">
                {viewTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onEdit={() => setDraft(draftFromTask(task))}
                    onDelete={() => setPendingDelete(task)}
                  />
                ))}
              </ul>
            )}
          </Card>

          <Card title="Quick add" subtitle="For the small things that come up while you are working">
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const input = form.elements.namedItem('quick-title') as HTMLInputElement;
                const title = cleanText(input.value, 200);
                if (title.length === 0) return;
                const now = new Date().toISOString();
                await saveTask({
                  id: createId('task'),
                  title,
                  kind: tab === 'study' ? 'study' : 'task',
                  status: 'open',
                  priority: 'medium',
                  dueDate: tab === 'study' ? todayISO() : null,
                  createdAt: now,
                  updatedAt: now,
                });
                input.value = '';
                notify('Task added.', 'success');
              }}
            >
              <div className="inline-form">
                <TextField label="Task title" name="quick-title" id="quick-title" placeholder="what needs doing?" />
                <Button type="submit" icon="plus" variant="secondary">
                  Add
                </Button>
              </div>
            </form>
            <p className="tiny muted" style={{ marginTop: 8, marginBottom: 0 }}>
              Want reminders for these tasks? Configure them in{' '}
              <a href={`#${ROUTES.notificationSettings}`}>Notification settings</a>. LIFEKIT never asks for notification
              permission until you switch reminders on yourself, and the planner works fully without it.
            </p>
          </Card>
        </>
      ) : null}

      <Dialog
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit task' : draft?.kind === 'study' ? 'Add study session' : draft?.kind === 'goal' ? 'Add personal goal' : 'Add task'}
      >
        {draft ? <TaskDialog draft={draft} onClose={() => setDraft(null)} existingTags={tags} /> : null}
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this task?"
        message={
          pendingDelete ? (
            <>
              <strong>{pendingDelete.title}</strong>
              {pendingDelete.dueDate ? ` (due ${formatDate(pendingDelete.dueDate, 'medium')})` : ''} will be removed from this
              device. This cannot be undone.
            </>
          ) : null
        }
        confirmLabel="Delete task"
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await deleteTask(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

export default Planner;
