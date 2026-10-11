/**
 * Backup and restore tests.
 *
 * Import is the highest-risk input path in the application, so these tests attack it:
 * wrong app identifier, unsupported schema, prototype pollution, wrong types, invalid
 * dates, negative amounts, oversized files, and a valid file containing some broken records
 * (which must import the good records and say exactly what was skipped).
 */
import { describe, expect, it } from 'vitest';
import { BACKUP_APP_ID, BACKUP_SCHEMA_VERSION, buildBackup, parseBackupText, safeUrl, sanitizeNotificationPrefs, sanitizeResume, sanitizeSettings, verifyBackup } from '../src/lib/backup';
import { EMPTY_DATA, type LifeKitData } from '../src/lib/models';
import { DEFAULT_NOTIFICATION_PREFS, DEFAULT_SETTINGS } from '../src/lib/defaults';

function sampleData(): LifeKitData {
  return {
    ...EMPTY_DATA,
    entries: [
      {
        id: 'mny_1',
        type: 'expense',
        amount: 250.5,
        date: '2026-10-01',
        categoryId: 'expense_food',
        note: 'vegetables',
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-01T10:00:00.000Z',
      },
    ],
    categories: [{ id: 'expense_food', name: 'Food & groceries', type: 'expense', custom: false }],
    budgets: [{ id: 'bud_1', categoryId: 'all', period: 'monthly', limit: 10000, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' }],
    goals: [
      {
        id: 'goal_1',
        name: 'Emergency fund',
        target: 30000,
        contributions: [{ id: 'con_1', amount: 5000, date: '2026-10-01' }],
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      },
    ],
    tasks: [
      {
        id: 'task_1',
        title: 'Pay electricity bill',
        kind: 'task',
        status: 'open',
        priority: 'high',
        dueDate: '2026-10-15',
        reminderAt: 540,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      },
    ],
    habits: [{ id: 'habit_1', name: 'Record spending', days: [1, 2, 3, 4, 5], createdAt: '2026-10-01T00:00:00.000Z' }],
    habitLogs: [{ id: 'habit_1:2026-10-10', habitId: 'habit_1', date: '2026-10-10', done: true }],
    notes: [{ id: 'note_1', title: 'Account number', body: 'XXXX1234', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' }],
    checklists: [
      {
        id: 'list_1',
        title: 'Trip packing',
        kind: 'custom',
        items: [{ id: 'ci_1', text: 'Charger', done: true }],
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      },
    ],
    learningProgress: [
      { id: 'files-folders', read: true, progress: 100, bookmarked: true, updatedAt: '2026-10-02T00:00:00.000Z', cached: { title: 'Files and folders', body: 'Cached body text', savedAt: '2026-10-02T00:00:00.000Z' } },
    ],
    resume: sanitizeResume({ fullName: 'Test Person', headline: 'Student', email: 'test@example.com' }),
    applications: [
      {
        id: 'app_1',
        role: 'Accounts assistant',
        organisation: 'Example Traders',
        status: 'applied',
        appliedDate: '2026-10-01',
        nextFollowUp: '2026-10-20',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      },
    ],
    settings: { ...DEFAULT_SETTINGS, onboarded: true, displayName: 'Test' },
    notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS, masterEnabled: true },
    notificationLog: [
      { id: 'planner:2026-10-11', category: 'planner', title: 'Today’s plan', body: '1 task due today', at: '2026-10-11T08:00:00.000Z', read: false, origin: 'local' },
    ],
    announcementsRead: [{ id: 'sample-welcome', readAt: '2026-10-11T08:00:00.000Z' }],
    reports: [{ id: 'rep_1', listingId: 'listing_1', reason: 'outdated', details: '', createdAt: '2026-10-11T00:00:00.000Z' }],
  };
}

describe('buildBackup', () => {
  it('produces a versioned envelope with a privacy note', () => {
    const backup = buildBackup(sampleData(), '1.0.0', '2026-10-11T12:00:00.000Z');
    expect(backup.app).toBe(BACKUP_APP_ID);
    expect(backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(backup.appVersion).toBe('1.0.0');
    expect(backup.privacy).toMatch(/not been uploaded anywhere/);
    expect(backup.data.entries).toHaveLength(1);
  });

  it('keeps the notification log bounded so a backup file stays small', () => {
    const data = sampleData();
    data.notificationLog = Array.from({ length: 500 }, (_, i) => ({
      id: `log_${i}`,
      category: 'system' as const,
      title: `Item ${i}`,
      body: '',
      at: '2026-10-11T00:00:00.000Z',
      read: true,
      origin: 'local' as const,
    }));
    const backup = buildBackup(data, '1.0.0');
    expect(backup.data.notificationLog.length).toBe(200);
  });
});

describe('round trip', () => {
  it('restores everything it exported', () => {
    const backup = buildBackup(sampleData(), '1.0.0');
    const verification = verifyBackup(JSON.parse(JSON.stringify(backup)));
    expect(verification.ok).toBe(true);
    expect(verification.errors).toEqual([]);
    const restored = verification.data as LifeKitData;
    expect(restored.entries[0]).toMatchObject({ amount: 250.5, note: 'vegetables' });
    expect(restored.tasks[0]).toMatchObject({ title: 'Pay electricity bill', reminderAt: 540 });
    expect(restored.habitLogs[0]).toMatchObject({ habitId: 'habit_1', done: true });
    expect(restored.learningProgress[0].cached?.body).toBe('Cached body text');
    expect(restored.resume?.fullName).toBe('Test Person');
    expect(restored.applications[0].nextFollowUp).toBe('2026-10-20');
    expect(restored.settings.onboarded).toBe(true);
    expect(restored.notificationPrefs.masterEnabled).toBe(true);
    expect(verification.counts.entries).toBe(1);
    expect(verification.counts.goals).toBe(1);
  });

  it('survives a JSON string round trip through parseBackupText', () => {
    const text = JSON.stringify(buildBackup(sampleData(), '1.0.0'));
    const verification = parseBackupText(text);
    expect(verification.ok).toBe(true);
    expect(verification.data?.entries).toHaveLength(1);
  });
});

describe('rejection of invalid files', () => {
  it('rejects malformed JSON without throwing', () => {
    const result = parseBackupText('{ this is not json');
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/not valid JSON/);
  });

  it('rejects a file that is JSON but not a backup', () => {
    const result = parseBackupText(JSON.stringify({ hello: 'world' }));
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/not a LIFEKIT backup/i);
  });

  it('rejects a foreign app identifier', () => {
    const verification = verifyBackup({ app: 'OTHERTHING', schemaVersion: 1, data: {} });
    expect(verification.ok).toBe(false);
    expect(verification.errors[0]).toContain('OTHERTHING');
  });

  it('rejects an unsupported schema version', () => {
    const verification = verifyBackup({ app: BACKUP_APP_ID, schemaVersion: 99, data: {} });
    expect(verification.ok).toBe(false);
    expect(verification.errors[0]).toMatch(/schema version/i);
  });

  it('rejects prototype pollution attempts outright', () => {
    const payload = JSON.parse('{"app":"LIFEKIT","schemaVersion":1,"data":{"entries":[],"__proto__":{"polluted":true}}}');
    const verification = verifyBackup(payload);
    expect(verification.ok).toBe(false);
    expect(verification.errors[0]).toMatch(/unsafe object keys/i);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('rejects an array, a string and null as a backup', () => {
    expect(verifyBackup([]).ok).toBe(false);
    expect(verifyBackup('backup').ok).toBe(false);
    expect(verifyBackup(null).ok).toBe(false);
  });

  it('rejects a file with no data section', () => {
    const verification = verifyBackup({ app: BACKUP_APP_ID, schemaVersion: 1 });
    expect(verification.ok).toBe(false);
    expect(verification.errors.some((error) => error.includes('no data section'))).toBe(true);
  });

  it('refuses enormous files before parsing them', () => {
    const huge = 'x'.repeat(25_000_001);
    const result = parseBackupText(huge);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/larger than 25 MB/);
  });
});

describe('partial and dirty data', () => {
  it('keeps valid records and warns about the ones it skipped', () => {
    const payload = {
      app: BACKUP_APP_ID,
      schemaVersion: 1,
      data: {
        entries: [
          { id: 'good', type: 'expense', amount: 100, date: '2026-10-01', categoryId: 'expense_food' },
          { id: 'bad-date', type: 'expense', amount: 100, date: 'not-a-date', categoryId: 'expense_food' },
          { id: 'bad-amount', type: 'expense', amount: 'abc', date: '2026-10-01', categoryId: 'expense_food' },
          { id: 'bad-type', type: 'transfer', amount: 100, date: '2026-10-01', categoryId: 'expense_food' },
          { id: 'negative', type: 'expense', amount: -50, date: '2026-10-01', categoryId: 'expense_food' },
          'not-an-object',
        ],
      },
    };
    const verification = verifyBackup(payload);
    expect(verification.ok).toBe(true);
    expect(verification.counts.entries).toBe(1);
    expect(verification.warnings.length).toBeGreaterThan(0);
    expect(verification.warnings[0]).toMatch(/skipped/);
  });

  it('drops unknown fields rather than storing them', () => {
    const payload = {
      app: BACKUP_APP_ID,
      schemaVersion: 1,
      data: {
        tasks: [{ id: 't1', title: 'Task', extraField: 'should disappear', script: '<script>alert(1)</script>' }],
      },
    };
    const verification = verifyBackup(payload);
    const task = verification.data?.tasks[0] as unknown as Record<string, unknown>;
    expect(task.extraField).toBeUndefined();
    expect(task.script).toBeUndefined();
    expect(task.title).toBe('Task');
  });

  it('strips unsafe URL schemes from links', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('');
    expect(safeUrl('data:text/html,<script>')).toBe('');
    expect(safeUrl('https://example.com/job')).toBe('https://example.com/job');
    expect(safeUrl('')).toBe('');
  });

  it('normalises missing collections to empty arrays', () => {
    const verification = verifyBackup({ app: BACKUP_APP_ID, schemaVersion: 1, data: {} });
    expect(verification.ok).toBe(true);
    expect(verification.data?.entries).toEqual([]);
    expect(verification.data?.tasks).toEqual([]);
    expect(verification.data?.resume).toBeNull();
  });

  it('clamps out-of-range numbers instead of trusting them', () => {
    const payload = {
      app: BACKUP_APP_ID,
      schemaVersion: 1,
      data: {
        budgets: [
          { id: 'b1', categoryId: 'all', period: 'monthly', limit: -100 },
          { id: 'b2', categoryId: 'all', period: 'annual', limit: 5000 },
        ],
        habits: [{ id: 'h1', name: 'Habit', days: [9, 1, 1, -3] }],
      },
    };
    const verification = verifyBackup(payload);
    expect(verification.data?.budgets).toHaveLength(1);
    expect(verification.data?.budgets[0].period).toBe('monthly');
    expect(verification.data?.habits[0].days).toEqual([1]);
  });
});

describe('settings sanitisation', () => {
  it('keeps only supported values and falls back for the rest', () => {
    const settings = sanitizeSettings({
      theme: 'neon',
      currency: 'rupees',
      weekStartsOn: 3,
      monthlyBudgetDefault: 'abc',
      displayName: '  Test  ',
      onboarded: 'yes',
    });
    expect(settings.theme).toBe('system');
    expect(settings.currency).toBe('INR');
    expect(settings.weekStartsOn).toBe(1);
    expect(settings.monthlyBudgetDefault).toBeNull();
    expect(settings.displayName).toBe('Test');
    expect(settings.onboarded).toBe(false);
  });

  it('sanitises notification preferences with sensible fallbacks', () => {
    const prefs = sanitizeNotificationPrefs({
      masterEnabled: true,
      dailyPlannerTime: 5000,
      quietStart: -10,
      backupEveryDays: 5000,
      permissionResult: 'maybe',
    });
    expect(prefs.masterEnabled).toBe(true);
    expect(prefs.dailyPlannerTime).toBe(DEFAULT_NOTIFICATION_PREFS.dailyPlannerTime);
    expect(prefs.quietStart).toBe(DEFAULT_NOTIFICATION_PREFS.quietStart);
    expect(prefs.backupEveryDays).toBe(365);
    expect(prefs.permissionResult).toBeNull();
  });

  it('sanitises a résumé into a known shape', () => {
    const resume = sanitizeResume({
      fullName: 'A'.repeat(500),
      education: [{ qualification: 'B.Com' }, 'nonsense'],
      skills: [{ label: 'Tools', items: 'Excel' }],
    });
    expect(resume.fullName.length).toBeLessThanOrEqual(120);
    expect(resume.education).toHaveLength(1);
    expect(resume.skills[0].items).toBe('Excel');
    expect(resume.id).toBe('resume');
  });
});
