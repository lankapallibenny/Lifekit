/**
 * Typed repository layer. Every screen talks to IndexedDB through this module, which
 * keeps the storage details in one auditable place and gives the rest of the app a
 * promise-based, strongly typed API.
 */
import { STORES, clearMany, deleteDocument, getAll, getDocument, put, putDocument, putMany, remove } from './storage';
import type {
  Checklist,
  Habit,
  HabitLog,
  JobApplication,
  LearningProgress,
  Note,
  NotificationLogItem,
  Resume,
  Task,
} from './models';
import type { Budget, MoneyCategory, MoneyEntry, SavingsGoal } from './money';

export const repo = {
  /* ---------------- money ---------------- */
  listEntries: () => getAll<MoneyEntry>(STORES.moneyEntries),
  saveEntry: (entry: MoneyEntry) => put(STORES.moneyEntries, entry),
  saveEntries: (entries: MoneyEntry[]) => putMany(STORES.moneyEntries, entries),
  deleteEntry: (id: string) => remove(STORES.moneyEntries, id),

  listCategories: () => getAll<MoneyCategory>(STORES.moneyCategories),
  saveCategory: (category: MoneyCategory) => put(STORES.moneyCategories, category),
  saveCategories: (categories: MoneyCategory[]) => putMany(STORES.moneyCategories, categories),

  listBudgets: () => getAll<Budget>(STORES.moneyBudgets),
  saveBudget: (budget: Budget) => put(STORES.moneyBudgets, budget),
  deleteBudget: (id: string) => remove(STORES.moneyBudgets, id),

  listGoals: () => getAll<SavingsGoal>(STORES.moneyGoals),
  saveGoal: (goal: SavingsGoal) => put(STORES.moneyGoals, goal),
  deleteGoal: (id: string) => remove(STORES.moneyGoals, id),

  /* ---------------- planner ---------------- */
  listTasks: () => getAll<Task>(STORES.tasks),
  saveTask: (task: Task) => put(STORES.tasks, task),
  saveTasks: (tasks: Task[]) => putMany(STORES.tasks, tasks),
  deleteTask: (id: string) => remove(STORES.tasks, id),

  listHabits: () => getAll<Habit>(STORES.habits),
  saveHabit: (habit: Habit) => put(STORES.habits, habit),
  deleteHabit: (id: string) => remove(STORES.habits, id),

  listHabitLogs: () => getAll<HabitLog>(STORES.habitLogs),
  saveHabitLog: (log: HabitLog) => put(STORES.habitLogs, log),
  deleteHabitLog: (id: string) => remove(STORES.habitLogs, id),

  listNotes: () => getAll<Note>(STORES.notes),
  saveNote: (note: Note) => put(STORES.notes, note),
  deleteNote: (id: string) => remove(STORES.notes, id),

  listChecklists: () => getAll<Checklist>(STORES.checklists),
  saveChecklist: (list: Checklist) => put(STORES.checklists, list),
  deleteChecklist: (id: string) => remove(STORES.checklists, id),

  /* ---------------- learn ---------------- */
  listLearningProgress: () => getAll<LearningProgress>(STORES.learningProgress),
  saveLearningProgress: (progress: LearningProgress) => put(STORES.learningProgress, progress),

  /* ---------------- career ---------------- */
  loadResume: () => getDocument<Resume>('resume'),
  saveResume: (resume: Resume) => putDocument('resume', resume),
  listApplications: () => getAll<JobApplication>(STORES.jobApplications),
  saveApplication: (application: JobApplication) => put(STORES.jobApplications, application),
  deleteApplication: (id: string) => remove(STORES.jobApplications, id),

  /* ---------------- notifications ---------------- */
  listNotificationLog: () => getAll<NotificationLogItem>(STORES.notificationLog),
  saveNotificationLog: (item: NotificationLogItem) => put(STORES.notificationLog, item),
  deleteNotificationLog: (id: string) => remove(STORES.notificationLog, id),
  clearNotificationLog: () => clearMany([STORES.notificationLog]),
};

export async function clearAllData(): Promise<void> {
  await clearMany([
    STORES.moneyEntries,
    STORES.moneyCategories,
    STORES.moneyBudgets,
    STORES.moneyGoals,
    STORES.tasks,
    STORES.habits,
    STORES.habitLogs,
    STORES.notes,
    STORES.checklists,
    STORES.learningProgress,
    STORES.jobApplications,
    STORES.notificationLog,
    STORES.announcementsRead,
    STORES.reports,
  ]);
  await deleteDocument('resume');
}

/** Used by Settings > Clear selected data. Financial records only. */
export async function clearMoneyData(): Promise<void> {
  await clearMany([STORES.moneyEntries, STORES.moneyBudgets, STORES.moneyGoals]);
}

export async function clearPlannerData(): Promise<void> {
  await clearMany([STORES.tasks, STORES.habits, STORES.habitLogs, STORES.checklists, STORES.notes]);
}

export async function clearCareerData(): Promise<void> {
  await clearMany([STORES.jobApplications]);
  await deleteDocument('resume');
}

export async function clearLearningData(): Promise<void> {
  await clearMany([STORES.learningProgress]);
}

export async function clearNotificationData(): Promise<void> {
  await clearMany([STORES.notificationLog]);
}

export async function loadAnnouncementRead(): Promise<Record<string, string>> {
  const records = await getAll<{ id: string; readAt: string }>(STORES.announcementsRead);
  const map: Record<string, string> = {};
  for (const record of records) map[record.id] = record.readAt;
  return map;
}

export async function markAnnouncementRead(id: string, readAt: string): Promise<void> {
  await put(STORES.announcementsRead, { id, readAt });
}
