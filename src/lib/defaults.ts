/** Bundled default categories, settings and clearly-labelled example content. */
import type { MoneyCategory } from './money';
import type { AppSettings, Announcement, NotificationPrefs } from './models';

export const APP_VERSION = '1.0.1';
export const APP_NAME = 'LIFEKIT';
export const APP_TAGLINE = 'Everyday Tools. A Better Life.';
export const DEVELOPER_CREDIT = 'Developed by Benny ❤️';
/** Bump when bundled content (lessons, tips) changes so cached copies can be refreshed. */
export const CONTENT_VERSION = '2026-10-11';

/**
 * Bundled categories. `custom: false` marks the ones LIFEKIT ships with; users can add
 * their own or archive defaults they do not use. Ids are stable so backups stay valid.
 */
export const DEFAULT_CATEGORIES: MoneyCategory[] = [
  { id: 'expense_food', name: 'Food & groceries', type: 'expense', custom: false },
  { id: 'expense_transport', name: 'Transport', type: 'expense', custom: false },
  { id: 'expense_rent', name: 'Rent & housing', type: 'expense', custom: false },
  { id: 'expense_utilities', name: 'Utilities & bills', type: 'expense', custom: false },
  { id: 'expense_health', name: 'Health', type: 'expense', custom: false },
  { id: 'expense_education', name: 'Education', type: 'expense', custom: false },
  { id: 'expense_family', name: 'Family & gifts', type: 'expense', custom: false },
  { id: 'expense_phone', name: 'Phone & internet', type: 'expense', custom: false },
  { id: 'expense_debt', name: 'Loan repayment', type: 'expense', custom: false },
  { id: 'expense_savings', name: 'Savings set aside', type: 'expense', custom: false },
  { id: 'expense_other', name: 'Other', type: 'expense', custom: false },
  { id: 'income_salary', name: 'Salary', type: 'income', custom: false },
  { id: 'income_business', name: 'Business', type: 'income', custom: false },
  { id: 'income_freelance', name: 'Freelance', type: 'income', custom: false },
  { id: 'income_agriculture', name: 'Agriculture', type: 'income', custom: false },
  { id: 'income_gift', name: 'Gift received', type: 'income', custom: false },
  { id: 'income_other', name: 'Other income', type: 'income', custom: false },
];

/** Matches a category name to a bundled id, used by CSV import and by the sample data loader. */
export function categoryIdForName(name: string, type: 'income' | 'expense'): string {
  const normalized = name.trim().toLowerCase();
  const found = DEFAULT_CATEGORIES.find((c) => c.name.toLowerCase() === normalized && c.type === type);
  if (found) return found.id;
  const partial = DEFAULT_CATEGORIES.find(
    (c) => c.type === type && (c.name.toLowerCase().includes(normalized) || normalized.includes(c.name.toLowerCase().split(' ')[0]))
  );
  return partial?.id ?? (type === 'income' ? 'income_other' : 'expense_other');
}

export const DEFAULT_SETTINGS: AppSettings = {
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

/**
 * Defaults are deliberately conservative: notifications are OFF until the user turns
 * them on and understands what they do. Nothing is requested on first launch.
 */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
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

/**
 * Example announcements that ship inside the app. They are explicitly marked `sample`
 * and are labelled "Example" in the UI — nothing here describes a real LIFEKIT service
 * status, real user activity, or a claim we cannot substantiate.
 */
export const SAMPLE_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'sample-welcome',
    title: 'Example message: welcome to LIFEKIT',
    body:
      'This is a bundled example announcement so you can see how the announcement feed works. Real messages appear here only when you enable announcement notifications and a message is actually published. LIFEKIT does not send advertising.',
    category: 'feature',
    publishedAt: '2026-01-01',
    priority: 'low',
    language: 'en',
    sample: true,
    notifyEligible: false,
  },
  {
    id: 'sample-backup-tip',
    title: 'Example tip: keep a backup file',
    body:
      'Money records, tasks and notes live only on this device. Clearing browser storage or losing the phone removes them. Exporting a backup file from Settings > Backup and restore keeps your own copy. This is an example message, not a notification you missed.',
    category: 'tip',
    publishedAt: '2026-01-02',
    priority: 'normal',
    language: 'en',
    sample: true,
    notifyEligible: false,
  },
  {
    id: 'sample-phishing',
    title: 'Example security note: nobody needs your OTP',
    body:
      'No bank, delivery company or government office will ask for your OTP, PIN or password. If someone does, it is a scam — end the conversation and use the official reporting channel listed in the Safety centre. Example content bundled with the app.',
    category: 'security',
    publishedAt: '2026-01-03',
    priority: 'high',
    language: 'en',
    sample: true,
    notifyEligible: false,
  },
];

/** Content pack URL used only when the user opts in to remote announcements. */
export const REMOTE_CONTENT_PATHS = {
  announcements: 'content/announcements.json',
  directory: 'content/directory.json',
} as const;

export function defaultContentPackNotice(): string {
  return 'Remote announcements are optional. LIFEKIT ships with everything it needs offline; enabling this only fetches public content from the LIFEKIT server you configure, and never uploads your records.';
}
