/**
 * LIFEKIT Home dashboard.
 *
 * Everything on this screen is derived from data the user actually entered. For a new
 * install it shows guidance and empty states, never placeholder statistics — a dashboard
 * that invents numbers is worse than an empty one.
 */
import { useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, Notice, ProgressBar, StatTile, TextField } from '../components/ui';
import { Icon } from '../components/Icons';
import { ROUTES, navigate } from '../router';
import { useStore } from '../state/store';
import {
  addMoney,
  budgetStatus,
  formatMoney,
  summarize,
} from '../lib/money';
import {
  daysBetween,
  formatDate,
  greetingKey,
  periodRange,
  recentMonthKeys,
  todayISO,
  relativeDayLabel,
} from '../lib/dates';
import { createId } from '../lib/shared';
import { SAFETY_TOPICS } from '../content/safety';
import { LESSONS } from '../content/learning';

const GREETINGS: Record<'morning' | 'afternoon' | 'evening', string> = {
  morning: 'Good morning',
  afternoon: 'Good afternoon',
  evening: 'Good evening',
};

/** A single rotating safety tip, chosen deterministically by day so it is stable offline. */
function tipOfTheDay(): { title: string; rule: string; id: string } {
  const index = new Date().getDate() % SAFETY_TOPICS.length;
  const topic = SAFETY_TOPICS[index];
  return { title: topic.title, rule: topic.keyRule, id: topic.id };
}

function QuickTaskForm(): JSX.Element {
  const { saveTask, notify } = useStore();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const clean = title.trim();
    if (clean.length === 0) {
      setError('Give the task a short title.');
      return;
    }
    if (clean.length > 200) {
      setError('Keep the title under 200 characters.');
      return;
    }
    setError(null);
    const stamp = new Date().toISOString();
    await saveTask({
      id: createId('task'),
      title: clean,
      kind: 'task',
      status: 'open',
      priority: 'medium',
      dueDate: due || null,
      createdAt: stamp,
      updatedAt: stamp,
    });
    setTitle('');
    notify('Task added to the planner.', 'success');
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="inline-form">
        <TextField
          label="Add a task"
          placeholder="e.g. pay electricity bill"
          value={title}
          error={error}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
        />
        <TextField label="Due" type="date" value={due} onChange={(event) => setDue(event.target.value)} />
        <Button type="submit" icon="plus" variant="accent">
          Add
        </Button>
      </div>
    </form>
  );
}

export function Home(): JSX.Element {
  const {
    data,
    settings,
    online,
    prefs,
    announcements,
    announcementSource,
    saveTask,
    toggleHabit,
    notify,
  } = useStore();
  const now = new Date();
  const today = todayISO(now);
  const monthRange = periodRange('month', now, settings.weekStartsOn);

  const monthEntries = useMemo(
    () => data.entries.filter((entry) => entry.date >= monthRange.from && entry.date <= monthRange.to),
    [data.entries, monthRange.from, monthRange.to]
  );
  const monthSummary = summarize(monthEntries);
  const todaySummary = summarize(data.entries.filter((entry) => entry.date === today));

  const openTasks = data.tasks.filter((task) => task.status === 'open');
  const todayTasks = openTasks
    .filter((task) => task.dueDate === today)
    .sort((a, b) => (a.reminderAt ?? 0) - (b.reminderAt ?? 0) || a.createdAt.localeCompare(b.createdAt));
  const overdueTasks = openTasks.filter((task) => task.dueDate && task.dueDate < today);

  const monthBudgets = data.budgets.filter((budget) => budget.period === 'monthly');
  const weekRange = periodRange('week', now, settings.weekStartsOn);
  const weekEntries = data.entries.filter((entry) => entry.date >= weekRange.from && entry.date <= weekRange.to);

  const bookmarked = data.learningProgress.filter((progress) => progress.bookmarked);
  const readIds = new Set(data.announcementsRead.map((a) => a.id));
  const unreadAnnouncements = announcements.filter((a) => !readIds.has(a.id));
  const tip = tipOfTheDay();

  const habitsToday = data.habits.filter((habit) => !habit.archived && habit.days.includes(now.getDay()));
  const habitLogsToday = new Set(
    data.habitLogs.filter((log) => log.date === today && log.done).map((log) => log.habitId)
  );

  const savingsGoals = data.goals.filter((goal) => !goal.archived);
  const totalSaved = savingsGoals.reduce(
    (sum, goal) => addMoney(sum, goal.contributions.reduce((s, c) => addMoney(s, c.amount), 0)),
    0
  );

  const nextFollowUp = data.applications
    .filter((app) => app.nextFollowUp && app.status !== 'rejected' && app.status !== 'withdrawn')
    .sort((a, b) => (a.nextFollowUp ?? '').localeCompare(b.nextFollowUp ?? ''))[0];

  const daysSinceBackup = settings.lastBackupAt ? daysBetween(settings.lastBackupAt.slice(0, 10), today) : null;
  const backupOverdue = settings.lastBackupAt === null ? data.entries.length + data.tasks.length > 0 : (daysSinceBackup ?? 0) >= prefs.backupEveryDays;

  const monthName = periodRange('month', now).label;
  const monthKeys = recentMonthKeys(3, now);

  return (
    <div className="stack">
      <header>
        <h1 style={{ marginBottom: 2 }}>
          {GREETINGS[greetingKey(now)]}
          {settings.displayName ? `, ${settings.displayName}` : ''}
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          {formatDate(today, 'long')}
        </p>
      </header>

      {!online ? (
        <Notice tone="warning" title="You’re offline — your saved tools are still available.">
          Money records, tasks, habits, saved lessons, checklists and all the converter/calculator tools work normally.
          Things that need internet (opening external source links, or fetching published announcements from a LIFEKIT
          server if you enabled that) will not load until you reconnect. Nothing you type is lost.
        </Notice>
      ) : null}

      {backupOverdue ? (
        <Notice tone="warning" title="Backup reminder.">
          {settings.lastBackupAt
            ? `Your last export was ${daysSinceBackup} day${daysSinceBackup === 1 ? '' : 's'} ago.`
            : 'You have not exported a backup yet.'}{' '}
          Records live only in this browser’s storage.{' '}
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => navigate(ROUTES.backup)}
            style={{ marginLeft: 8 }}
          >
            Open backup &amp; restore
          </button>
        </Notice>
      ) : null}

      <section aria-labelledby="quick-actions">
        <h2 id="quick-actions" className="visually-hidden">
          Quick actions
        </h2>
        <div className="grid grid-3">
          <Button variant="accent" icon="minus" onClick={() => navigate(ROUTES.money, { query: { quick: 'expense' } })}>
            Add expense
          </Button>
          <Button variant="secondary" icon="plus" onClick={() => navigate(ROUTES.money, { query: { quick: 'income' } })}>
            Add income
          </Button>
          <Button variant="secondary" icon="calculator" onClick={() => navigate(ROUTES.tools)}>
            Offline tools
          </Button>
        </div>
      </section>

      <div className="grid grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <Card title="Today at a glance">
          <div className="grid grid-2">
            <StatTile
              label="Recorded in"
              value={formatMoney(todaySummary.income, { currency: settings.currency, locale: settings.locale })}
              tone="income"
            />
            <StatTile
              label="Recorded out"
              value={formatMoney(todaySummary.expense, { currency: settings.currency, locale: settings.locale })}
              tone="expense"
            />
          </div>
          <p className="tiny muted" style={{ marginTop: 8, marginBottom: 0 }}>
            {todaySummary.entryCount === 0
              ? 'Nothing recorded today yet.'
              : `${todaySummary.entryCount} entr${todaySummary.entryCount === 1 ? 'y' : 'ies'} recorded today.`}{' '}
            These are your own records, not a bank balance.
          </p>
        </Card>

        <Card title={monthName} subtitle="Recorded income and expenses for this month">
          <div className="grid grid-2">
            <StatTile
              label="Income"
              value={formatMoney(monthSummary.income, { currency: settings.currency, locale: settings.locale })}
              tone="income"
            />
            <StatTile
              label="Expenses"
              value={formatMoney(monthSummary.expense, { currency: settings.currency, locale: settings.locale })}
              tone="expense"
            />
          </div>
          <div className="row-between" style={{ marginTop: 8 }}>
            <span className="small muted">Net recorded cash flow</span>
            <span className={`amount ${monthSummary.net >= 0 ? 'amount-income' : 'amount-expense'}`}>
              {formatMoney(monthSummary.net, { currency: settings.currency, locale: settings.locale })}
            </span>
          </div>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <Button size="sm" variant="secondary" icon="wallet" onClick={() => navigate(ROUTES.money)}>
              Open Money tracker
            </Button>
          </div>
        </Card>
      </div>

      <div className="grid grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <Card
          title="Today’s tasks"
          subtitle={todayTasks.length === 0 ? undefined : `${todayTasks.length} due today`}
          actions={
            <Button size="sm" variant="ghost" icon="check-square" onClick={() => navigate(ROUTES.planner)}>
              Planner
            </Button>
          }
        >
          {todayTasks.length === 0 ? (
            <div className="stack-sm">
              {overdueTasks.length > 0 ? (
                <Notice tone="warning">
                  {overdueTasks.length} task{overdueTasks.length === 1 ? '' : 's'} overdue. Open the planner to
                  reschedule.
                </Notice>
              ) : null}
              <p className="small muted" style={{ margin: 0 }}>
                Nothing is due today. Add the next thing you need to do:
              </p>
              <QuickTaskForm />
            </div>
          ) : (
            <>
              <ul className="list">
                {todayTasks.slice(0, 6).map((task) => (
                  <li className="list-item" key={task.id}>
                    <input
                      type="checkbox"
                      aria-label={`Mark “${task.title}” as done`}
                      checked={false}
                      onChange={async () => {
                        await saveTask({ ...task, status: 'done', completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
                        notify('Task completed.', 'success');
                      }}
                      style={{ width: 22, height: 22, marginTop: 2, accentColor: 'var(--accent)' }}
                    />
                    <div className="list-item-main">
                      <div style={{ fontWeight: 550 }}>{task.title}</div>
                      <div className="tiny muted">
                        {task.priority === 'high' ? <Badge tone="danger">High</Badge> : null}{' '}
                        {task.reminderAt != null ? `Reminder ${String(Math.floor(task.reminderAt / 60)).padStart(2, '0')}:${String(task.reminderAt % 60).padStart(2, '0')}` : ''}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: 12 }}>
                <QuickTaskForm />
              </div>
            </>
          )}
        </Card>

        <Card title="Habits" subtitle="Optional daily tracking">
          {habitsToday.length === 0 ? (
            <EmptyState icon="target" title="No habits set up" action={<Button size="sm" variant="secondary" icon="target" onClick={() => navigate(ROUTES.planner, { query: { tab: 'habits' } })}>Create a habit</Button>}>
              Habit tracking is optional. A good first habit is “record today’s spending”, which takes under a minute.
            </EmptyState>
          ) : (
            <ul className="list">
              {habitsToday.map((habit) => {
                const done = habitLogsToday.has(habit.id);
                return (
                  <li className="list-item" key={habit.id}>
                    <input
                      type="checkbox"
                      checked={done}
                      aria-label={`Mark ${habit.name} as done today`}
                      onChange={() => void toggleHabit(habit.id, today)}
                      style={{ width: 22, height: 22, marginTop: 2, accentColor: 'var(--accent)' }}
                    />
                    <div className="list-item-main">
                      <div style={{ fontWeight: 550, textDecoration: done ? 'line-through' : 'none' }}>{habit.name}</div>
                      <div className="tiny muted">{done ? 'Done today' : 'Not done yet'}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card
        title="Budget progress"
        subtitle={`Monthly limits, checked against ${monthName}`}
        actions={
          <Button size="sm" variant="ghost" icon="settings" onClick={() => navigate(ROUTES.money, { query: { tab: 'budgets' } })}>
            Manage
          </Button>
        }
      >
        {monthBudgets.length === 0 ? (
          <EmptyState
            icon="target"
            title="No budget limits yet"
            action={
              <Button size="sm" variant="secondary" icon="plus" onClick={() => navigate(ROUTES.money, { query: { tab: 'budgets' } })}>
                Set a monthly limit
              </Button>
            }
          >
            A budget limit is optional. If you set one, LIFEKIT compares it with your recorded expenses for that period and
            shows how much remains. It never contacts your bank.
          </EmptyState>
        ) : (
          <div className="stack-sm">
            {monthBudgets.map((budget) => {
              const status = budgetStatus(budget, monthEntries);
              const categoryName =
                budget.categoryId === 'all'
                  ? 'All expenses'
                  : data.categories.find((c) => c.id === budget.categoryId)?.name ?? 'Unknown category';
              return (
                <div key={budget.id}>
                  <div className="row-between">
                    <span className="small" style={{ fontWeight: 600 }}>
                      {categoryName}
                    </span>
                    <span className="small mono">
                      {formatMoney(status.spent, { currency: settings.currency, locale: settings.locale })} /{' '}
                      {formatMoney(status.limit, { currency: settings.currency, locale: settings.locale })}
                    </span>
                  </div>
                  <ProgressBar percent={status.percentUsed} label={`${categoryName} budget used`} />
                  <p className="tiny muted" style={{ margin: '4px 0 0' }}>
                    {status.overBudget
                      ? `Over by ${formatMoney(Math.abs(status.remaining), { currency: settings.currency, locale: settings.locale })} in recorded expenses.`
                      : `${formatMoney(status.remaining, { currency: settings.currency, locale: settings.locale })} remaining this month.`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <Card title="Savings goals" subtitle={savingsGoals.length > 0 ? `Total set aside: ${formatMoney(totalSaved, { currency: settings.currency, locale: settings.locale })}` : undefined}>
          {savingsGoals.length === 0 ? (
            <EmptyState icon="target" title="No savings goals yet" action={<Button size="sm" variant="secondary" icon="plus" onClick={() => navigate(ROUTES.money, { query: { tab: 'goals' } })}>Create a goal</Button>}>
              Savings goals are targets you track yourself — for example an emergency fund of one month of essential
              spending. LIFEKIT cannot move money.
            </EmptyState>
          ) : (
            <ul className="list">
              {savingsGoals.slice(0, 4).map((goal) => {
                const saved = goal.contributions.reduce((sum, c) => addMoney(sum, c.amount), 0);
                const percent = goal.target > 0 ? Math.min(100, (saved / goal.target) * 100) : 0;
                return (
                  <li key={goal.id} style={{ paddingBottom: 10 }}>
                    <div className="row-between">
                      <span className="small" style={{ fontWeight: 600 }}>
                        {goal.name}
                      </span>
                      <span className="small mono">
                        {formatMoney(saved, { currency: settings.currency, locale: settings.locale })} /{' '}
                        {formatMoney(goal.target, { currency: settings.currency, locale: settings.locale })}
                      </span>
                    </div>
                    <ProgressBar percent={percent} label={`${goal.name} progress`} tone="never-over" />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Saved learning resources" subtitle="Lessons you bookmarked are readable offline">
          {bookmarked.length === 0 ? (
            <EmptyState icon="book" title="Nothing saved yet" action={<Button size="sm" variant="secondary" icon="book" onClick={() => navigate(ROUTES.learn)}>Browse lessons</Button>}>
              The library has short original lessons on money basics, study methods, digital safety and career skills. Save
              a lesson and it stays available offline.
            </EmptyState>
          ) : (
            <ul className="list">
              {bookmarked.slice(0, 5).map((progress) => {
                const lesson = LESSONS.find((l) => l.id === progress.id);
                return (
                  <li className="list-item" key={progress.id}>
                    <div className="list-item-main">
                      <a href={`#${ROUTES.learn}/${progress.id}`} style={{ fontWeight: 600 }}>
                        {lesson?.title ?? progress.cached?.title ?? progress.id}
                      </a>
                      <div className="tiny muted">
                        {lesson ? `${lesson.minutes} min · ` : ''}
                        {progress.read ? 'Completed' : `${progress.progress}% read`}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <Card title="Career shortcuts">
          <div className="btn-row">
            <Button size="sm" variant="secondary" icon="briefcase" onClick={() => navigate(ROUTES.career, { query: { tab: 'resume' } })}>
              Résumé builder
            </Button>
            <Button size="sm" variant="secondary" icon="list" onClick={() => navigate(ROUTES.career, { query: { tab: 'tracker' } })}>
              Application tracker
            </Button>
            <Button size="sm" variant="secondary" icon="info" onClick={() => navigate(ROUTES.career, { query: { tab: 'interview' } })}>
              Interview practice
            </Button>
          </div>
          <hr className="divider" />
          {data.applications.length === 0 ? (
            <p className="small muted" style={{ margin: 0 }}>
              No applications tracked yet. LIFEKIT does not list jobs and cannot verify employers — it helps you keep your
              own records and follow-ups in order.
            </p>
          ) : (
            <p className="small" style={{ margin: 0 }}>
              Tracking {data.applications.length} application{data.applications.length === 1 ? '' : 's'}
              {nextFollowUp?.nextFollowUp
                ? ` · next follow-up ${relativeDayLabel(nextFollowUp.nextFollowUp, today)}`
                : ' · no follow-up dates set'}
              .
            </p>
          )}
        </Card>

        <Card
          title="Digital safety tip"
          subtitle={`Rotates daily · reviewed ${formatDate('2026-10-11', 'medium', settings.locale)}`}
          actions={
            <Button size="sm" variant="ghost" icon="shield" onClick={() => navigate(ROUTES.safety)}>
              Safety centre
            </Button>
          }
        >
          <p style={{ fontWeight: 650, marginBottom: 4 }}>{tip.title}</p>
          <p className="small" style={{ margin: 0 }}>
            {tip.rule}
          </p>
          <p className="tiny muted" style={{ marginTop: 8, marginBottom: 0 }}>
            Educational guidance only. LIFEKIT cannot detect scams, check whether a link is safe, or verify an
            organisation.
          </p>
        </Card>
      </div>

      <Card
        title="Announcements"
        subtitle={
          announcementSource === 'published'
            ? unreadAnnouncements.length > 0
              ? `${unreadAnnouncements.length} unread from the content server`
              : 'Published messages · nothing unread'
            : announcementSource === 'unavailable'
              ? 'Published feed unreachable · showing bundled examples'
              : 'Bundled examples · nothing is published to you yet'
        }
        actions={
          <Button size="sm" variant="ghost" icon="bell" onClick={() => navigate(ROUTES.notifications)}>
            Notification centre
          </Button>
        }
      >
        {announcements.length === 0 ? (
          <EmptyState icon="bell" title="No messages">
            LIFEKIT only shows announcements when there is something to say. There is no advertising here, and nothing is
            sent to you based on your activity.
          </EmptyState>
        ) : (
          <ul className="list">
            {announcements.slice(0, 3).map((announcement) => (
              <li className="list-item" key={announcement.id}>
                <Icon name="info" size={20} className="nav-icon" />
                <div className="list-item-main">
                  <div className="row" style={{ gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>{announcement.title}</span>
                    {announcement.sample ? <Badge>Example</Badge> : null}
                    {!readIds.has(announcement.id) ? <Badge tone="accent">New</Badge> : null}
                  </div>
                  <p className="small muted" style={{ margin: '2px 0 0' }}>
                    {announcement.body.slice(0, 140)}
                    {announcement.body.length > 140 ? '…' : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="This quarter at a glance" subtitle="Recorded totals by month">
        <div className="table-wrap">
          <table>
            <caption className="visually-hidden">Recorded income and expenses for the last three months</caption>
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col" className="numeric">
                  Income
                </th>
                <th scope="col" className="numeric">
                  Expenses
                </th>
                <th scope="col" className="numeric">
                  Net
                </th>
              </tr>
            </thead>
            <tbody>
              {monthKeys.map((key) => {
                const rows = data.entries.filter((entry) => entry.date.startsWith(key));
                const s = summarize(rows);
                return (
                  <tr key={key}>
                    <th scope="row" style={{ fontWeight: 600 }}>
                      {formatDate(`${key}-01`, 'short', settings.locale)}
                    </th>
                    <td className="numeric amount-income">
                      {formatMoney(s.income, { currency: settings.currency, locale: settings.locale })}
                    </td>
                    <td className="numeric amount-expense">
                      {formatMoney(s.expense, { currency: settings.currency, locale: settings.locale })}
                    </td>
                    <td className="numeric">{formatMoney(s.net, { currency: settings.currency, locale: settings.locale })}</td>
                  </tr>
                );
              })}
              <tr>
                <th scope="row" style={{ fontWeight: 600 }}>
                  This week (so far)
                </th>
                <td className="numeric amount-income">
                  {formatMoney(summarize(weekEntries).income, { currency: settings.currency, locale: settings.locale })}
                </td>
                <td className="numeric amount-expense">
                  {formatMoney(summarize(weekEntries).expense, { currency: settings.currency, locale: settings.locale })}
                </td>
                <td className="numeric">
                  {formatMoney(summarize(weekEntries).net, { currency: settings.currency, locale: settings.locale })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="tiny muted" style={{ marginTop: 8, marginBottom: 0 }}>
          Net is income minus expenses from your own entries. It is not your bank balance and does not include anything you
          have not recorded.
        </p>
      </Card>
    </div>
  );
}

