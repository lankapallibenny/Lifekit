/** LIFEKIT domain models. Every stored record shape lives here (one source of truth). */
import type { MoneyEntry, MoneyCategory, Budget, SavingsGoal } from './money';
import type { Recurrence } from './money';

export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'open' | 'done';
export type TaskKind = 'task' | 'study' | 'goal';

export interface Task {
  id: string;
  title: string;
  notes?: string;
  kind: TaskKind;
  status: TaskStatus;
  priority: Priority;
  /** ISO yyyy-mm-dd or null for a task with no date. */
  dueDate: string | null;
  /** Minutes-from-midnight reminder time, or null. */
  reminderAt?: number | null;
  reminderFired?: boolean;
  recurrence?: Recurrence;
  /** Free-form grouping such as a subject or project name. */
  tag?: string;
  /** Goal fields (used when kind === 'goal'). */
  targetValue?: number | null;
  currentValue?: number | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Habit {
  id: string;
  name: string;
  /** 0 = Sunday … 6 = Saturday; every day when the array has all 7 entries. */
  days: number[];
  color?: string;
  reminderAt?: number | null;
  createdAt: string;
  archived?: boolean;
}

export interface HabitLog {
  id: string; // `${habitId}:${date}` so a habit can only be logged once per day
  habitId: string;
  date: string;
  done: boolean;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Checklist {
  id: string;
  title: string;
  kind: 'custom' | 'shopping' | 'safety';
  items: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface LearningProgress {
  id: string; // lesson id
  read: boolean;
  progress: number; // 0..100
  bookmarked: boolean;
  updatedAt: string;
  /** Cached copy of the lesson body so a saved lesson is readable fully offline. */
  cached?: { title: string; body: string; savedAt: string } | null;
}

export interface ResumeEducationItem {
  id: string;
  qualification: string;
  institution: string;
  location?: string;
  startYear?: string;
  endYear?: string;
  grade?: string;
}

export interface ResumeExperienceItem {
  id: string;
  role: string;
  organisation: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  bullets: string;
}

export interface ResumeProjectItem {
  id: string;
  name: string;
  description: string;
  link?: string;
}

export interface ResumeSkillGroup {
  id: string;
  label: string;
  items: string; // comma separated
}

export interface Resume {
  id: 'resume';
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: string; // one per line
  summary: string;
  education: ResumeEducationItem[];
  experience: ResumeExperienceItem[];
  projects: ResumeProjectItem[];
  skills: ResumeSkillGroup[];
  languages: string;
  certifications: string;
  updatedAt: string;
}

export type ApplicationStatus =
  | 'saved'
  | 'applied'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'withdrawn';

export interface JobApplication {
  id: string;
  role: string;
  organisation: string;
  location?: string;
  link?: string;
  status: ApplicationStatus;
  appliedDate?: string | null;
  nextFollowUp?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------- notifications ------------------------------- */

export interface NotificationPrefs {
  masterEnabled: boolean;
  taskReminders: boolean;
  dueDateReminders: boolean;
  dailyPlannerReminder: boolean;
  habitReminders: boolean;
  backupReminders: boolean;
  announcements: boolean;
  /** Minutes from midnight. */
  dailyPlannerTime: number;
  /** Backup reminder cadence, in days (0 = off). */
  backupEveryDays: number;
  quietHoursEnabled: boolean;
  quietStart: number;
  quietEnd: number;
  sound: boolean;
  vibration: boolean;
  /** ISO timestamp of the last permission request, to avoid nagging. */
  permissionAskedAt?: string | null;
  permissionResult?: 'granted' | 'denied' | 'dismissed' | 'unsupported' | null;
}

export interface NotificationLogItem {
  id: string;
  category:
    | 'task'
    | 'due'
    | 'planner'
    | 'habit'
    | 'backup'
    | 'announcement'
    | 'system'
    | 'test';
  title: string;
  body: string;
  at: string; // ISO timestamp
  read: boolean;
  /** 'local' = scheduled on this device, 'in-app' = bundled or fetched announcement. */
  origin: 'local' | 'in-app';
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: 'feature' | 'tip' | 'update' | 'security' | 'privacy' | 'service';
  publishedAt: string; // ISO date
  expiresAt?: string | null;
  priority: 'low' | 'normal' | 'high';
  language: string;
  /**
   * Examples that ship with the app are clearly labelled. Real messages require an
   * administrator to publish them through the optional backend (see server/).
   */
  sample?: boolean;
  readAt?: string | null;
  /** True when the user enabled this category of announcement in Settings. */
  notifyEligible: boolean;
  sourceUrl?: string;
}

/* ------------------------------- settings ------------------------------- */

export type ThemeChoice = 'system' | 'light' | 'dark';

export interface AppSettings {
  theme: ThemeChoice;
  language: string;
  currency: string;
  locale: string;
  weekStartsOn: 0 | 1;
  displayName: string;
  onboarded: boolean;
  reduceMotion: boolean;
  largeText: boolean;
  monthlyBudgetDefault: number | null;
  savingsMonthlyTarget: number | null;
  lastBackupAt: string | null;
  lastBackupReminderAt: string | null;
  /** Local-only flag: user has acknowledged the storage-loss warning. */
  storageWarningAcknowledged: boolean;
  /** Opt-in to fetching public announcements from the optional backend. */
  remoteAnnouncementsEnabled: boolean;
  reminderCheckEnabled: boolean;
  version: number;
}

/* ------------------------------- directory ------------------------------- */

export interface DirectoryListing {
  id: string;
  organisation: string;
  category:
    | 'food'
    | 'education'
    | 'volunteering'
    | 'community'
    | 'emergency'
    | 'public-support';
  region: string;
  city?: string;
  services: string;
  contact: string;
  website?: string;
  sourceUrl: string;
  lastVerified: string; // ISO date
  verifiedByName?: string;
  /** 'verified' listings have a checked official source URL and date. */
  verification: 'verified' | 'unverified';
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DirectoryReport {
  id: string;
  listingId: string;
  reason: 'outdated' | 'wrong-contact' | 'closed' | 'other';
  details?: string;
  createdAt: string;
}

/* ------------------------------- aggregate ------------------------------- */

/** Everything a backup file contains. Financial records stay local by default. */
export interface LifeKitData {
  entries: MoneyEntry[];
  categories: MoneyCategory[];
  budgets: Budget[];
  goals: SavingsGoal[];
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  notes: Note[];
  checklists: Checklist[];
  learningProgress: LearningProgress[];
  resume: Resume | null;
  applications: JobApplication[];
  settings: AppSettings;
  notificationPrefs: NotificationPrefs;
  notificationLog: NotificationLogItem[];
  announcementsRead: { id: string; readAt: string }[];
  reports: DirectoryReport[];
}

export const EMPTY_DATA: LifeKitData = {
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
  settings: {} as AppSettings,
  notificationPrefs: {} as NotificationPrefs,
  notificationLog: [],
  announcementsRead: [],
  reports: [],
};
