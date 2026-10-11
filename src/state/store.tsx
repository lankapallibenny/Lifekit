/**
 * LIFEKIT application store.
 *
 * One provider holds the loaded data, the settings, the storage health and the toast
 * queue. Every mutation goes through `mutate()`, which writes to IndexedDB first and
 * only then updates React state, so what the screen shows is what is actually stored.
 * A failed write surfaces a toast instead of silently losing the user's input.
 *
 * The provider also owns the reminder loop. Because reminder timing is pure logic
 * (src/lib/notifications.ts), the effect below only wires it to the browser.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_SETTINGS,
  REMOTE_CONTENT_PATHS,
  SAMPLE_ANNOUNCEMENTS,
  APP_VERSION,
} from '../lib/defaults';
import { prefs as prefsStore, storageHealth, type StorageHealth } from '../lib/storage';
import { repo, clearAllData, clearCareerData, clearLearningData, clearMoneyData, clearNotificationData, clearPlannerData, loadAnnouncementRead, markAnnouncementRead } from '../lib/repo';
import { buildBackup, parseBackupText, sanitizeNotificationPrefs, sanitizeSettings, type BackupVerification } from '../lib/backup';
import { createId, cleanText, downloadBlob, fileStamp } from '../lib/shared';
import { todayISO } from '../lib/dates';
import { validateAnnouncementPack } from '../lib/contentPacks';
import {
  buildLogItem,
  deliver,
  dueReminders,
  undelivered,
  type ReminderDescriptor,
} from '../lib/notifications';
import type {
  AppSettings,
  Announcement,
  Checklist,
  Habit,
  HabitLog,
  JobApplication,
  LearningProgress,
  LifeKitData,
  Note,
  NotificationLogItem,
  NotificationPrefs,
  Resume,
  Task,
} from '../lib/models';
import type { Budget, MoneyCategory, MoneyEntry, SavingsGoal } from '../lib/money';
import { useOnline } from '../lib/hooks';

export interface Toast {
  id: string;
  message: string;
  kind: 'info' | 'success' | 'error';
}

const EMPTY_STATE: LifeKitData = {
  entries: [],
  categories: [],
  budgets: [],
  goals: [],
  tasks: [],
  habits: [],
  habitLogs: [],
  notes: [],
  checklists: [],
  learningProgress: [],
  resume: null,
  applications: [],
  settings: DEFAULT_SETTINGS,
  notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
  notificationLog: [],
  announcementsRead: [],
  reports: [],
};

type DataAction =
  | { type: 'replace'; data: LifeKitData }
  | { type: 'patch'; patch: Partial<LifeKitData> }
  | { type: 'upsert'; key: keyof LifeKitData; item: unknown }
  | { type: 'remove'; key: keyof LifeKitData; id: string };

function reducer(state: LifeKitData, action: DataAction): LifeKitData {
  switch (action.type) {
    case 'replace':
      return action.data;
    case 'patch':
      return { ...state, ...action.patch };
    case 'upsert': {
      const list = state[action.key];
      if (!Array.isArray(list)) return state;
      const item = action.item as { id: string };
      const index = list.findIndex((row) => (row as { id: string }).id === item.id);
      const next = index >= 0 ? list.map((row, i) => (i === index ? item : row)) : [item, ...list];
      return { ...state, [action.key]: next } as LifeKitData;
    }
    case 'remove': {
      const list = state[action.key];
      if (!Array.isArray(list)) return state;
      return { ...state, [action.key]: list.filter((row) => (row as { id: string }).id !== action.id) } as LifeKitData;
    }
    default:
      return state;
  }
}

export interface StoreValue {
  ready: boolean;
  loadError: string | null;
  storage: StorageHealth;
  online: boolean;
  data: LifeKitData;
  settings: AppSettings;
  prefs: NotificationPrefs;
  toasts: Toast[];
  announcements: Announcement[];
  /** Where the messages on screen came from, so the UI can label them honestly. */
  announcementSource: 'bundled' | 'published' | 'unavailable';
  /** Reminder descriptors that are due now (for the "upcoming/overdue" panel). */
  pendingReminders: ReminderDescriptor[];
  lastDelivery: { at: string; via: string; title: string } | null;
  notify: (message: string, kind?: Toast['kind']) => void;
  dismissToast: (id: string) => void;
  reload: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  updatePrefs: (patch: Partial<NotificationPrefs>) => Promise<void>;
  /* money */
  saveEntry: (entry: MoneyEntry) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  saveCategory: (category: MoneyCategory) => Promise<void>;
  archiveCategory: (id: string, archived: boolean) => Promise<void>;
  saveBudget: (budget: Budget) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  saveGoal: (goal: SavingsGoal) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  /* planner */
  saveTask: (task: Task) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  saveHabit: (habit: Habit) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  toggleHabit: (habitId: string, date: string) => Promise<void>;
  saveNote: (note: Note) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  saveChecklist: (checklist: Checklist) => Promise<void>;
  deleteChecklist: (id: string) => Promise<void>;
  saveLearningProgress: (progress: LearningProgress) => Promise<void>;
  /* career */
  saveResume: (resume: Resume) => Promise<void>;
  saveApplication: (application: JobApplication) => Promise<void>;
  deleteApplication: (id: string) => Promise<void>;
  /* notifications */
  recordNotification: (item: NotificationLogItem) => Promise<void>;
  clearNotificationLog: () => Promise<void>;
  deleteNotificationLog: (id: string) => Promise<void>;
  markAnnouncementRead: (id: string) => Promise<void>;
  runReminderCheck: (options?: { manual?: boolean }) => Promise<number>;
  /* data management */
  exportBackup: () => Promise<void>;
  readBackupFile: (file: File) => Promise<BackupVerification>;
  applyRestore: (data: LifeKitData) => Promise<void>;
  clearData: (scope: 'money' | 'planner' | 'career' | 'learning' | 'notifications' | 'all') => Promise<void>;
  resetApp: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside <StoreProvider>');
  return value;
}

export function StoreProvider({ children }: { children: ReactNode }): JSX.Element {
  const [data, dispatch] = useReducer(reducer, EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>(SAMPLE_ANNOUNCEMENTS);
  const [announcementSource, setAnnouncementSource] = useState<'bundled' | 'published' | 'unavailable'>('bundled');
  const [pendingReminders, setPendingReminders] = useState<ReminderDescriptor[]>([]);
  const [lastDelivery, setLastDelivery] = useState<{ at: string; via: string; title: string } | null>(null);
  const online = useOnline();
  const storage = useMemo(() => storageHealth(), []);
  const dataRef = useRef(data);
  dataRef.current = data;
  const announcementsRef = useRef(announcements);
  announcementsRef.current = announcements;

  const notify = useCallback((message: string, kind: Toast['kind'] = 'info') => {
    const toast: Toast = { id: createId('toast'), message, kind };
    setToasts((current) => [...current.slice(-2), toast]);
    window.setTimeout(() => setToasts((current) => current.filter((t) => t.id !== toast.id)), kind === 'error' ? 8000 : 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  /* ------------------------------ load ------------------------------ */
  const load = useCallback(async () => {
    try {
      const [
        entries,
        categories,
        budgets,
        goals,
        tasks,
        habits,
        habitLogs,
        notes,
        checklists,
        learningProgress,
        resume,
        applications,
        notificationLog,
        announcementsRead,
        reports,
      ] = await Promise.all([
        repo.listEntries(),
        repo.listCategories(),
        repo.listBudgets(),
        repo.listGoals(),
        repo.listTasks(),
        repo.listHabits(),
        repo.listHabitLogs(),
        repo.listNotes(),
        repo.listChecklists(),
        repo.listLearningProgress(),
        repo.loadResume(),
        repo.listApplications(),
        repo.listNotificationLog(),
        loadAnnouncementRead(),
        Promise.resolve([] as LifeKitData['reports']),
      ]);

      const storedSettings = sanitizeSettings(prefsStore.get<Record<string, unknown>>('settings', {}), DEFAULT_SETTINGS);
      const storedPrefs = sanitizeNotificationPrefs(
        prefsStore.get<Record<string, unknown>>('notification_prefs', {}),
        DEFAULT_NOTIFICATION_PREFS
      );

      // Seed bundled categories on first run only; never overwrite the user's own set.
      let resolvedCategories = categories;
      if (categories.length === 0) {
        resolvedCategories = DEFAULT_CATEGORIES;
        await repo.saveCategories(DEFAULT_CATEGORIES);
      }

      dispatch({
        type: 'replace',
        data: {
          entries,
          categories: resolvedCategories,
          budgets,
          goals,
          tasks,
          habits,
          habitLogs,
          notes,
          checklists,
          learningProgress,
          resume: resume ?? null,
          applications,
          settings: storedSettings,
          notificationPrefs: storedPrefs,
          notificationLog: notificationLog.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 200),
          announcementsRead: Object.entries(announcementsRead).map(([id, readAt]) => ({ id, readAt })),
          reports,
        },
      });
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? `LIFEKIT could not read its local storage: ${error.message}`
          : 'LIFEKIT could not read its local storage.'
      );
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* --------------------- theme + accessibility wiring --------------------- */
  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    const apply = () => {
      const chosen = data.settings.theme;
      const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
      const theme = chosen === 'system' ? (systemDark ? 'dark' : 'light') : chosen;
      root.setAttribute('data-theme', theme);
      root.style.colorScheme = theme;
    };
    apply();
    root.setAttribute('data-reduce-motion', String(data.settings.reduceMotion));
    root.setAttribute('data-large-text', String(data.settings.largeText));
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    media?.addEventListener?.('change', apply);
    return () => media?.removeEventListener?.('change', apply);
  }, [data.settings.theme, data.settings.reduceMotion, data.settings.largeText, ready]);

  useEffect(() => {
    document.documentElement.lang = data.settings.language || 'en';
  }, [data.settings.language]);

  /* ------------------------------ mutations ------------------------------ */

  const mutate = useCallback(
    async (work: () => Promise<void>, successMessage?: string) => {
      try {
        await work();
        if (successMessage) notify(successMessage, 'success');
      } catch (error) {
        notify(
          error instanceof Error ? `Could not save: ${error.message}` : 'Could not save to this device’s storage.',
          'error'
        );
      }
    },
    [notify]
  );

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      const next = sanitizeSettings({ ...dataRef.current.settings, ...patch }, dataRef.current.settings);
      const ok = prefsStore.set('settings', next);
      dispatch({ type: 'patch', patch: { settings: next } });
      if (!ok) notify('Settings changed for this session, but could not be saved to this device.', 'error');
    },
    [notify]
  );

  const updatePrefs = useCallback(
    async (patch: Partial<NotificationPrefs>) => {
      const next = sanitizeNotificationPrefs({ ...dataRef.current.notificationPrefs, ...patch }, dataRef.current.notificationPrefs);
      const ok = prefsStore.set('notification_prefs', next);
      dispatch({ type: 'patch', patch: { notificationPrefs: next } });
      if (!ok) notify('Notification settings changed for this session, but could not be saved.', 'error');
    },
    [notify]
  );

  const saveEntry = useCallback(
    (entry: MoneyEntry) => mutate(() => repo.saveEntry(entry).then(() => undefined)).then(() => dispatch({ type: 'upsert', key: 'entries', item: entry })),
    [mutate]
  );
  const deleteEntry = useCallback(
    (id: string) => mutate(() => repo.deleteEntry(id)).then(() => dispatch({ type: 'remove', key: 'entries', id })),
    [mutate]
  );
  const saveCategory = useCallback(
    (category: MoneyCategory) =>
      mutate(() => repo.saveCategory(category).then(() => undefined)).then(() => dispatch({ type: 'upsert', key: 'categories', item: category })),
    [mutate]
  );
  const archiveCategory = useCallback(
    (id: string, archived: boolean) =>
      mutate(async () => {
        const category = dataRef.current.categories.find((c) => c.id === id);
        if (!category) return;
        const next = { ...category, archived };
        await repo.saveCategory(next);
        dispatch({ type: 'upsert', key: 'categories', item: next });
      }),
    [mutate]
  );
  const saveBudget = useCallback(
    (budget: Budget) => mutate(() => repo.saveBudget(budget).then(() => undefined)).then(() => dispatch({ type: 'upsert', key: 'budgets', item: budget })),
    [mutate]
  );
  const deleteBudget = useCallback(
    (id: string) => mutate(() => repo.deleteBudget(id)).then(() => dispatch({ type: 'remove', key: 'budgets', id })),
    [mutate]
  );
  const saveGoal = useCallback(
    (goal: SavingsGoal) => mutate(() => repo.saveGoal(goal).then(() => undefined)).then(() => dispatch({ type: 'upsert', key: 'goals', item: goal })),
    [mutate]
  );
  const deleteGoal = useCallback(
    (id: string) => mutate(() => repo.deleteGoal(id)).then(() => dispatch({ type: 'remove', key: 'goals', id })),
    [mutate]
  );
  const saveTask = useCallback(
    (task: Task) => mutate(() => repo.saveTask(task).then(() => undefined)).then(() => dispatch({ type: 'upsert', key: 'tasks', item: task })),
    [mutate]
  );
  const deleteTask = useCallback(
    (id: string) => mutate(() => repo.deleteTask(id)).then(() => dispatch({ type: 'remove', key: 'tasks', id })),
    [mutate]
  );
  const saveHabit = useCallback(
    (habit: Habit) => mutate(() => repo.saveHabit(habit).then(() => undefined)).then(() => dispatch({ type: 'upsert', key: 'habits', item: habit })),
    [mutate]
  );
  const deleteHabit = useCallback(
    (id: string) =>
      mutate(async () => {
        await repo.deleteHabit(id);
        const logs = dataRef.current.habitLogs.filter((l) => l.habitId === id);
        for (const log of logs) await repo.deleteHabitLog(log.id);
        dispatch({ type: 'remove', key: 'habits', id });
        dispatch({ type: 'patch', patch: { habitLogs: dataRef.current.habitLogs.filter((l) => l.habitId !== id) } });
      }),
    [mutate]
  );
  const toggleHabit = useCallback(
    (habitId: string, date: string) =>
      mutate(async () => {
        const id = `${habitId}:${date}`;
        const existing = dataRef.current.habitLogs.find((l) => l.id === id);
        const next: HabitLog = existing
          ? { ...existing, done: !existing.done }
          : { id, habitId, date, done: true };
        await repo.saveHabitLog(next);
        dispatch({ type: 'upsert', key: 'habitLogs', item: next });
      }),
    [mutate]
  );
  const saveNote = useCallback(
    (note: Note) => mutate(() => repo.saveNote(note).then(() => undefined)).then(() => dispatch({ type: 'upsert', key: 'notes', item: note })),
    [mutate]
  );
  const deleteNote = useCallback(
    (id: string) => mutate(() => repo.deleteNote(id)).then(() => dispatch({ type: 'remove', key: 'notes', id })),
    [mutate]
  );
  const saveChecklist = useCallback(
    (checklist: Checklist) =>
      mutate(() => repo.saveChecklist(checklist).then(() => undefined)).then(() => dispatch({ type: 'upsert', key: 'checklists', item: checklist })),
    [mutate]
  );
  const deleteChecklist = useCallback(
    (id: string) => mutate(() => repo.deleteChecklist(id)).then(() => dispatch({ type: 'remove', key: 'checklists', id })),
    [mutate]
  );
  const saveLearningProgressCb = useCallback(
    (progress: LearningProgress) =>
      mutate(() => repo.saveLearningProgress(progress).then(() => undefined)).then(() =>
        dispatch({ type: 'upsert', key: 'learningProgress', item: progress })
      ),
    [mutate]
  );
  const saveResume = useCallback(
    (resume: Resume) =>
      mutate(async () => {
        await repo.saveResume(resume);
        dispatch({ type: 'patch', patch: { resume } });
      }),
    [mutate]
  );
  const saveApplication = useCallback(
    (application: JobApplication) =>
      mutate(() => repo.saveApplication(application).then(() => undefined)).then(() =>
        dispatch({ type: 'upsert', key: 'applications', item: application })
      ),
    [mutate]
  );
  const deleteApplication = useCallback(
    (id: string) => mutate(() => repo.deleteApplication(id)).then(() => dispatch({ type: 'remove', key: 'applications', id })),
    [mutate]
  );

  const recordNotification = useCallback(
    async (item: NotificationLogItem) => {
      try {
        await repo.saveNotificationLog(item);
        dispatch({ type: 'upsert', key: 'notificationLog', item });
      } catch {
        dispatch({ type: 'upsert', key: 'notificationLog', item });
      }
    },
    []
  );

  const clearNotificationLog = useCallback(
    () =>
      mutate(async () => {
        await repo.clearNotificationLog();
        dispatch({ type: 'patch', patch: { notificationLog: [] } });
      }, 'Notification history cleared.'),
    [mutate]
  );

  const deleteNotificationLogItem = useCallback(
    (id: string) => mutate(() => repo.deleteNotificationLog(id)).then(() => dispatch({ type: 'remove', key: 'notificationLog', id })),
    [mutate]
  );

  const markAnnouncementReadCb = useCallback(
    async (id: string) => {
      const readAt = new Date().toISOString();
      try {
        await markAnnouncementRead(id, readAt);
      } catch {
        /* the read flag is non-critical */
      }
      dispatch({ type: 'patch', patch: { announcementsRead: [...dataRef.current.announcementsRead.filter((a) => a.id !== id), { id, readAt }] } });
    },
    []
  );

  /* ------------------------------ reminders ------------------------------ */

  const runReminderCheck = useCallback(
    async (options: { manual?: boolean } = {}): Promise<number> => {
      const current = dataRef.current;
      const now = new Date();
      const today = todayISO(now);
      const loggedToday = new Set(current.habitLogs.filter((l) => l.date === today && l.done).map((l) => l.habitId));
      const descriptors = dueReminders({
        tasks: current.tasks,
        announcements: announcementsRef.current,
        habitNames: current.habits.filter((h) => !h.archived),
        habitLoggedToday: loggedToday,
        pref: current.notificationPrefs,
        settings: { lastBackupAt: current.settings.lastBackupAt, reminderCheckEnabled: current.settings.reminderCheckEnabled },
        now,
      });
      setPendingReminders(descriptors);

      if (!current.notificationPrefs.masterEnabled && !options.manual) return 0;
      const fresh = undelivered(descriptors, current.notificationLog);
      if (fresh.length === 0) return 0;

      let delivered = 0;
      for (const descriptor of fresh) {
        const outcome = await deliver(descriptor, current.notificationPrefs, now);
        const item = buildLogItem(descriptor, now);
        if (outcome.via === 'suppressed') {
          item.body = `${item.body} (held for quiet hours)`;
        }
        await recordNotification(item);
        if (outcome.delivered && outcome.via !== 'suppressed') delivered++;
        setLastDelivery({ at: item.at, via: outcome.via, title: item.title });
      }
      return delivered;
    },
    [recordNotification]
  );

  // Reminder loop: check on load and then once a minute while the app is open.
  useEffect(() => {
    if (!ready) return;
    void runReminderCheck();
    const id = window.setInterval(() => void runReminderCheck(), 60_000);
    return () => window.clearInterval(id);
    // Intentionally re-runs when the source data changes so new tasks are picked up quickly.
  }, [
    ready,
    runReminderCheck,
    data.tasks,
    data.habits,
    data.habitLogs,
    data.notificationPrefs,
    data.settings.lastBackupAt,
    data.settings.reminderCheckEnabled,
  ]);

  /* ------------------------------ backups ------------------------------ */

  const exportBackup = useCallback(async () => {
    const payload = buildBackup(dataRef.current, APP_VERSION);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    downloadBlob(`lifekit-backup-${fileStamp()}.json`, blob);
    await updateSettings({ lastBackupAt: new Date().toISOString() });
    notify('Backup file created. Keep it somewhere safe — it contains your records.', 'success');
  }, [notify, updateSettings]);

  const readBackupFile = useCallback(async (file: File): Promise<BackupVerification> => {
    if (file.size > 25_000_000) {
      return { ok: false, errors: ['That file is larger than 25 MB, which is not a LIFEKIT backup.'], warnings: [], counts: {}, data: null, exportedAt: null, appVersion: null };
    }
    const text = await file.text();
    return parseBackupText(text);
  }, []);

  const applyRestore = useCallback(
    async (incoming: LifeKitData) => {
      await mutate(async () => {
        // Replace rather than merge: a restore should reproduce the backup exactly.
        await clearAllData();
        await repo.saveCategories(incoming.categories.length > 0 ? incoming.categories : DEFAULT_CATEGORIES);
        await repo.saveEntries(incoming.entries);
        for (const budget of incoming.budgets) await repo.saveBudget(budget);
        for (const goal of incoming.goals) await repo.saveGoal(goal);
        await repo.saveTasks(incoming.tasks);
        for (const habit of incoming.habits) await repo.saveHabit(habit);
        for (const log of incoming.habitLogs) await repo.saveHabitLog(log);
        for (const note of incoming.notes) await repo.saveNote(note);
        for (const list of incoming.checklists) await repo.saveChecklist(list);
        for (const progress of incoming.learningProgress) await repo.saveLearningProgress(progress);
        if (incoming.resume) await repo.saveResume(incoming.resume);
        for (const application of incoming.applications) await repo.saveApplication(application);
        prefsStore.set('settings', incoming.settings);
        prefsStore.set('notification_prefs', incoming.notificationPrefs);
        dispatch({ type: 'replace', data: { ...incoming, settings: incoming.settings, notificationPrefs: incoming.notificationPrefs } });
      }, 'Backup restored.');
      await load();
    },
    [load, mutate]
  );

  const clearData = useCallback(
    async (scope: 'money' | 'planner' | 'career' | 'learning' | 'notifications' | 'all') => {
      await mutate(async () => {
        if (scope === 'money') await clearMoneyData();
        if (scope === 'planner') await clearPlannerData();
        if (scope === 'career') await clearCareerData();
        if (scope === 'learning') await clearLearningData();
        if (scope === 'notifications') await clearNotificationData();
        if (scope === 'all') await clearAllData();
        await load();
      }, scope === 'all' ? 'All LIFEKIT records cleared from this device.' : 'Selected data cleared.');
    },
    [load, mutate]
  );

  const resetApp = useCallback(async () => {
    await mutate(async () => {
      await clearAllData();
      prefsStore.remove('settings');
      prefsStore.remove('notification_prefs');
      const keys = prefsStore.keys();
      for (const key of keys) prefsStore.remove(key);
      dispatch({ type: 'replace', data: EMPTY_STATE });
      await repo.saveCategories(DEFAULT_CATEGORIES);
      await load();
    }, 'LIFEKIT was reset to its initial state.');
  }, [load, mutate]);

  /* ------------------------------ announcements ------------------------------ */

  useEffect(() => {
    const readMap = new Map(data.announcementsRead.map((r) => [r.id, r.readAt]));
    setAnnouncements((current) =>
      current
        .map((a) => ({ ...a, readAt: readMap.get(a.id) ?? null }))
        .filter((a) => !a.expiresAt || a.expiresAt >= todayISO())
    );
  }, [data.announcementsRead]);

  /**
   * Optional published feed.
   *
   * This is the only network request the main app can make, it is off by default, and it runs
   * only after the user enables it in Settings. When the fetch fails the bundled examples stay
   * in place and the source is reported as unavailable, so the screen never goes blank and
   * never silently implies that something was published when it was not.
   */
  useEffect(() => {
    if (!data.settings.remoteAnnouncementsEnabled) {
      setAnnouncementSource('bundled');
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    fetch(REMOTE_CONTENT_PATHS.announcements, { headers: { Accept: 'application/json' }, signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((json) => {
        if (cancelled) return;
        const { items, rejected } = validateAnnouncementPack(json);
        if (items.length === 0) {
          // Nothing usable: keep the bundled examples rather than showing an empty feed that
          // looks like "no messages exist".
          setAnnouncementSource(rejected > 0 ? 'unavailable' : 'bundled');
          return;
        }
        setAnnouncements(items);
        setAnnouncementSource('published');
      })
      .catch(() => {
        if (!cancelled) setAnnouncementSource('unavailable');
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [data.settings.remoteAnnouncementsEnabled]);

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      loadError,
      storage,
      online,
      data,
      settings: data.settings,
      prefs: data.notificationPrefs,
      toasts,
      announcements,
      announcementSource,
      pendingReminders,
      lastDelivery,
      notify,
      dismissToast,
      reload: load,
      updateSettings,
      updatePrefs,
      saveEntry,
      deleteEntry,
      saveCategory,
      archiveCategory,
      saveBudget,
      deleteBudget,
      saveGoal,
      deleteGoal,
      saveTask,
      deleteTask,
      saveHabit,
      deleteHabit,
      toggleHabit,
      saveNote,
      deleteNote,
      saveChecklist,
      deleteChecklist,
      saveLearningProgress: saveLearningProgressCb,
      saveResume,
      saveApplication,
      deleteApplication,
      recordNotification,
      clearNotificationLog,
      deleteNotificationLog: deleteNotificationLogItem,
      markAnnouncementRead: markAnnouncementReadCb,
      runReminderCheck,
      exportBackup,
      readBackupFile,
      applyRestore,
      clearData,
      resetApp,
    }),
    [
      ready,
      loadError,
      storage,
      online,
      data,
      toasts,
      announcements,
      announcementSource,
      pendingReminders,
      lastDelivery,
      notify,
      dismissToast,
      load,
      updateSettings,
      updatePrefs,
      saveEntry,
      deleteEntry,
      saveCategory,
      archiveCategory,
      saveBudget,
      deleteBudget,
      saveGoal,
      deleteGoal,
      saveTask,
      deleteTask,
      saveHabit,
      deleteHabit,
      toggleHabit,
      saveNote,
      deleteNote,
      saveChecklist,
      deleteChecklist,
      saveLearningProgressCb,
      saveResume,
      saveApplication,
      deleteApplication,
      recordNotification,
      clearNotificationLog,
      deleteNotificationLogItem,
      markAnnouncementReadCb,
      runReminderCheck,
      exportBackup,
      readBackupFile,
      applyRestore,
      clearData,
      resetApp,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

/** Helper used by forms when a text field needs the same trimming rules everywhere. */
export const text = cleanText;
