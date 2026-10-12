/**
 * LIFEKIT backup / restore.
 *
 * A backup is a single JSON file the user owns and controls. Import is treated as
 * untrusted input: the envelope is checked, every record is re-validated field by
 * field, prototype-polluting keys are rejected, unknown fields are dropped, and
 * anything that fails validation is dropped *with a warning* rather than imported
 * blindly. The function never throws on bad data — it returns a structured result
 * so the UI can explain exactly what happened.
 */
import {
  parseAmount,
  type Budget,
  type MoneyCategory,
  type MoneyEntry,
  type SavingsGoal,
  type GoalContribution,
  type EntryType,
  type RecurrenceFrequency,
} from './money';
import {
  EMPTY_DATA,
  type AppSettings,
  type ApplicationStatus,
  type Checklist,
  type ChecklistItem,
  type DirectoryReport,
  type Habit,
  type HabitLog,
  type JobApplication,
  type LearningProgress,
  type LifeKitData,
  type Note,
  type NotificationLogItem,
  type NotificationPrefs,
  type Resume,
  type Task,
} from './models';
import { cleanMultiline, cleanText, hasUnsafeKeys, isValidISODateFallback } from './shared';

export const BACKUP_APP_ID = 'LIFEKIT';
export const BACKUP_SCHEMA_VERSION = 1;
const MAX_RECORDS_PER_COLLECTION = 50_000;

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  privacy: string;
  data: LifeKitData;
}

export function buildBackup(data: LifeKitData, appVersion: string, exportedAt = new Date().toISOString()): BackupFile {
  return {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    appVersion,
    privacy:
      'This file contains your personal LIFEKIT records. It was created entirely on your device and has not been uploaded anywhere.',
    data: {
      ...data,
      // The log can grow; keep the file reasonable while preserving recent history.
      notificationLog: [...data.notificationLog].slice(-200),
    },
  };
}

export interface ImportResult<T> {
  value: T | null;
  errors: string[];
  warnings: string[];
}

export interface BackupVerification {
  ok: boolean;
  errors: string[];
  warnings: string[];
  /** Counts shown to the user before they confirm the restore. */
  counts: Record<string, number>;
  data: LifeKitData | null;
  exportedAt: string | null;
  appVersion: string | null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown, max = 300): string {
  return cleanText(value, max);
}

function multi(value: unknown, max = 4000): string {
  return cleanMultiline(value, max);
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function idOf(value: unknown): string | null {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!id || id.length > 200 || /[<>\u0000-\u001F]/.test(id)) return null;
  return id || null;
}

/**
 * Verify a parsed backup object. Returns the sanitised data set plus warnings for any
 * record that had to be dropped, so the user is never told a restore was "complete"
 * when part of it was rejected.
 */
export function verifyBackup(raw: unknown): BackupVerification {
  const errors: string[] = [];
  const warnings: string[] = [];
  const counts: Record<string, number> = {};

  if (!isPlainObject(raw)) {
    return { ok: false, errors: ['The file is not a LIFEKIT backup (expected a JSON object).'], warnings, counts, data: null, exportedAt: null, appVersion: null };
  }
  if (raw.app !== BACKUP_APP_ID) {
    return {
      ok: false,
      errors: [`This file is not a LIFEKIT backup (found app identifier "${str(raw.app, 40) || 'none'}").`],
      warnings,
      counts,
      data: null,
      exportedAt: null,
      appVersion: null,
    };
  }
  if (hasUnsafeKeys(raw)) {
    return { ok: false, errors: ['The file contains unsafe object keys and was rejected for safety.'], warnings, counts, data: null, exportedAt: null, appVersion: null };
  }
  const schemaVersion = num(raw.schemaVersion, 0);
  if (schemaVersion < 1 || schemaVersion > BACKUP_SCHEMA_VERSION) {
    errors.push(
      `Backup schema version ${schemaVersion || 'unknown'} is not supported by this build (supported: 1–${BACKUP_SCHEMA_VERSION}).`
    );
  }
  if (!isPlainObject(raw.data)) {
    errors.push('The backup has no data section.');
  }
  if (errors.length > 0) {
    return { ok: false, errors, warnings, counts, data: null, exportedAt: null, appVersion: null };
  }

  const source = raw.data as Record<string, unknown>;
  const data: LifeKitData = { ...EMPTY_DATA };

  const tooMany = (name: string, list: unknown[]): boolean => {
    if (list.length > MAX_RECORDS_PER_COLLECTION) {
      warnings.push(`${name}: only the first ${MAX_RECORDS_PER_COLLECTION} records were imported.`);
      return true;
    }
    return false;
  };
  const capped = (list: unknown[]): unknown[] =>
    list.length > MAX_RECORDS_PER_COLLECTION ? list.slice(0, MAX_RECORDS_PER_COLLECTION) : list;

  /* ---------- money ---------- */
  const entries: MoneyEntry[] = [];
  for (const item of capped(asArray(source.entries))) {
    if (!isPlainObject(item)) {
      warnings.push('entries: skipped a record that was not an object.');
      continue;
    }
    const id = idOf(item.id) ?? `mny_${entries.length}`;
    const type: EntryType | null = item.type === 'income' ? 'income' : item.type === 'expense' ? 'expense' : null;
    const amount = parseAmount(typeof item.amount === 'number' ? item.amount : String(item.amount ?? ''));
    if (!type || amount === null || amount <= 0 || !isValidISODateFallback(item.date)) {
      warnings.push(`entries: skipped ${id} (invalid type, amount or date).`);
      continue;
    }
    const freq = (item.recurrence as { frequency?: unknown } | undefined)?.frequency;
    const recurrence =
      freq === 'weekly' || freq === 'monthly' || freq === 'yearly'
        ? { frequency: freq as RecurrenceFrequency, until: isValidISODateFallback((item.recurrence as { until?: unknown })?.until) ? String((item.recurrence as { until: string }).until) : null }
        : undefined;
    entries.push({
      id,
      type,
      amount,
      date: item.date as string,
      categoryId: str(item.categoryId, 80) || (type === 'income' ? 'income_other' : 'expense_other'),
      note: str(item.note, 300),
      createdAt: str(item.createdAt, 40) || new Date().toISOString(),
      updatedAt: str(item.updatedAt, 40) || new Date().toISOString(),
      ...(recurrence ? { recurrence } : {}),
      ...(typeof item.goalId === 'string' ? { goalId: str(item.goalId, 80) } : {}),
    });
  }
  data.entries = entries;
  counts.entries = entries.length;
  tooMany('entries', asArray(source.entries));

  const categories: MoneyCategory[] = [];
  for (const item of capped(asArray(source.categories))) {
    if (!isPlainObject(item)) continue;
    const name = str(item.name, 40);
    if (!name) {
      warnings.push('categories: skipped an entry with no name.');
      continue;
    }
    categories.push({
      id: idOf(item.id) ?? `cat_${categories.length}`,
      name,
      type: item.type === 'income' ? 'income' : 'expense',
      custom: bool(item.custom, true),
      archived: bool(item.archived, false),
    });
  }
  data.categories = categories;
  counts.categories = categories.length;

  const budgets: Budget[] = [];
  for (const item of capped(asArray(source.budgets))) {
    if (!isPlainObject(item)) continue;
    const limit = parseAmount(typeof item.limit === 'number' ? item.limit : String(item.limit ?? ''));
    if (limit === null || limit <= 0) {
      warnings.push('budgets: skipped a budget with an invalid limit.');
      continue;
    }
    budgets.push({
      id: idOf(item.id) ?? `bud_${budgets.length}`,
      categoryId: str(item.categoryId, 80) || 'all',
      period: item.period === 'weekly' ? 'weekly' : 'monthly',
      limit,
      createdAt: str(item.createdAt, 40) || new Date().toISOString(),
      updatedAt: str(item.updatedAt, 40) || new Date().toISOString(),
    });
  }
  data.budgets = budgets;
  counts.budgets = budgets.length;

  const goals: SavingsGoal[] = [];
  for (const item of capped(asArray(source.goals))) {
    if (!isPlainObject(item)) continue;
    const target = parseAmount(typeof item.target === 'number' ? item.target : String(item.target ?? ''));
    if (target === null || target <= 0) {
      warnings.push('goals: skipped a goal with an invalid target amount.');
      continue;
    }
    const contributions: GoalContribution[] = [];
    for (const c of capped(asArray(item.contributions))) {
      if (!isPlainObject(c)) continue;
      const amount = parseAmount(typeof c.amount === 'number' ? c.amount : String(c.amount ?? ''));
      if (amount === null || amount < 0 || !isValidISODateFallback(c.date)) continue;
      contributions.push({
        id: idOf(c.id) ?? `con_${contributions.length}`,
        amount,
        date: c.date as string,
        note: str(c.note, 200),
      });
    }
    goals.push({
      id: idOf(item.id) ?? `goal_${goals.length}`,
      name: str(item.name, 80) || 'Savings goal',
      target,
      note: str(item.note, 300),
      contributions,
      createdAt: str(item.createdAt, 40) || new Date().toISOString(),
      updatedAt: str(item.updatedAt, 40) || new Date().toISOString(),
      archived: bool(item.archived, false),
    });
  }
  data.goals = goals;
  counts.goals = goals.length;

  /* ---------- planner ---------- */
  const tasks: Task[] = [];
  for (const item of capped(asArray(source.tasks))) {
    if (!isPlainObject(item)) continue;
    const title = str(item.title, 200);
    if (!title) {
      warnings.push('tasks: skipped a task with no title.');
      continue;
    }
    const kind = item.kind === 'study' || item.kind === 'goal' ? item.kind : 'task';
    tasks.push({
      id: idOf(item.id) ?? `task_${tasks.length}`,
      title,
      notes: multi(item.notes, 2000),
      kind,
      status: item.status === 'done' ? 'done' : 'open',
      priority: item.priority === 'high' || item.priority === 'low' ? item.priority : 'medium',
      dueDate: isValidISODateFallback(item.dueDate) ? item.dueDate : null,
      reminderAt: typeof item.reminderAt === 'number' && item.reminderAt >= 0 && item.reminderAt < 1440 ? item.reminderAt : null,
      reminderFired: bool(item.reminderFired, false),
      tag: str(item.tag, 40),
      targetValue: typeof item.targetValue === 'number' ? num(item.targetValue) : null,
      currentValue: typeof item.currentValue === 'number' ? num(item.currentValue) : null,
      completedAt: typeof item.completedAt === 'string' ? str(item.completedAt, 40) : null,
      createdAt: str(item.createdAt, 40) || new Date().toISOString(),
      updatedAt: str(item.updatedAt, 40) || new Date().toISOString(),
    });
  }
  data.tasks = tasks;
  counts.tasks = tasks.length;

  const habits: Habit[] = [];
  for (const item of capped(asArray(source.habits))) {
    if (!isPlainObject(item)) continue;
    const name = str(item.name, 80);
    if (!name) continue;
    const days = asArray(item.days).map((d) => num(d, -1)).filter((d) => d >= 0 && d <= 6);
    habits.push({
      id: idOf(item.id) ?? `habit_${habits.length}`,
      name,
      days: days.length > 0 ? [...new Set(days)].sort() : [0, 1, 2, 3, 4, 5, 6],
      color: str(item.color, 20) || undefined,
      reminderAt: typeof item.reminderAt === 'number' && item.reminderAt >= 0 && item.reminderAt < 1440 ? item.reminderAt : null,
      createdAt: str(item.createdAt, 40) || new Date().toISOString(),
      archived: bool(item.archived, false),
    });
  }
  data.habits = habits;
  counts.habits = habits.length;

  const habitLogs: HabitLog[] = [];
  for (const item of capped(asArray(source.habitLogs))) {
    if (!isPlainObject(item)) continue;
    const habitId = str(item.habitId, 80);
    if (!habitId || !isValidISODateFallback(item.date)) continue;
    habitLogs.push({
      id: `${habitId}:${item.date}`,
      habitId,
      date: item.date as string,
      done: bool(item.done, true),
    });
  }
  data.habitLogs = habitLogs;
  counts.habitLogs = habitLogs.length;

  const notes: Note[] = [];
  for (const item of capped(asArray(source.notes))) {
    if (!isPlainObject(item)) continue;
    const body = multi(item.body, 20_000);
    const title = str(item.title, 120) || body.slice(0, 40) || 'Note';
    notes.push({
      id: idOf(item.id) ?? `note_${notes.length}`,
      title,
      body,
      pinned: bool(item.pinned, false),
      createdAt: str(item.createdAt, 40) || new Date().toISOString(),
      updatedAt: str(item.updatedAt, 40) || new Date().toISOString(),
    });
  }
  data.notes = notes;
  counts.notes = notes.length;

  const checklists: Checklist[] = [];
  for (const item of capped(asArray(source.checklists))) {
    if (!isPlainObject(item)) continue;
    const title = str(item.title, 120);
    if (!title) continue;
    const items: ChecklistItem[] = [];
    for (const i of capped(asArray(item.items))) {
      if (!isPlainObject(i)) continue;
      const text = str(i.text, 200);
      if (!text) continue;
      items.push({ id: idOf(i.id) ?? `ci_${items.length}`, text, done: bool(i.done, false) });
    }
    checklists.push({
      id: idOf(item.id) ?? `list_${checklists.length}`,
      title,
      kind: item.kind === 'shopping' || item.kind === 'safety' ? item.kind : 'custom',
      items,
      createdAt: str(item.createdAt, 40) || new Date().toISOString(),
      updatedAt: str(item.updatedAt, 40) || new Date().toISOString(),
    });
  }
  data.checklists = checklists;
  counts.checklists = checklists.length;

  /* ---------- learning, career ---------- */
  const learningProgress: LearningProgress[] = [];
  for (const item of capped(asArray(source.learningProgress))) {
    if (!isPlainObject(item)) continue;
    const id = idOf(item.id);
    if (!id) continue;
    const cached = isPlainObject(item.cached)
      ? {
          title: str((item.cached as Record<string, unknown>).title, 200),
          body: multi((item.cached as Record<string, unknown>).body, 20_000),
          savedAt: str((item.cached as Record<string, unknown>).savedAt, 40) || new Date().toISOString(),
        }
      : null;
    learningProgress.push({
      id,
      read: bool(item.read, false),
      progress: Math.min(100, Math.max(0, num(item.progress, 0))),
      bookmarked: bool(item.bookmarked, false),
      updatedAt: str(item.updatedAt, 40) || new Date().toISOString(),
      cached: cached && cached.body ? cached : null,
    });
  }
  data.learningProgress = learningProgress;
  counts.learningProgress = learningProgress.length;

  data.resume = isPlainObject(source.resume) ? sanitizeResume(source.resume as Record<string, unknown>) : null;
  counts.resume = data.resume ? 1 : 0;

  const applications: JobApplication[] = [];
  for (const item of capped(asArray(source.applications))) {
    if (!isPlainObject(item)) continue;
    const role = str(item.role, 120);
    const organisation = str(item.organisation, 120);
    if (!role && !organisation) continue;
    const allowed: ApplicationStatus[] = ['saved', 'applied', 'interview', 'offer', 'rejected', 'withdrawn'];
    applications.push({
      id: idOf(item.id) ?? `app_${applications.length}`,
      role: role || 'Untitled role',
      organisation,
      location: str(item.location, 120),
      link: safeUrl(item.link),
      status: allowed.includes(item.status as ApplicationStatus) ? (item.status as ApplicationStatus) : 'saved',
      appliedDate: isValidISODateFallback(item.appliedDate) ? item.appliedDate : null,
      nextFollowUp: isValidISODateFallback(item.nextFollowUp) ? item.nextFollowUp : null,
      notes: multi(item.notes, 4000),
      createdAt: str(item.createdAt, 40) || new Date().toISOString(),
      updatedAt: str(item.updatedAt, 40) || new Date().toISOString(),
    });
  }
  data.applications = applications;
  counts.applications = applications.length;

  /* ---------- settings and notifications ---------- */
  data.settings = sanitizeSettings(isPlainObject(source.settings) ? (source.settings as Record<string, unknown>) : {});
  data.notificationPrefs = sanitizeNotificationPrefs(
    isPlainObject(source.notificationPrefs) ? (source.notificationPrefs as Record<string, unknown>) : {}
  );

  const notificationLog: NotificationLogItem[] = [];
  for (const item of capped(asArray(source.notificationLog)).slice(0, 500)) {
    if (!isPlainObject(item)) continue;
    const title = str(item.title, 160);
    if (!title) continue;
    notificationLog.push({
      id: idOf(item.id) ?? `log_${notificationLog.length}`,
      category: (str(item.category, 20) || 'system') as NotificationLogItem['category'],
      title,
      body: str(item.body, 400),
      at: str(item.at, 40) || new Date().toISOString(),
      read: bool(item.read, false),
      origin: item.origin === 'in-app' ? 'in-app' : 'local',
    });
  }
  data.notificationLog = notificationLog;
  counts.notificationLog = notificationLog.length;

  const announcementsRead: { id: string; readAt: string }[] = [];
  for (const item of capped(asArray(source.announcementsRead))) {
    if (!isPlainObject(item)) continue;
    const id = idOf(item.id);
    if (!id) continue;
    announcementsRead.push({ id, readAt: str(item.readAt, 40) || new Date().toISOString() });
  }
  data.announcementsRead = announcementsRead;
  counts.announcementsRead = announcementsRead.length;

  const reports: DirectoryReport[] = [];
  for (const item of capped(asArray(source.reports))) {
    if (!isPlainObject(item)) continue;
    const listingId = str(item.listingId, 80);
    if (!listingId) continue;
    const reasons = ['outdated', 'wrong-contact', 'closed', 'other'];
    reports.push({
      id: idOf(item.id) ?? `rep_${reports.length}`,
      listingId,
      reason: reasons.includes(str(item.reason, 20)) ? (str(item.reason, 20) as DirectoryReport['reason']) : 'other',
      details: str(item.details, 600),
      createdAt: str(item.createdAt, 40) || new Date().toISOString(),
    });
  }
  data.reports = reports;
  counts.reports = reports.length;

  if (warnings.length > 0) {
    warnings.unshift(`${warnings.length} record(s) were skipped because they did not pass validation.`);
  }

  return {
    ok: true,
    errors: [],
    warnings,
    counts,
    data,
    exportedAt: typeof raw.exportedAt === 'string' ? str(raw.exportedAt, 40) : null,
    appVersion: typeof raw.appVersion === 'string' ? str(raw.appVersion, 20) : null,
  };
}

/** Parse JSON text then verify. Never throws. */
export function parseBackupText(text: string): BackupVerification {
  let parsed: unknown;
  try {
    if (text.length > 25_000_000) {
      return { ok: false, errors: ['The file is larger than 25 MB and cannot be imported.'], warnings: [], counts: {}, data: null, exportedAt: null, appVersion: null };
    }
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['The file is not valid JSON. It may be corrupted or not a LIFEKIT backup.'], warnings: [], counts: {}, data: null, exportedAt: null, appVersion: null };
  }
  return verifyBackup(parsed);
}

export function sanitizeResume(raw: Record<string, unknown>): Resume {
  const list = (value: unknown): Record<string, unknown>[] => asArray(value).filter(isPlainObject) as Record<string, unknown>[];
  return {
    id: 'resume',
    fullName: str(raw.fullName, 120),
    headline: str(raw.headline, 160),
    email: str(raw.email, 160),
    phone: str(raw.phone, 60),
    location: str(raw.location, 120),
    links: multi(raw.links, 600),
    summary: multi(raw.summary, 1200),
    education: list(raw.education).slice(0, 20).map((e, i) => ({
      id: idOf(e.id) ?? `edu_${i}`,
      qualification: str(e.qualification, 160),
      institution: str(e.institution, 160),
      location: str(e.location, 120),
      startYear: str(e.startYear, 10),
      endYear: str(e.endYear, 10),
      grade: str(e.grade, 60),
    })),
    experience: list(raw.experience).slice(0, 30).map((e, i) => ({
      id: idOf(e.id) ?? `exp_${i}`,
      role: str(e.role, 160),
      organisation: str(e.organisation, 160),
      location: str(e.location, 120),
      startDate: str(e.startDate, 20),
      endDate: str(e.endDate, 20),
      current: bool(e.current, false),
      bullets: multi(e.bullets, 2000),
    })),
    projects: list(raw.projects).slice(0, 30).map((p, i) => ({
      id: idOf(p.id) ?? `prj_${i}`,
      name: str(p.name, 160),
      description: multi(p.description, 1200),
      link: safeUrl(p.link),
    })),
    skills: list(raw.skills).slice(0, 20).map((s, i) => ({
      id: idOf(s.id) ?? `skl_${i}`,
      label: str(s.label, 80) || 'Skills',
      items: str(s.items, 400),
    })),
    languages: str(raw.languages, 300),
    certifications: multi(raw.certifications, 1200),
    updatedAt: str(raw.updatedAt, 40) || new Date().toISOString(),
  };
}

/** Only http(s) links are kept; javascript: and data: URLs are discarded. */
export function safeUrl(value: unknown): string {
  const text = str(value, 500);
  if (!text) return '';
  if (/^https?:\/\/[^\s]+$/i.test(text)) return text;
  return '';
}

export function sanitizeSettings(raw: Record<string, unknown>, fallback?: AppSettings): AppSettings {
  const base: AppSettings = fallback ?? {
    theme: 'system',
    language: 'en',
    currency: 'INR',
    locale: 'en-IN',
    weekStartsOn: 1,
    displayName: '',
    onboarded: false,
    reduceMotion: false,
    largeText: false,
    monthlyBudgetDefault: null,
    savingsMonthlyTarget: null,
    lastBackupAt: null,
    lastBackupReminderAt: null,
    storageWarningAcknowledged: false,
    remoteAnnouncementsEnabled: false,
    reminderCheckEnabled: true,
    version: 1,
  };
  const theme = raw.theme === 'light' || raw.theme === 'dark' || raw.theme === 'system' ? raw.theme : base.theme;
  const budget = raw.monthlyBudgetDefault === null ? null : parseAmount(
    typeof raw.monthlyBudgetDefault === 'number' ? raw.monthlyBudgetDefault : String(raw.monthlyBudgetDefault ?? '')
  );
  const savings = raw.savingsMonthlyTarget === null ? null : parseAmount(
    typeof raw.savingsMonthlyTarget === 'number' ? raw.savingsMonthlyTarget : String(raw.savingsMonthlyTarget ?? '')
  );
  return {
    theme,
    language: str(raw.language, 12) || base.language,
    currency: /^[A-Z]{3}$/.test(String(raw.currency ?? '')) ? String(raw.currency) : base.currency,
    locale: str(raw.locale, 20) || base.locale,
    weekStartsOn: raw.weekStartsOn === 0 ? 0 : 1,
    displayName: str(raw.displayName, 60),
    onboarded: bool(raw.onboarded, base.onboarded),
    reduceMotion: bool(raw.reduceMotion, base.reduceMotion),
    largeText: bool(raw.largeText, base.largeText),
    monthlyBudgetDefault: budget && budget > 0 ? budget : null,
    savingsMonthlyTarget: savings && savings > 0 ? savings : null,
    lastBackupAt: typeof raw.lastBackupAt === 'string' ? str(raw.lastBackupAt, 40) : null,
    lastBackupReminderAt: typeof raw.lastBackupReminderAt === 'string' ? str(raw.lastBackupReminderAt, 40) : null,
    storageWarningAcknowledged: bool(raw.storageWarningAcknowledged, false),
    remoteAnnouncementsEnabled: bool(raw.remoteAnnouncementsEnabled, false),
    reminderCheckEnabled: bool(raw.reminderCheckEnabled, base.reminderCheckEnabled),
    version: 1,
  };
}

export function sanitizeNotificationPrefs(
  raw: Record<string, unknown>,
  fallback?: NotificationPrefs
): NotificationPrefs {
  const base: NotificationPrefs = fallback ?? {
    masterEnabled: false,
    taskReminders: true,
    dueDateReminders: true,
    dailyPlannerReminder: false,
    habitReminders: false,
    backupReminders: true,
    announcements: false,
    dailyPlannerTime: 8 * 60,
    backupEveryDays: 14,
    quietHoursEnabled: false,
    quietStart: 22 * 60,
    quietEnd: 7 * 60,
    sound: true,
    vibration: true,
    permissionAskedAt: null,
    permissionResult: null,
  };
  const clock = (value: unknown, fb: number): number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1440 ? Math.round(value) : fb;
  const permission = raw.permissionResult;
  return {
    masterEnabled: bool(raw.masterEnabled, base.masterEnabled),
    taskReminders: bool(raw.taskReminders, base.taskReminders),
    dueDateReminders: bool(raw.dueDateReminders, base.dueDateReminders),
    dailyPlannerReminder: bool(raw.dailyPlannerReminder, base.dailyPlannerReminder),
    habitReminders: bool(raw.habitReminders, base.habitReminders),
    backupReminders: bool(raw.backupReminders, base.backupReminders),
    announcements: bool(raw.announcements, base.announcements),
    dailyPlannerTime: clock(raw.dailyPlannerTime, base.dailyPlannerTime),
    backupEveryDays: Math.min(365, Math.max(0, Math.round(num(raw.backupEveryDays, base.backupEveryDays)))),
    quietHoursEnabled: bool(raw.quietHoursEnabled, base.quietHoursEnabled),
    quietStart: clock(raw.quietStart, base.quietStart),
    quietEnd: clock(raw.quietEnd, base.quietEnd),
    sound: bool(raw.sound, base.sound),
    vibration: bool(raw.vibration, base.vibration),
    permissionAskedAt: typeof raw.permissionAskedAt === 'string' ? str(raw.permissionAskedAt, 40) : null,
    permissionResult:
      permission === 'granted' || permission === 'denied' || permission === 'dismissed' || permission === 'unsupported'
        ? permission
        : null,
  };
}
