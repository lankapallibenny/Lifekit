/**
 * Notification engine tests.
 *
 * The scheduling rules are pure functions, so every rule that matters to a user can be
 * verified without a browser: quiet hours, per-category switches, once-per-day keys, the
 * backup cadence, and — important for the "do not nag" requirement — that a denied
 * permission is never requested again.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildLogItem,
  deliver,
  dueReminders,
  isCategoryEnabled,
  isQuietHours,
  notificationSupport,
  previewDescriptor,
  requestPermission,
  undelivered,
  type ReminderInput,
  type ReminderKind,
} from '../src/lib/notifications';
import { DEFAULT_NOTIFICATION_PREFS } from '../src/lib/defaults';
import type { NotificationPrefs, Task } from '../src/lib/models';

const NOW = new Date('2026-10-11T09:30:00');

function prefs(overrides: Partial<NotificationPrefs> = {}): NotificationPrefs {
  return { ...DEFAULT_NOTIFICATION_PREFS, masterEnabled: true, ...overrides };
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Pay electricity bill',
    kind: 'task',
    status: 'open',
    priority: 'medium',
    dueDate: '2026-10-11',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function input(overrides: Partial<ReminderInput> = {}): ReminderInput {
  return {
    tasks: [],
    habitNames: [],
    habitLoggedToday: new Set<string>(),
    pref: prefs(),
    settings: { lastBackupAt: '2026-10-10T00:00:00.000Z', reminderCheckEnabled: true },
    now: NOW,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('quiet hours', () => {
  it('treats a zero-length window as wide open, not as always quiet', () => {
    expect(isQuietHours(600, 600, 600)).toBe(false);
  });

  it('handles a daytime window', () => {
    expect(isQuietHours(13 * 60, 12 * 60, 14 * 60)).toBe(true);
    expect(isQuietHours(11 * 60, 12 * 60, 14 * 60)).toBe(false);
    expect(isQuietHours(14 * 60, 12 * 60, 14 * 60)).toBe(false); // end is exclusive
  });

  it('handles a window that crosses midnight', () => {
    const start = 22 * 60;
    const end = 7 * 60;
    expect(isQuietHours(23 * 60, start, end)).toBe(true);
    expect(isQuietHours(2 * 60, start, end)).toBe(true);
    expect(isQuietHours(6 * 60 + 59, start, end)).toBe(true);
    expect(isQuietHours(7 * 60, start, end)).toBe(false);
    expect(isQuietHours(12 * 60, start, end)).toBe(false);
  });
});

describe('category switches', () => {
  it('is off entirely when the master switch is off', () => {
    const off = prefs({ masterEnabled: false });
    for (const kind of ['task', 'due', 'planner', 'habit', 'backup', 'announcement'] as ReminderKind[]) {
      expect(isCategoryEnabled(kind, off)).toBe(false);
    }
  });

  it('respects each individual toggle', () => {
    expect(isCategoryEnabled('task', prefs({ taskReminders: false }))).toBe(false);
    expect(isCategoryEnabled('due', prefs({ dueDateReminders: false }))).toBe(false);
    expect(isCategoryEnabled('planner', prefs({ dailyPlannerReminder: false }))).toBe(false);
    expect(isCategoryEnabled('habit', prefs({ habitReminders: false }))).toBe(false);
    expect(isCategoryEnabled('announcement', prefs({ announcements: false }))).toBe(false);
    expect(isCategoryEnabled('task', prefs())).toBe(true);
  });

  it('treats a backup cadence of zero days as off', () => {
    expect(isCategoryEnabled('backup', prefs({ backupReminders: true, backupEveryDays: 0 }))).toBe(false);
    expect(isCategoryEnabled('backup', prefs({ backupReminders: false, backupEveryDays: 7 }))).toBe(false);
    expect(isCategoryEnabled('backup', prefs({ backupReminders: true, backupEveryDays: 7 }))).toBe(true);
  });
});

describe('scheduling with a fixed clock', () => {
  it('produces nothing when notifications are off or the check is disabled', () => {
    expect(dueReminders(input({ tasks: [task()], pref: prefs({ masterEnabled: false }) }))).toEqual([]);
    expect(dueReminders(input({ tasks: [task()], settings: { lastBackupAt: null, reminderCheckEnabled: false } }))).toEqual([]);
  });

  it('fires a task reminder at or after its time on the due day only', () => {
    const withTime = task({ reminderAt: 9 * 60 });
    expect(dueReminders(input({ tasks: [withTime] })).map((d) => d.kind)).toContain('task');

    const later = task({ reminderAt: 18 * 60 });
    expect(dueReminders(input({ tasks: [later] })).map((d) => d.kind)).not.toContain('task');

    const tomorrow = task({ reminderAt: 9 * 60, dueDate: '2026-10-12' });
    expect(dueReminders(input({ tasks: [tomorrow] })).map((d) => d.kind)).not.toContain('task');
  });

  it('does not remind about completed tasks or tasks without a reminder time', () => {
    const done = task({ status: 'done', reminderAt: 9 * 60 });
    const noTime = task({ reminderAt: null });
    expect(dueReminders(input({ tasks: [done, noTime] }))).toEqual([]);
  });

  it('reports overdue tasks once per day', () => {
    const late = task({ id: 'late', dueDate: '2026-10-05' });
    const reminders = dueReminders(input({ tasks: [late] }));
    const due = reminders.find((r) => r.kind === 'due');
    expect(due?.key).toBe('due:late:2026-10-11');
    expect(due?.body).toContain('2026-10-05');
  });

  it('mentions today and overdue counts in the daily planner reminder', () => {
    const reminders = dueReminders(
      input({
        tasks: [task({ id: 'today' }), task({ id: 'late', dueDate: '2026-10-01' })],
        pref: prefs({ dailyPlannerReminder: true, dailyPlannerTime: 8 * 60 }),
      })
    );
    const planner = reminders.find((r) => r.kind === 'planner');
    expect(planner?.body).toContain('1 task due today');
    expect(planner?.body).toContain('1 overdue');
    expect(planner?.key).toBe('planner:2026-10-11');
  });

  it('does not fire the planner reminder before its configured time', () => {
    const reminders = dueReminders(input({ pref: prefs({ dailyPlannerReminder: true, dailyPlannerTime: 20 * 60 }) }));
    expect(reminders.find((r) => r.kind === 'planner')).toBeUndefined();
  });

  it('reminds about habits scheduled for today that are not ticked yet', () => {
    const saturday = NOW.getDay(); // 2026-10-11 is a Sunday (0)
    const habit = { id: 'h1', name: 'Walk 20 minutes', reminderAt: 9 * 60, days: [saturday] };
    const withHabits = prefs({ habitReminders: true });
    const reminders = dueReminders(input({ habitNames: [habit], pref: withHabits }));
    expect(reminders.find((r) => r.kind === 'habit')?.key).toBe(`habit:h1:2026-10-11`);

    const ticked = dueReminders(input({ habitNames: [habit], habitLoggedToday: new Set(['h1']), pref: withHabits }));
    expect(ticked.find((r) => r.kind === 'habit')).toBeUndefined();

    const otherDay = dueReminders(input({ habitNames: [{ ...habit, days: [(saturday + 1) % 7] }], pref: withHabits }));
    expect(otherDay.find((r) => r.kind === 'habit')).toBeUndefined();
  });

  it('reminds about a backup on the configured cadence, and immediately when none exists', () => {
    const never = dueReminders(input({ settings: { lastBackupAt: null, reminderCheckEnabled: true } }));
    expect(never.find((r) => r.kind === 'backup')?.key).toBe('backup:2026-10-11');

    const recent = dueReminders(input({ settings: { lastBackupAt: '2026-10-09T00:00:00.000Z', reminderCheckEnabled: true } }));
    expect(recent.find((r) => r.kind === 'backup')).toBeUndefined();

    const stale = dueReminders(
      input({ settings: { lastBackupAt: '2026-09-01T00:00:00.000Z', reminderCheckEnabled: true } })
    );
    expect(stale.find((r) => r.kind === 'backup')?.body).toContain('last backup');
  });

  it('never puts a money amount in a reminder body', () => {
    const reminders = dueReminders(
      input({
        tasks: [task({ title: 'Pay electricity bill 2500', reminderAt: 9 * 60 })],
        pref: prefs({ dailyPlannerReminder: true }),
      })
    );
    // The task title the user typed may contain digits, but LIFEKIT never adds figures from
    // the money tracker, budgets or goals to a notification.
    for (const reminder of reminders) {
      expect(reminder.body).not.toMatch(/₹|INR|balance|budget of|spent/i);
    }
  });
});

describe('published announcements', () => {
  const message = {
    id: 'notice-1',
    title: 'Service maintenance',
    body: 'The optional content service is unavailable for a short maintenance window today.',
    category: 'service' as const,
    priority: 'normal' as const,
    language: 'en',
    publishedAt: '2026-10-01',
    expiresAt: null,
    sample: false,
    notifyEligible: true,
  };

  it('produces a reminder for an eligible published message when the category is on', () => {
    const reminders = dueReminders(input({ announcements: [message], pref: prefs({ announcements: true }) }));
    const found = reminders.find((r) => r.kind === 'announcement');
    expect(found?.key).toBe('announcement:notice-1');
    expect(found?.refId).toBe('notice-1');
  });

  it('stays silent when announcement notifications are off', () => {
    const reminders = dueReminders(input({ announcements: [message], pref: prefs({ announcements: false }) }));
    expect(reminders.find((r) => r.kind === 'announcement')).toBeUndefined();
  });

  it('never notifies for a bundled example or a message an operator did not mark eligible', () => {
    const example = { ...message, id: 'sample-1', sample: true };
    const notEligible = { ...message, id: 'quiet-1', notifyEligible: false };
    const reminders = dueReminders(
      input({ announcements: [example, notEligible], pref: prefs({ announcements: true }) })
    );
    expect(reminders.find((r) => r.kind === 'announcement')).toBeUndefined();
  });

  it('ignores messages that already expired', () => {
    const expired = { ...message, id: 'old-1', expiresAt: '2026-09-30' };
    const reminders = dueReminders(input({ announcements: [expired], pref: prefs({ announcements: true }) }));
    expect(reminders.find((r) => r.kind === 'announcement')).toBeUndefined();
  });

  it('truncates a long body so a notification stays readable', () => {
    const long = { ...message, body: 'x'.repeat(600) };
    const reminders = dueReminders(input({ announcements: [long], pref: prefs({ announcements: true }) }));
    expect((reminders.find((r) => r.kind === 'announcement')?.body ?? '').length).toBeLessThanOrEqual(241);
  });
});

describe('deduplication', () => {
  it('drops reminders already present in the log', () => {
    const reminders = dueReminders(input({ tasks: [task({ reminderAt: 9 * 60 })], pref: prefs({ dailyPlannerReminder: true }) }));
    expect(reminders.length).toBeGreaterThan(1);

    const log = [buildLogItem(reminders[0]!, NOW)];
    const remaining = undelivered(reminders, log);
    expect(remaining).toHaveLength(reminders.length - 1);
    expect(remaining.find((r) => r.key === reminders[0]!.key)).toBeUndefined();
  });

  it('uses a stable per-day key so the same reminder cannot repeat', () => {
    const first = dueReminders(input({ tasks: [task({ reminderAt: 9 * 60 })] }));
    const second = dueReminders(input({ tasks: [task({ reminderAt: 9 * 60 })] }));
    expect(first[0]?.key).toBe(second[0]?.key);
  });
});

describe('log items', () => {
  it('records local origin, unread state and an ISO timestamp', () => {
    const item = buildLogItem({ kind: 'habit', title: 'Habit: Walk', body: 'Not marked done yet today.', key: 'habit:h1:2026-10-11' }, NOW);
    expect(item).toMatchObject({
      id: 'habit:h1:2026-10-11',
      category: 'habit',
      read: false,
      origin: 'local',
    });
    expect(item.at).toBe(NOW.toISOString());
  });
});

describe('permission handling', () => {
  class FakeNotification {
    static permission: NotificationPermission = 'default';
    static requestPermission = vi.fn(async () => FakeNotification.permission);
    constructor(public title: string, public options?: unknown) {}
  }

  it('reports unsupported when the browser has no Notification API', () => {
    const status = notificationSupport();
    // jsdom does not implement Notification, so this is the honest "unsupported" path.
    if (!('Notification' in window)) {
      expect(status.supported).toBe(false);
      expect(status.permission).toBe('unsupported');
    }
  });

  it('never prompts again once permission was denied', async () => {
    vi.stubGlobal('Notification', FakeNotification);
    FakeNotification.permission = 'denied';
    FakeNotification.requestPermission.mockClear();

    const result = await requestPermission();
    expect(result).toBe('denied');
    expect(FakeNotification.requestPermission).not.toHaveBeenCalled();
  });

  it('returns the existing grant without prompting', async () => {
    vi.stubGlobal('Notification', FakeNotification);
    FakeNotification.permission = 'granted';
    FakeNotification.requestPermission.mockClear();

    expect(await requestPermission()).toBe('granted');
    expect(FakeNotification.requestPermission).not.toHaveBeenCalled();
  });

  it('does prompt the first time, and refuses to nag after a denial', async () => {
    vi.stubGlobal('Notification', FakeNotification);
    FakeNotification.permission = 'default';
    FakeNotification.requestPermission.mockReset();
    FakeNotification.requestPermission.mockResolvedValueOnce('denied');

    expect(await requestPermission()).toBe('denied');
    expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);

    FakeNotification.permission = 'denied';
    expect(await requestPermission()).toBe('denied');
    expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);
  });
});

describe('delivery', () => {
  it('suppresses everything inside quiet hours and says why', async () => {
    const outcome = await deliver(
      { kind: 'task', title: 'Reminder', body: 'Body', key: 'k' },
      prefs({ quietHoursEnabled: true, quietStart: 22 * 60, quietEnd: 7 * 60 }),
      new Date('2026-10-11T23:10:00')
    );
    expect(outcome).toEqual({ delivered: false, via: 'suppressed', reason: 'quiet hours' });
  });

  it('falls back to an in-app record when permission is not granted, losing nothing', async () => {
    const outcome = await deliver({ kind: 'task', title: 'Reminder', body: 'Body', key: 'k' }, prefs(), NOW);
    expect(outcome.delivered).toBe(true);
    expect(outcome.via).toBe('in-app');
  });

  it('previews an example without scheduling anything', () => {
    const preview = previewDescriptor();
    expect(preview.body).toContain('preview');
    expect(preview.key.startsWith('preview:')).toBe(true);
  });
});
