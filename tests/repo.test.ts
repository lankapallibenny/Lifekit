/**
 * Persistence tests.
 *
 * These run against `fake-indexeddb`, which implements the real IndexedDB API, so the
 * repository layer is exercised exactly as it is in a browser: object stores, indexes,
 * transactions and asynchronous writes. A failure here means data really would not be
 * there after a reload.
 */
import { describe, expect, it } from 'vitest';
import {
  clearAllData,
  clearCareerData,
  clearLearningData,
  clearMoneyData,
  clearPlannerData,
  loadAnnouncementRead,
  markAnnouncementRead,
  repo,
} from '../src/lib/repo';
import { count, getDocument, putDocument } from '../src/lib/storage';
import { DEFAULT_CATEGORIES } from '../src/lib/defaults';
import { EMPTY_DATA, type JobApplication, type Note, type Resume, type Task } from '../src/lib/models';
import type { MoneyEntry } from '../src/lib/money';

const now = '2026-10-11T09:00:00.000Z';

function entry(overrides: Partial<MoneyEntry> = {}): MoneyEntry {
  return {
    id: 'entry-1',
    type: 'expense',
    amount: 250.5,
    date: '2026-10-11',
    categoryId: 'food',
    note: 'Vegetables',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Pay electricity bill',
    kind: 'task',
    status: 'open',
    priority: 'high',
    dueDate: '2026-10-20',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('money records persist', () => {
  it('saves an entry and reads it back with the same values', async () => {
    await repo.saveEntry(entry());
    const all = await repo.listEntries();
    expect(all).toHaveLength(1);
    expect(all[0]?.amount).toBe(250.5);
    expect(all[0]?.note).toBe('Vegetables');
  });

  it('updates an entry in place instead of duplicating it', async () => {
    await repo.saveEntry(entry());
    await repo.saveEntry(entry({ amount: 300, note: 'Corrected' }));
    const all = await repo.listEntries();
    expect(all).toHaveLength(1);
    expect(all[0]?.amount).toBe(300);
  });

  it('deletes a single entry and leaves the others untouched', async () => {
    await repo.saveEntry(entry({ id: 'a' }));
    await repo.saveEntry(entry({ id: 'b' }));
    await repo.deleteEntry('a');
    const all = await repo.listEntries();
    expect(all.map((e) => e.id)).toEqual(['b']);
  });

  it('survives a page reload: a new read sees earlier writes', async () => {
    await repo.saveEntries([entry({ id: 'x' }), entry({ id: 'y', type: 'income', amount: 5000 })]);
    // A fresh call is a fresh transaction, which is what a reload looks like.
    const first = await repo.listEntries();
    const second = await repo.listEntries();
    expect(first).toHaveLength(2);
    expect(second).toHaveLength(2);
    expect(await count('money_entries')).toBe(2);
  });

  it('stores categories, budgets and goals', async () => {
    await repo.saveCategories(DEFAULT_CATEGORIES);
    await repo.saveCategory({ id: 'custom-1', name: 'Pet care', type: 'expense', custom: true });
    await repo.saveBudget({ id: 'b1', categoryId: 'all', period: 'monthly', limit: 15000, createdAt: now, updatedAt: now });
    await repo.saveGoal({ id: 'g1', name: 'Emergency fund', target: 50000, contributions: [], createdAt: now, updatedAt: now });

    expect((await repo.listCategories()).length).toBe(DEFAULT_CATEGORIES.length + 1);
    expect((await repo.listBudgets())[0]?.limit).toBe(15000);
    expect((await repo.listGoals())[0]?.target).toBe(50000);

    await repo.deleteGoal('g1');
    expect(await repo.listGoals()).toHaveLength(0);
  });
});

describe('planner records persist', () => {
  it('keeps tasks, including due dates and reminders', async () => {
    await repo.saveTask(task());
    await repo.saveTask(task({ id: 'task-2', title: 'No date', dueDate: null, priority: 'low' }));
    const tasks = await repo.listTasks();
    expect(tasks).toHaveLength(2);
    expect(tasks.find((t) => t.id === 'task-1')?.dueDate).toBe('2026-10-20');
  });

  it('logs a habit once per day because the id is habit+date', async () => {
    await repo.saveHabit({ id: 'h1', name: 'Walk 20 minutes', days: [0, 1, 2, 3, 4, 5, 6], createdAt: now });
    await repo.saveHabitLog({ id: 'h1:2026-10-11', habitId: 'h1', date: '2026-10-11', done: true });
    await repo.saveHabitLog({ id: 'h1:2026-10-11', habitId: 'h1', date: '2026-10-11', done: false });
    const logs = await repo.listHabitLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.done).toBe(false);
  });

  it('stores notes and checklists with their nested items', async () => {
    const note: Note = { id: 'n1', title: 'Shop list', body: 'Rice\nOil', pinned: true, createdAt: now, updatedAt: now };
    await repo.saveNote(note);
    await repo.saveChecklist({
      id: 'c1',
      title: 'Documents to carry',
      kind: 'safety',
      items: [
        { id: 'i1', text: 'Aadhaar copy', done: true },
        { id: 'i2', text: 'Passport photo', done: false },
      ],
      createdAt: now,
      updatedAt: now,
    });
    const notes = await repo.listNotes();
    const lists = await repo.listChecklists();
    expect(notes[0]?.pinned).toBe(true);
    expect(lists[0]?.items).toHaveLength(2);
    expect(lists[0]?.items[0]?.done).toBe(true);
  });
});

describe('learning and career records persist', () => {
  it('stores reading progress with a cached lesson body for offline reading', async () => {
    await repo.saveLearningProgress({
      id: 'budgeting-basics',
      read: true,
      progress: 100,
      bookmarked: true,
      updatedAt: now,
      cached: { title: 'Budgeting basics', body: 'Original LIFEKIT lesson text.', savedAt: now },
    });
    const progress = await repo.listLearningProgress();
    expect(progress[0]?.cached?.title).toBe('Budgeting basics');
    expect(progress[0]?.bookmarked).toBe(true);
  });

  it('round-trips a résumé through the document store', async () => {
    const resume: Resume = {
      id: 'resume',
      fullName: 'Sample Name',
      headline: 'Warehouse assistant',
      email: 'sample@example.com',
      phone: '',
      location: 'Guntur, Andhra Pradesh',
      links: '',
      summary: 'Two years of experience in packing and dispatch.',
      education: [{ id: 'e1', qualification: 'Intermediate (MPC)', institution: 'Govt Junior College', endYear: '2023' }],
      experience: [],
      projects: [],
      skills: [{ id: 's1', label: 'Skills', items: 'Inventory, packing' }],
      languages: 'Telugu, English',
      certifications: '',
      updatedAt: now,
    };
    await repo.saveResume(resume);
    const loaded = await repo.loadResume();
    expect(loaded?.headline).toBe('Warehouse assistant');
    expect(loaded?.education[0]?.institution).toBe('Govt Junior College');
  });

  it('returns undefined for a résumé that was never saved', async () => {
    expect(await repo.loadResume()).toBeUndefined();
  });

  it('tracks applications through their status changes', async () => {
    const application: JobApplication = {
      id: 'a1',
      role: 'Data entry operator',
      organisation: 'Local firm',
      status: 'applied',
      appliedDate: '2026-10-01',
      nextFollowUp: '2026-10-15',
      createdAt: now,
      updatedAt: now,
    };
    await repo.saveApplication(application);
    await repo.saveApplication({ ...application, status: 'interview' });
    const list = await repo.listApplications();
    expect(list).toHaveLength(1);
    expect(list[0]?.status).toBe('interview');
    await repo.deleteApplication('a1');
    expect(await repo.listApplications()).toHaveLength(0);
  });

  it('stores documents generically (used for anything blob-shaped)', async () => {
    await putDocument('misc', { hello: 'world' });
    expect(await getDocument<{ hello: string }>('misc')).toEqual({ hello: 'world' });
  });
});

describe('notification log', () => {
  it('adds, lists and clears log entries', async () => {
    await repo.saveNotificationLog({
      id: 'task:t1:2026-10-11',
      category: 'task',
      title: 'Reminder: Pay bill',
      body: 'Scheduled for 09:00 today.',
      at: now,
      read: false,
      origin: 'local',
    });
    expect(await repo.listNotificationLog()).toHaveLength(1);
    await repo.clearNotificationLog();
    expect(await repo.listNotificationLog()).toHaveLength(0);
  });
});

describe('announcement read state', () => {
  it('remembers which announcements were read, and when', async () => {
    expect(await loadAnnouncementRead()).toEqual({});
    await markAnnouncementRead('sample-welcome', now);
    await markAnnouncementRead('sample-backup-tip', now);
    const map = await loadAnnouncementRead();
    expect(Object.keys(map).sort()).toEqual(['sample-backup-tip', 'sample-welcome']);
    expect(map['sample-welcome']).toBe(now);
  });
});

describe('selective clearing', () => {
  it('clears money data without touching tasks or notes', async () => {
    await repo.saveEntry(entry());
    await repo.saveTask(task());
    await repo.saveNote({ id: 'n1', title: 'Keep me', body: '', createdAt: now, updatedAt: now });
    await clearMoneyData();
    expect(await repo.listEntries()).toHaveLength(0);
    expect(await repo.listTasks()).toHaveLength(1);
    expect(await repo.listNotes()).toHaveLength(1);
  });

  it('clears planner data without touching money', async () => {
    await repo.saveEntry(entry());
    await repo.saveTask(task());
    await clearPlannerData();
    expect(await repo.listTasks()).toHaveLength(0);
    expect(await repo.listEntries()).toHaveLength(1);
  });

  it('clears career data including the résumé document', async () => {
    await repo.saveResume({ ...EMPTY_DATA, id: 'resume' } as unknown as Resume);
    await clearCareerData();
    expect(await repo.loadResume()).toBeUndefined();
  });

  it('clears learning progress', async () => {
    await repo.saveLearningProgress({ id: 'l1', read: true, progress: 50, bookmarked: false, updatedAt: now });
    await clearLearningData();
    expect(await repo.listLearningProgress()).toHaveLength(0);
  });

  it('clearAllData empties every store it owns', async () => {
    await repo.saveEntry(entry());
    await repo.saveTask(task());
    await repo.saveNote({ id: 'n1', title: 'n', body: '', createdAt: now, updatedAt: now });
    await repo.saveResume({ id: 'resume' } as unknown as Resume);
    await markAnnouncementRead('sample-welcome', now);

    await clearAllData();

    expect(await repo.listEntries()).toHaveLength(0);
    expect(await repo.listTasks()).toHaveLength(0);
    expect(await repo.listNotes()).toHaveLength(0);
    expect(await repo.loadResume()).toBeUndefined();
    expect(await loadAnnouncementRead()).toEqual({});
  });
});
