/**
 * LIFEKIT local notification engine.
 *
 * What this is: reminders scheduled and delivered *on this device* while the LIFEKIT
 * app is open. There is no push service, no server, and no analytics deciding when to
 * bother you.
 *
 * What this is not: reliable background delivery. Browsers do not allow a web app to
 * wake itself reliably on every device, so LIFEKIT delivers a reminder when it is
 * opened (or already open) and the reminder time has passed. That limitation is stated
 * plainly in the UI rather than papered over.
 *
 * All scheduling decisions are pure functions so they can be tested without a browser.
 */
import type { Announcement, NotificationLogItem, NotificationPrefs, Task } from './models';
import { todayISO, formatClock, relativeDayLabel } from './dates';
import {
  deliverNativeNotification,
  isNativeApp,
  nativeNotificationPermission,
  requestNativeNotificationPermission,
} from './native';

export type ReminderKind = 'task' | 'due' | 'planner' | 'habit' | 'backup' | 'announcement';

export interface ReminderDescriptor {
  kind: ReminderKind;
  title: string;
  body: string;
  /** Stable key so the same reminder is never delivered twice. */
  key: string;
  /** Task or habit id when the reminder belongs to one. */
  refId?: string;
}

export interface ReminderInput {
  tasks: Task[];
  /**
   * Announcements currently shown in the app. Bundled examples are ignored here
   * (`sample: true` is never notify-eligible), and only items an operator marked
   * notify-eligible produce a notification.
   */
  announcements?: Announcement[];
  habitNames: { id: string; name: string; reminderAt?: number | null; days: number[] }[];
  habitLoggedToday: Set<string>;
  pref: NotificationPrefs;
  settings: { lastBackupAt: string | null; reminderCheckEnabled: boolean };
  now: Date;
}

/** True when `minutes` falls inside the quiet window, including windows that cross midnight. */
export function isQuietHours(minutes: number, start: number, end: number): boolean {
  if (start === end) return false; // a zero-length window is not a quiet period
  const m = ((minutes % 1440) + 1440) % 1440;
  if (start < end) return m >= start && m < end;
  return m >= start || m < end; // wraps past midnight
}

export function isCategoryEnabled(kind: ReminderKind, pref: NotificationPrefs): boolean {
  if (!pref.masterEnabled) return false;
  switch (kind) {
    case 'task':
      return pref.taskReminders;
    case 'due':
      return pref.dueDateReminders;
    case 'planner':
      return pref.dailyPlannerReminder;
    case 'habit':
      return pref.habitReminders;
    case 'backup':
      return pref.backupReminders && pref.backupEveryDays > 0;
    case 'announcement':
      return pref.announcements;
    default:
      return false;
  }
}

function minutesOfDay(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * Compute which reminders are due right now. Ordering is stable (planner, tasks, habits,
 * backup) so the Notification Center history reads sensibly.
 */
export function dueReminders(input: ReminderInput): ReminderDescriptor[] {
  const { tasks, habitNames, habitLoggedToday, pref, settings, now, announcements = [] } = input;
  if (!pref.masterEnabled || !settings.reminderCheckEnabled) return [];

  const today = todayISO(now);
  const nowMinutes = minutesOfDay(now);
  const out: ReminderDescriptor[] = [];

  // Daily planner reminder: fires once per day, at or after the configured time.
  if (isCategoryEnabled('planner', pref) && nowMinutes >= pref.dailyPlannerTime) {
    const openToday = tasks.filter((t) => t.status === 'open' && t.dueDate === today).length;
    const overdue = tasks.filter((t) => t.status === 'open' && t.dueDate && t.dueDate < today).length;
    out.push({
      kind: 'planner',
      title: 'Today’s plan',
      body:
        openToday === 0 && overdue === 0
          ? 'Nothing is scheduled for today. A good moment to plan tomorrow.'
          : `${openToday} task${openToday === 1 ? '' : 's'} due today${overdue > 0 ? `, ${overdue} overdue` : ''}.`,
      key: `planner:${today}`,
    });
  }

  for (const task of tasks) {
    if (task.status !== 'open') continue;
    // Category-specific reminder time on the task itself.
    if (isCategoryEnabled('task', pref) && task.reminderAt != null && task.dueDate === today && nowMinutes >= task.reminderAt) {
      out.push({
        kind: 'task',
        title: `Reminder: ${task.title}`,
        body: `Scheduled for ${formatClock(task.reminderAt)} today.`,
        key: `task:${task.id}:${today}`,
        refId: task.id,
      });
    }
  }

  // Due-date reminders for things that are late, once per task per day.
  if (isCategoryEnabled('due', pref)) {
    for (const task of tasks) {
      if (task.status !== 'open' || !task.dueDate) continue;
      if (task.dueDate < today) {
        out.push({
          kind: 'due',
          title: `Overdue: ${task.title}`,
          body: `Was due ${relativeDayLabel(task.dueDate, today).replace(' days overdue', ' days ago')} (${task.dueDate}).`,
          key: `due:${task.id}:${today}`,
          refId: task.id,
        });
      }
    }
  }

  // Habit reminders for habits not yet ticked today.
  if (isCategoryEnabled('habit', pref)) {
    const weekday = now.getDay();
    for (const habit of habitNames) {
      if (!habit.days.includes(weekday)) continue;
      if (habitLoggedToday.has(habit.id)) continue;
      if (habit.reminderAt != null && nowMinutes < habit.reminderAt) continue;
      out.push({
        kind: 'habit',
        title: `Habit: ${habit.name}`,
        body: 'Not marked as done yet today.',
        key: `habit:${habit.id}:${today}`,
        refId: habit.id,
      });
    }
  }

  // Published announcements, only when the user enabled announcement notifications and only
  // for messages an operator marked notify-eligible. Bundled examples never qualify, and no
  // announcement ever carries a money amount.
  if (isCategoryEnabled('announcement', pref)) {
    for (const announcement of announcements) {
      if (announcement.sample || !announcement.notifyEligible) continue;
      if (announcement.expiresAt && announcement.expiresAt < today) continue;
      out.push({
        kind: 'announcement',
        title: announcement.title,
        body: announcement.body.length > 240 ? `${announcement.body.slice(0, 237)}…` : announcement.body,
        key: `announcement:${announcement.id}`,
        refId: announcement.id,
      });
    }
  }

  // Backup reminder at the configured cadence.
  if (isCategoryEnabled('backup', pref)) {
    const last = settings.lastBackupAt;
    const daysSince = last ? Math.floor((now.getTime() - new Date(last).getTime()) / 86_400_000) : null;
    const due = last === null || (daysSince !== null && daysSince >= pref.backupEveryDays);
    if (due) {
      out.push({
        kind: 'backup',
        title: 'Back up your LIFEKIT records',
        body: last
          ? `Your last backup was ${daysSince} day${daysSince === 1 ? '' : 's'} ago. Export a fresh file from Settings.`
          : 'You have not exported a backup yet. It takes a few seconds and keeps your own copy.',
        key: `backup:${today}`,
      });
    }
  }

  return out;
}

/** Drop reminders already delivered (same key) so nothing repeats. */
export function undelivered(
  descriptors: ReminderDescriptor[],
  log: { id: string }[]
): ReminderDescriptor[] {
  const seen = new Set(log.map((l) => l.id));
  return descriptors.filter((d) => !seen.has(d.key));
}

export function buildLogItem(descriptor: ReminderDescriptor, now = new Date()): NotificationLogItem {
  return {
    id: descriptor.key,
    category: descriptor.kind,
    title: descriptor.title,
    body: descriptor.body,
    at: now.toISOString(),
    read: false,
    origin: 'local',
  };
}

/** Category label + icon glyph used by the Notification Center. */
export function kindLabel(kind: ReminderKind): string {
  switch (kind) {
    case 'task':
      return 'Task reminder';
    case 'due':
      return 'Due date';
    case 'planner':
      return 'Daily planner';
    case 'habit':
      return 'Habit';
    case 'backup':
      return 'Backup';
    case 'announcement':
      return 'Announcement';
    default:
      return 'System';
  }
}

/* ------------------------------------------------------------------ */
/* browser permission + delivery                                      */
/* ------------------------------------------------------------------ */

export type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export function notificationSupport():
  | { supported: true; permission: PermissionState; vibrate: boolean }
  | { supported: false; permission: 'unsupported'; vibrate: false } {
  if (isNativeApp()) {
    // Android's notification permission lives in the shell, not in the WebView.
    const native = nativeNotificationPermission();
    if (native === 'unsupported') return { supported: false, permission: 'unsupported', vibrate: false };
    return { supported: true, permission: native, vibrate: true };
  }
  const supported = typeof window !== 'undefined' && 'Notification' in window;
  const vibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  if (!supported) return { supported: false, permission: 'unsupported', vibrate: false };
  return { supported: true, permission: Notification.permission as PermissionState, vibrate };
}

/**
 * Request permission. Call this ONLY from a user gesture after the user has switched
 * notifications on and read why LIFEKIT needs them. If permission was already denied we
 * return that state and never prompt again — the UI tells the user where to change it.
 */
export async function requestPermission(): Promise<PermissionState> {
  const status = notificationSupport();
  if (!status.supported) return 'unsupported';
  if (status.permission === 'granted' || status.permission === 'denied') return status.permission;
  if (isNativeApp()) return requestNativeNotificationPermission();
  try {
    const result = await Notification.requestPermission();
    return result as PermissionState;
  } catch {
    return 'denied';
  }
}

export interface DeliveryOutcome {
  delivered: boolean;
  via: 'system' | 'in-app' | 'suppressed';
  reason?: string;
}

/**
 * Deliver one reminder. Uses the platform notification when permission is granted, and
 * falls back to the in-app Notification Center otherwise (which is the honest behaviour
 * for a user who denied permission — the record still exists, nothing is lost).
 */
export async function deliver(
  descriptor: ReminderDescriptor,
  pref: NotificationPrefs,
  now = new Date()
): Promise<DeliveryOutcome> {
  const nowMinutes = minutesOfDay(now);
  if (pref.quietHoursEnabled && isQuietHours(nowMinutes, pref.quietStart, pref.quietEnd)) {
    return { delivered: false, via: 'suppressed', reason: 'quiet hours' };
  }
  const status = notificationSupport();
  if (status.supported && status.permission === 'granted') {
    if (isNativeApp()) {
      const native = deliverNativeNotification(descriptor.title, descriptor.body, descriptor.key, {
        // A reminder tap lands on the planner, which is where reminders are created.
        route: '/planner',
        silent: !pref.sound,
        vibrate: pref.vibration,
      });
      if (native?.ok) return { delivered: true, via: 'system' };
      return { delivered: true, via: 'in-app' };
    }
    try {
      const options: NotificationOptions & { vibrate?: number[] } = {
        body: descriptor.body,
        tag: descriptor.key,
        // Personal content is already in the body, but we never put money figures in a
        // notification; the descriptor bodies are built from task titles only.
        requireInteraction: false,
      };
      if (pref.vibration && status.vibrate) options.vibrate = [40, 60, 40];
      if (!pref.sound) options.silent = true;
      const registration = await navigator.serviceWorker?.getRegistration?.();
      if (registration?.showNotification) {
        await registration.showNotification(descriptor.title, options);
      } else {
        new Notification(descriptor.title, options);
      }
      return { delivered: true, via: 'system' };
    } catch {
      // Fall through to the in-app record rather than losing the reminder.
    }
  }
  return { delivered: true, via: 'in-app' };
}

/** Compose the example shown by Settings > Preview, so users see exactly what they get. */
export function previewDescriptor(): ReminderDescriptor {
  return {
    kind: 'task',
    title: 'Example: Reminder — call the electricity office',
    body: 'This is a preview. Nothing was scheduled and no task was created.',
    key: `preview:${Date.now()}`,
  };
}

export const NOTIFICATION_LIMITATIONS =
  'Local reminders are scheduled on this device and are shown while LIFEKIT is open, or the next time you open it after the reminder time. Browsers and Android may delay or skip notifications when the app is closed, in battery-saver mode, or when the tab has been discarded. Remote push notifications would require an internet connection, a supported delivery service and permission, and are not part of this release.';
