/**
 * LIFEKIT Notification Centre and Notification Settings.
 *
 * Three delivery mechanisms are kept strictly separate, and the UI says so plainly:
 *   1. Local scheduled reminders — computed on this device, delivered while LIFEKIT is open
 *      (or on the next open after the reminder time).
 *   2. In-app announcements — bundled messages, or optional remote content the user opts into.
 *   3. Remote push — not part of this release; explained rather than promised.
 *
 * Permission is requested exactly once, from a user gesture, after the user switches
 * reminders on and reads why. If permission is denied, the interface shows how to reverse
 * that in browser settings and never prompts again.
 */
import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Notice,
  PageHeader,
  SelectField,
  StatTile,
  TextField,
  ToggleRow,
} from '../components/ui';
import { Icon } from '../components/Icons';
import { useStore } from '../state/store';
import {
  NOTIFICATION_LIMITATIONS,
  deliver,
  kindLabel,
  notificationSupport,
  previewDescriptor,
  requestPermission,
  type ReminderKind,
} from '../lib/notifications';
import { formatClock, formatDate, parseClock } from '../lib/dates';
import { ROUTES, navigate } from '../router';

export function Notifications(): JSX.Element {
  const {
    data,
    announcements,
    announcementSource,
    prefs,
    pendingReminders,
    clearNotificationLog,
    deleteNotificationLog,
    markAnnouncementRead,
    notify,
    runReminderCheck,
  } = useStore();
  const [filter, setFilter] = useState<'all' | ReminderKind | 'announcement'>('all');
  const [confirmClear, setConfirmClear] = useState(false);
  const support = notificationSupport();

  const readIds = new Set(data.announcementsRead.map((a) => a.id));
  const history = useMemo(
    () =>
      data.notificationLog
        .filter((item) => (filter === 'all' ? true : item.category === filter))
        .sort((a, b) => b.at.localeCompare(a.at)),
    [data.notificationLog, filter]
  );

  const unreadAnnouncements = announcements.filter((a) => !readIds.has(a.id));
  const upcomingTasks = data.tasks
    .filter((task) => task.status === 'open' && task.reminderAt != null)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || (a.reminderAt ?? 0) - (b.reminderAt ?? 0));

  return (
    <div className="stack">
      <PageHeader
        title="Notifications"
        description="Reminders scheduled on this device, your notification history, and important messages."
        actions={
          <Button variant="secondary" icon="settings" onClick={() => navigate(ROUTES.notificationSettings)}>
            Notification settings
          </Button>
        }
      />

      <div className="grid grid-3">
        <StatTile label="Reminders enabled" value={prefs.masterEnabled ? 'Yes' : 'No'} hint={prefs.masterEnabled ? 'Local delivery only' : 'Nothing will be shown'} />
        <StatTile label="History entries" value={String(data.notificationLog.length)} />
        <StatTile label="Unread announcements" value={String(unreadAnnouncements.length)} />
      </div>

      {!prefs.masterEnabled ? (
        <Notice tone="warning" title="Reminders are currently switched off.">
          The planner still works completely — you simply will not receive a nudge. Turn reminders on in{' '}
          <a href={`#${ROUTES.notificationSettings}`}>Notification settings</a>, where you can preview what a reminder looks
          like before enabling it.
        </Notice>
      ) : null}

      <Card title="Due right now" subtitle="Reminders LIFEKIT has calculated as due, based on your current data">
        {pendingReminders.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>
            Nothing is due at this moment. This panel refreshes while the app is open and when you reopen it.
          </p>
        ) : (
          <ul className="list">
            {pendingReminders.map((reminder) => (
              <li className="list-item" key={reminder.key}>
                <Icon name="bell" size={18} />
                <div className="list-item-main">
                  <div style={{ fontWeight: 550 }}>{reminder.title}</div>
                  <div className="tiny muted">
                    {kindLabel(reminder.kind)} · {reminder.body}
                  </div>
                </div>
                <Badge tone="info">Due</Badge>
              </li>
            ))}
          </ul>
        )}
        <div className="btn-row" style={{ marginTop: 12 }}>
          <Button
            size="sm"
            variant="secondary"
            icon="repeat"
            onClick={async () => {
              const delivered = await runReminderCheck({ manual: true });
              notify(
                delivered > 0
                  ? `${delivered} reminder${delivered === 1 ? '' : 's'} delivered.`
                  : 'Checked. Nothing new to deliver right now — recent reminders are not repeated.',
                'success'
              );
            }}
          >
            Check now
          </Button>
        </div>
      </Card>

      <Card title="Upcoming task reminders" subtitle="Scheduled times from your planner">
        {upcomingTasks.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>
            No tasks have a reminder time yet. Add one in the planner, then enable task reminders in settings.
          </p>
        ) : (
          <ul className="list">
            {upcomingTasks.slice(0, 8).map((task) => (
              <li className="list-item" key={task.id}>
                <div className="list-item-main">
                  <div style={{ fontWeight: 550 }}>{task.title}</div>
                  <div className="tiny muted">
                    {task.dueDate ? formatDate(task.dueDate, 'medium') : 'No date'} · {formatClock(task.reminderAt ?? 0)}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => navigate(ROUTES.planner)}>
                  Open planner
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="History"
        subtitle="Everything LIFEKIT has shown you, plus reminders it held during quiet hours"
        actions={
          <Button size="sm" variant="ghost" icon="trash" disabled={data.notificationLog.length === 0} onClick={() => setConfirmClear(true)}>
            Clear history
          </Button>
        }
      >
        <div className="toolbar" style={{ marginBottom: 'var(--space-3)' }}>
          <SelectField
            label="Filter by type"
            value={filter}
            onChange={(event) => setFilter(event.target.value as typeof filter)}
            options={[
              { value: 'all', label: 'Everything' },
              { value: 'planner', label: 'Daily planner' },
              { value: 'task', label: 'Task reminders' },
              { value: 'due', label: 'Due dates' },
              { value: 'habit', label: 'Habits' },
              { value: 'backup', label: 'Backup' },
              { value: 'announcement', label: 'Announcements' },
            ]}
          />
        </div>

        {history.length === 0 ? (
          <EmptyState icon="bell" title="No notifications recorded yet">
            When a reminder is delivered or held, it appears here. Nothing is sent anywhere — this list is stored on this device
            and clearing it does not affect your tasks or records.
          </EmptyState>
        ) : (
          <ul className="list">
            {history.map((item) => (
              <li className="list-item" key={item.id}>
                <Icon name={item.origin === 'in-app' ? 'info' : 'bell'} size={18} />
                <div className="list-item-main">
                  <div style={{ fontWeight: 550 }}>
                    {item.title} {item.read ? null : <Badge tone="accent">New</Badge>}
                  </div>
                  <div className="small muted">{item.body}</div>
                  <div className="tiny muted">
                    {kindLabel(item.category as ReminderKind)} · {new Date(item.at).toLocaleString()} ·{' '}
                    {item.origin === 'local' ? 'delivered on this device' : 'in-app message'}
                  </div>
                </div>
                <IconButton icon="trash" label={`Delete notification “${item.title}”`} onClick={() => void deleteNotificationLog(item.id)} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Important messages"
        subtitle={
          announcementSource === 'published'
            ? 'Messages published by the content server you opted into'
            : announcementSource === 'unavailable'
              ? 'The published feed could not be reached — showing the bundled examples instead'
              : 'Bundled example messages, shown so you can see how this works'
        }
      >
        {announcements.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>
            No messages at the moment.
          </p>
        ) : (
          <ul className="list">
            {announcements.map((announcement) => {
              const read = readIds.has(announcement.id);
              return (
                <li className="list-item" key={announcement.id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div className="row-between wrap">
                    <div className="row wrap" style={{ gap: 8 }}>
                      <strong>{announcement.title}</strong>
                      {announcement.sample ? <Badge>Example</Badge> : null}
                      <Badge tone="info">{announcement.category}</Badge>
                      {announcement.priority === 'high' ? <Badge tone="danger">Important</Badge> : null}
                      {read ? null : <Badge tone="accent">Unread</Badge>}
                    </div>
                    {read ? (
                      <span className="tiny muted">Read {announcement.readAt ? new Date(announcement.readAt).toLocaleDateString() : ''}</span>
                    ) : (
                      <Button size="sm" variant="ghost" icon="check" onClick={() => void markAnnouncementRead(announcement.id)}>
                        Mark as read
                      </Button>
                    )}
                  </div>
                  <p className="small" style={{ margin: '6px 0 0' }}>
                    {announcement.body}
                  </p>
                  <p className="tiny muted" style={{ margin: '4px 0 0' }}>
                    Published {formatDate(announcement.publishedAt, 'medium')} · language {announcement.language}
                    {announcement.expiresAt ? ` · expires ${formatDate(announcement.expiresAt, 'medium')}` : ''}
                    {announcement.sourceUrl ? ' · ' : ''}
                    {announcement.sourceUrl ? (
                      <a href={announcement.sourceUrl} target="_blank" rel="noopener noreferrer external">
                        official source
                      </a>
                    ) : null}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        <p className="tiny muted" style={{ marginTop: 12, marginBottom: 0 }}>
          Messages marked “Example” ship inside the app so the feed is never blank. LIFEKIT does not send advertising, never
          includes money amounts, and never chooses who to message from your activity.
        </p>
      </Card>

      <Card title="How notifications actually work here">
        <div className="stack-sm">
          <div>
            <h3 style={{ fontSize: '0.98rem' }}>1. Local scheduled reminders (what this release uses)</h3>
            <p className="small muted" style={{ margin: 0 }}>
              Calculated on your device from your own tasks, habits and backup history. They are shown while LIFEKIT is open, or
              the next time you open it after the reminder time. Permission state:{' '}
              <strong>{support.supported ? support.permission : 'not supported in this browser'}</strong>.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: '0.98rem' }}>2. In-app announcements (available now)</h3>
            <p className="small muted" style={{ margin: 0 }}>
              Bundled messages shown inside the app. They need no permission and work offline. Remote announcements, if you enable
              them, appear after you reconnect and the app refreshes.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: '0.98rem' }}>3. Remote push notifications (not included)</h3>
            <p className="small muted" style={{ margin: 0 }}>
              Push would require an internet connection, a supported delivery service, a backend, and platform permission — and
              even then, delivery is not guaranteed on every browser or Android device. LIFEKIT deliberately does not depend on
              it. {NOTIFICATION_LIMITATIONS}
            </p>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmClear}
        title="Clear notification history?"
        message="The history list will be emptied on this device. Your tasks, habits and money records are not affected."
        confirmLabel="Clear history"
        onCancel={() => setConfirmClear(false)}
        onConfirm={async () => {
          await clearNotificationLog();
          setConfirmClear(false);
        }}
      />
    </div>
  );
}

/* ------------------------------- settings ------------------------------- */

export function NotificationSettings(): JSX.Element {
  const { prefs, updatePrefs, runReminderCheck, notify, settings, updateSettings } = useStore();
  const [support, setSupport] = useState(() => notificationSupport());
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const enableReminders = async (next: boolean) => {
    if (!next) {
      await updatePrefs({ masterEnabled: false });
      return;
    }
    setBusy(true);
    // Ask for permission only now: the user has explicitly switched reminders on.
    const result = await requestPermission();
    await updatePrefs({
      masterEnabled: true,
      permissionAskedAt: new Date().toISOString(),
      // 'default' means the user dismissed the prompt: record it as dismissed so the UI
      // never treats it as a denial it must report.
      permissionResult: result === 'default' ? 'dismissed' : result,
    });
    setSupport(notificationSupport());
    setBusy(false);
    if (result === 'denied') {
      notify(
        'The browser blocked notifications. Reminders will still appear inside LIFEKIT and in the history list.',
        'error'
      );
    } else if (result === 'unsupported') {
      notify('This browser does not support system notifications. In-app reminders still work.', 'error');
    } else if (result === 'granted') {
      notify('Reminders enabled. Nothing is sent over the internet — these are scheduled on this device.', 'success');
    }
  };

  const preview = async () => {
    const outcome = await deliver(previewDescriptor(), { ...prefs, quietHoursEnabled: false });
    await runReminderCheck({ manual: false });
    setPreviewResult(
      outcome.via === 'system'
        ? 'Sent as a system notification. Check your notification shade (or your computer’s notification area).'
        : outcome.via === 'in-app'
          ? 'Shown as an in-app reminder only, because system notifications are not permitted. This is exactly what will happen with every reminder.'
          : 'Held for quiet hours — that is the setting working as intended.'
    );
  };

  const supportText = support.supported
    ? support.permission === 'granted'
      ? 'Allowed'
      : support.permission === 'denied'
        ? 'Blocked in this browser'
        : 'Not requested yet'
    : 'Not supported in this browser';

  return (
    <div className="stack">
      <PageHeader
        title="Notification settings"
        description="You choose whether reminders exist at all. Nothing is enabled until you switch it on."
        actions={
          <Button variant="secondary" icon="bell" onClick={() => navigate(ROUTES.notifications)}>
            Notification centre
          </Button>
        }
      />

      <Card title="Master switch" subtitle={`System notification permission: ${supportText}`}>
        <ToggleRow
          label="Enable LIFEKIT reminders"
          description="When this is off, LIFEKIT schedules nothing and asks for no permission. The planner works exactly the same."
          checked={prefs.masterEnabled}
          disabled={busy}
          onChange={(checked) => void enableReminders(checked)}
        />
        {prefs.permissionResult === 'denied' ? (
          <Notice tone="warning" title="Notifications are blocked in this browser.">
            LIFEKIT will not ask again. To change it, open your browser’s site settings for this page (usually the padlock or
            “i” icon in the address bar), find Notifications, and allow it. Reminders keep appearing inside the app and in the
            history list meanwhile — you lose nothing except the system pop-up.
          </Notice>
        ) : null}
        {!support.supported ? (
          <Notice tone="info" title="This browser does not offer system notifications.">
            Reminders will still be computed and listed inside LIFEKIT. On many browsers, notifications also require the app to be
            installed to the home screen or opened as a normal tab.
          </Notice>
        ) : null}
        <div className="btn-row" style={{ marginTop: 12 }}>
          <Button size="sm" variant="secondary" icon="bell" onClick={() => void preview()} disabled={!prefs.masterEnabled}>
            Preview a reminder
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon="repeat"
            onClick={async () => {
              const delivered = await runReminderCheck({ manual: true });
              notify(delivered > 0 ? `${delivered} reminder(s) delivered.` : 'Checked — nothing new to deliver.', 'success');
            }}
          >
            Run a check now
          </Button>
        </div>
        {previewResult ? (
          <p className="small" role="status" style={{ marginTop: 8, marginBottom: 0 }}>
            {previewResult}
          </p>
        ) : null}
      </Card>

      <Card title="Which reminders?" subtitle="Each category can be switched on independently">
        <ToggleRow
          label="Task reminders"
          description="Fires for a task that has a reminder time on today’s date."
          checked={prefs.taskReminders}
          disabled={!prefs.masterEnabled}
          onChange={(checked) => void updatePrefs({ taskReminders: checked })}
        />
        <ToggleRow
          label="Due date reminders"
          description="Tells you about tasks whose due date has passed, once per task per day."
          checked={prefs.dueDateReminders}
          disabled={!prefs.masterEnabled}
          onChange={(checked) => void updatePrefs({ dueDateReminders: checked })}
        />
        <ToggleRow
          label="Daily planner reminder"
          description="One reminder a day at the time you choose below."
          checked={prefs.dailyPlannerReminder}
          disabled={!prefs.masterEnabled}
          onChange={(checked) => void updatePrefs({ dailyPlannerReminder: checked })}
        />
        {prefs.dailyPlannerReminder ? (
          <div style={{ maxWidth: 240 }}>
            <TextField
              label="Daily reminder time"
              type="time"
              value={`${String(Math.floor(prefs.dailyPlannerTime / 60)).padStart(2, '0')}:${String(prefs.dailyPlannerTime % 60).padStart(2, '0')}`}
              onChange={(event) => {
                const minutes = parseClock(event.target.value);
                if (minutes !== null) void updatePrefs({ dailyPlannerTime: minutes });
              }}
            />
          </div>
        ) : null}
        <ToggleRow
          label="Habit reminders"
          description="Reminds you about habits scheduled for today that you have not ticked."
          checked={prefs.habitReminders}
          disabled={!prefs.masterEnabled}
          onChange={(checked) => void updatePrefs({ habitReminders: checked })}
        />
        <ToggleRow
          label="Backup reminders"
          description="A nudge to export a backup file so your records are not only on this device."
          checked={prefs.backupReminders}
          disabled={!prefs.masterEnabled}
          onChange={(checked) => void updatePrefs({ backupReminders: checked })}
        />
        {prefs.backupReminders ? (
          <div style={{ maxWidth: 240 }}>
            <SelectField
              label="Remind me every"
              value={String(prefs.backupEveryDays)}
              onChange={(event) => void updatePrefs({ backupEveryDays: Number(event.target.value) })}
              options={[
                { value: '7', label: '7 days' },
                { value: '14', label: '14 days' },
                { value: '30', label: '30 days' },
                { value: '90', label: '90 days' },
              ]}
            />
          </div>
        ) : null}
        <ToggleRow
          label="Announcements"
          description="Important messages only: security notices, privacy changes, service status and new features. Never advertising."
          checked={prefs.announcements}
          disabled={!prefs.masterEnabled}
          onChange={(checked) => void updatePrefs({ announcements: checked })}
        />
        <ToggleRow
          label="Reminder checking active"
          description="Turn off to pause all reminder calculations without losing your preferences."
          checked={settings.reminderCheckEnabled}
          onChange={(checked) => void updateSettings({ reminderCheckEnabled: checked })}
        />
      </Card>

      <Card title="Quiet hours, sound and vibration">
        <ToggleRow
          label="Quiet hours"
          description="Reminders due during this window are recorded in the history instead of being shown."
          checked={prefs.quietHoursEnabled}
          onChange={(checked) => void updatePrefs({ quietHoursEnabled: checked })}
        />
        {prefs.quietHoursEnabled ? (
          <div className="grid grid-2">
            <TextField
              label="Quiet from"
              type="time"
              value={`${String(Math.floor(prefs.quietStart / 60)).padStart(2, '0')}:${String(prefs.quietStart % 60).padStart(2, '0')}`}
              onChange={(event) => {
                const minutes = parseClock(event.target.value);
                if (minutes !== null) void updatePrefs({ quietStart: minutes });
              }}
            />
            <TextField
              label="Quiet until"
              type="time"
              value={`${String(Math.floor(prefs.quietEnd / 60)).padStart(2, '0')}:${String(prefs.quietEnd % 60).padStart(2, '0')}`}
              onChange={(event) => {
                const minutes = parseClock(event.target.value);
                if (minutes !== null) void updatePrefs({ quietEnd: minutes });
              }}
            />
          </div>
        ) : null}
        <ToggleRow
          label="Sound"
          description="Uses the system default alert tone. Requires notification permission."
          checked={prefs.sound}
          onChange={(checked) => void updatePrefs({ sound: checked })}
          disabled={!prefs.masterEnabled}
        />
        <ToggleRow
          label="Vibration"
          description={support.vibrate ? 'Supported on this device.' : 'Not supported on this device.'}
          checked={prefs.vibration}
          disabled={!prefs.masterEnabled || !support.vibrate}
          onChange={(checked) => void updatePrefs({ vibration: checked })}
        />
      </Card>

      <Card title="Limitations you should know">
        <ul className="small">
          <li>{NOTIFICATION_LIMITATIONS}</li>
          <li>
            A scheduled web notification needs the browser to run the app. If Android puts the browser to sleep, or the tab is
            closed, the reminder appears when LIFEKIT is next opened rather than at the exact minute.
          </li>
          <li>Reminders never repeat a key that was already delivered, so reopening the app cannot spam you.</li>
          <li>Money amounts are never included in a notification body. Reminder text uses task titles and habit names only.</li>
          <li>LIFEKIT has no idea whether a reminder actually reached you, and does not report that anywhere.</li>
        </ul>
      </Card>

      <Card title="What LIFEKIT will never do with notifications">
        <ul className="small">
          <li>Send advertising, promotions or referral messages.</li>
          <li>Choose recipients from your usage, your records, or anything you did not tell it.</li>
          <li>Send your financial records, notes or résumé content anywhere — notifications are built on your device.</li>
          <li>Use push notifications to collect data about you.</li>
        </ul>
      </Card>

      <p className="tiny muted">
        Long-press the preview above before enabling quiet hours if you want to hear the alert once. Settings are stored with your
        LIFEKIT preferences and are included in a backup file.
      </p>

      <p>
        <a href={`#${ROUTES.notifications}`}>← Back to the Notification centre</a>
      </p>
    </div>
  );
}

export default Notifications;
