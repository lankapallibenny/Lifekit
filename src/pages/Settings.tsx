/**
 * LIFEKIT Settings, Backup, About, Privacy and Licenses.
 *
 * Privacy posture made concrete on this screen: there is no account to delete because
 * there is no account, no analytics toggle because there is no analytics, and the only
 * network feature (optional remote public content) is off by default and described in
 * plain language. Every destructive control asks for explicit confirmation, and the
 * nuclear option requires typing a word.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Notice,
  PageHeader,
  Segmented,
  SelectField,
  StatTile,
  TextField,
  ToggleRow,
} from '../components/ui';
import { useStore } from '../state/store';
import {
  APP_NAME,
  APP_TAGLINE,
  APP_VERSION,
  CONTENT_VERSION,
  DEVELOPER_CREDIT,
  defaultContentPackNotice,
} from '../lib/defaults';
import { storageEstimate, storageHealth } from '../lib/storage';
import { NOTIFICATION_LIMITATIONS } from '../lib/notifications';
import { ROUTES, navigate } from '../router';
import { formatDate } from '../lib/dates';
import { SAFETY_REVIEWED_ON } from '../content/safety';
import { LESSONS } from '../content/learning';
import { INTERVIEW_QUESTIONS } from '../content/career';
import { PROJECT_LICENSES } from '../content/licenses';
import { isNativeApp, nativePlatformInfo } from '../lib/native';

/* ------------------------------- main settings ------------------------------- */

export function SettingsPage(): JSX.Element {
  const { settings, updateSettings, data, storage, clearData, resetApp } = useStore();
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [confirmClear, setConfirmClear] = useState<null | 'money' | 'planner' | 'career' | 'learning' | 'notifications'>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    void storageEstimate().then(setUsage);
  }, []);

  const counts = useMemo(
    () => ({
      entries: data.entries.length,
      tasks: data.tasks.length,
      habits: data.habits.length,
      notes: data.notes.length,
      checklists: data.checklists.length,
      applications: data.applications.length,
      resume: data.resume ? 1 : 0,
    }),
    [data]
  );

  const totalRecords = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (
    <div className="stack">
      <PageHeader title="Settings" description="Appearance, language, notifications, data controls and privacy." />

      <Card title="Appearance">
        <span className="field-label">Theme</span>
        <Segmented
          label="Theme"
          value={settings.theme}
          onChange={(theme) => void updateSettings({ theme })}
          options={[
            { value: 'system', label: 'Match system' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
        <hr className="divider" />
        <ToggleRow
          label="Reduce motion"
          description="Removes transitions and animations, and also respects your system’s reduced-motion preference automatically."
          checked={settings.reduceMotion}
          onChange={(checked) => void updateSettings({ reduceMotion: checked })}
        />
        <ToggleRow
          label="Larger text"
          description="Increases base text size for easier reading on a small screen."
          checked={settings.largeText}
          onChange={(checked) => void updateSettings({ largeText: checked })}
        />
      </Card>

      <Card title="Language and currency">
        <SelectField
          label="Language"
          hint="Interface text is English in this release. The structure is in place so translations can be added without touching feature code."
          value={settings.language}
          onChange={(event) => void updateSettings({ language: event.target.value })}
          options={[
            { value: 'en', label: 'English' },
            { value: 'hi', label: 'हिन्दी (structure ready, not translated yet)' },
            { value: 'te', label: 'తెలుగు (structure ready, not translated yet)' },
            { value: 'ta', label: 'தமிழ் (structure ready, not translated yet)' },
          ]}
        />
        <SelectField
          label="Currency"
          hint="Used for display only. LIFEKIT performs no currency conversion and has no exchange-rate service."
          value={settings.currency}
          onChange={(event) => void updateSettings({ currency: event.target.value })}
          options={[
            { value: 'INR', label: 'Indian Rupee (₹)' },
            { value: 'USD', label: 'US Dollar ($)' },
            { value: 'EUR', label: 'Euro (€)' },
            { value: 'GBP', label: 'Pound Sterling (£)' },
            { value: 'AUD', label: 'Australian Dollar (A$)' },
            { value: 'CAD', label: 'Canadian Dollar (C$)' },
          ]}
        />
        <SelectField
          label="Date format locale"
          value={settings.locale}
          onChange={(event) => void updateSettings({ locale: event.target.value })}
          options={[
            { value: 'en-IN', label: 'English (India) — 5 Oct 2026' },
            { value: 'en-GB', label: 'English (UK) — 5 Oct 2026' },
            { value: 'en-US', label: 'English (US) — Oct 5, 2026' },
          ]}
        />
        <Segmented
          label="Week starts on"
          value={String(settings.weekStartsOn)}
          onChange={(value) => void updateSettings({ weekStartsOn: Number(value) as 0 | 1 })}
          options={[
            { value: '1', label: 'Monday' },
            { value: '0', label: 'Sunday' },
          ]}
        />
        <TextField
          label="Local profile name (optional)"
          hint="Only used for the greeting on the Home screen. It never leaves this device, and LIFEKIT has no accounts."
          value={settings.displayName}
          maxLength={40}
          onChange={(event) => void updateSettings({ displayName: event.target.value })}
        />
      </Card>

      <Card title="Money defaults">
        <div className="grid grid-2">
          <TextField
            label="Default monthly budget (optional)"
            inputMode="decimal"
            placeholder="0.00"
            value={settings.monthlyBudgetDefault !== null ? String(settings.monthlyBudgetDefault) : ''}
            onChange={(event) => {
              const value = event.target.value.trim();
              void updateSettings({ monthlyBudgetDefault: value === '' ? null : Number(value) });
            }}
          />
          <TextField
            label="Monthly savings target (optional)"
            inputMode="decimal"
            placeholder="0.00"
            value={settings.savingsMonthlyTarget !== null ? String(settings.savingsMonthlyTarget) : ''}
            onChange={(event) => {
              const value = event.target.value.trim();
              void updateSettings({ savingsMonthlyTarget: value === '' ? null : Number(value) });
            }}
          />
        </div>
        <p className="tiny muted" style={{ marginBottom: 0 }}>
          These are reminders to yourself. LIFEKIT never enforces them and never claims a result from meeting or missing them.
        </p>
      </Card>

      <Card title="Notifications" subtitle="Reminders are off until you switch them on">
        <p className="small muted">
          {NOTIFICATION_LIMITATIONS}
        </p>
        <div className="btn-row">
          <Button variant="secondary" icon="bell" onClick={() => navigate(ROUTES.notificationSettings)}>
            Notification settings
          </Button>
          <Button variant="ghost" icon="info" onClick={() => navigate(ROUTES.notifications)}>
            Notification centre
          </Button>
        </div>
      </Card>

      <Card title="Privacy and optional remote content">
        <ToggleRow
          label="Fetch public content from a LIFEKIT server"
          description={defaultContentPackNotice()}
          checked={settings.remoteAnnouncementsEnabled}
          onChange={(checked) => void updateSettings({ remoteAnnouncementsEnabled: checked })}
        />
        <ul className="small">
          <li>This toggle affects public content only: announcements and a reviewed community directory pack.</li>
          <li>It never uploads money records, tasks, notes, résumés or any other personal data. There is no code path that does.</li>
          <li>When off, LIFEKIT makes no network requests beyond loading its own application files.</li>
          <li>There is no analytics, no tracking pixel, no advertising identifier and no third-party script in this app.</li>
        </ul>
        <div className="btn-row">
          <Button variant="ghost" icon="lock" onClick={() => navigate(ROUTES.privacy)}>
            Read the privacy notice
          </Button>
        </div>
      </Card>

      <Card title="Your data on this device" subtitle="Local records only — there is no server copy">
        <div className="grid grid-3">
          <StatTile label="Money entries" value={String(counts.entries)} />
          <StatTile label="Tasks" value={String(counts.tasks)} />
          <StatTile label="Habits" value={String(counts.habits)} />
          <StatTile label="Notes" value={String(counts.notes)} />
          <StatTile label="Checklists" value={String(counts.checklists)} />
          <StatTile label="Applications" value={String(counts.applications)} />
        </div>
        <p className="small muted" style={{ marginTop: 12 }}>
          Storage mode: <strong>{storage.mode === 'indexeddb' ? 'IndexedDB (persistent)' : 'memory only (nothing is saved)'}</strong>
          {usage && usage.usage > 0 ? ` · approximately ${(usage.usage / 1024).toFixed(1)} KB used by this site` : ''}
          {settings.lastBackupAt ? ` · last backup ${new Date(settings.lastBackupAt).toLocaleString()}` : ' · no backup exported yet'}
        </p>
        <div className="btn-row">
          <Button variant="secondary" icon="download" onClick={() => navigate(ROUTES.backup)}>
            Backup and restore
          </Button>
        </div>
      </Card>

      <Card title="Clear data" subtitle="Choose exactly what to remove. Nothing is deleted without confirmation.">
        <div className="btn-row">
          <Button variant="secondary" onClick={() => setConfirmClear('money')}>
            Clear money records
          </Button>
          <Button variant="secondary" onClick={() => setConfirmClear('planner')}>
            Clear planner, habits and notes
          </Button>
          <Button variant="secondary" onClick={() => setConfirmClear('career')}>
            Clear résumé and applications
          </Button>
          <Button variant="secondary" onClick={() => setConfirmClear('learning')}>
            Clear reading progress
          </Button>
          <Button variant="secondary" onClick={() => setConfirmClear('notifications')}>
            Clear notification history
          </Button>
        </div>
        <hr className="divider" />
        <Notice tone="danger" title="Reset the whole application.">
          Removes every LIFEKIT record and resets all settings on this device. Export a backup first if you might want any of it
          back. This cannot be undone, and LIFEKIT has no server copy to restore from.
        </Notice>
        <Button variant="danger" icon="trash" onClick={() => setConfirmReset(true)}>
          Reset LIFEKIT completely
        </Button>
      </Card>

      <Card title="About and legal">
        <div className="btn-row">
          <Button variant="ghost" icon="info" onClick={() => navigate(ROUTES.about)}>
            About LIFEKIT
          </Button>
          <Button variant="ghost" icon="lock" onClick={() => navigate(ROUTES.privacy)}>
            Privacy notice
          </Button>
          <Button variant="ghost" icon="book" onClick={() => navigate(ROUTES.licenses)}>
            Licenses and credits
          </Button>
        </div>
        <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
          {APP_NAME} v{APP_VERSION} · content pack {CONTENT_VERSION} · {totalRecords} local record
          {totalRecords === 1 ? '' : 's'} in this browser.
        </p>
        <p className="footer-credit" style={{ marginTop: 8 }}>
          {DEVELOPER_CREDIT}
        </p>
      </Card>

      <ConfirmDialog
        open={confirmClear !== null}
        title="Clear this data?"
        message={
          <>
            <p>
              This permanently removes{' '}
              {confirmClear === 'money'
                ? 'all money entries, budget limits and savings goals'
                : confirmClear === 'planner'
                  ? 'all tasks, habits, habit history, notes and checklists'
                  : confirmClear === 'career'
                    ? 'your résumé draft and all application records'
                    : confirmClear === 'learning'
                      ? 'your lesson reading progress and bookmarks'
                      : 'the notification history list'}
              .
            </p>
            <p>Settings and other records are not affected. Export a backup first if you are unsure.</p>
          </>
        }
        confirmLabel="Yes, clear it"
        onCancel={() => setConfirmClear(null)}
        onConfirm={async () => {
          if (confirmClear) await clearData(confirmClear);
          setConfirmClear(null);
        }}
      />

      <ConfirmDialog
        open={confirmReset}
        title="Reset LIFEKIT completely?"
        message={
          <p>
            Every money entry, task, habit, note, checklist, résumé, application record and setting will be deleted from this
            browser, and the app will return to its first-run state. There is no server copy and no undo.
          </p>
        }
        confirmLabel="Reset everything"
        requireTyping="RESET"
        onCancel={() => setConfirmReset(false)}
        onConfirm={async () => {
          await resetApp();
          setConfirmReset(false);
        }}
      />
    </div>
  );
}

/* ------------------------------- backup page ------------------------------- */

export function BackupPage(): JSX.Element {
  const { data, settings, prefs, exportBackup, readBackupFile, applyRestore } = useStore();
  const [verification, setVerification] = useState<Awaited<ReturnType<typeof readBackupFile>> | null>(null);
  const [busy, setBusy] = useState(false);
  const storage = storageHealth();
  const backupIntervalLabel = `${prefs.backupEveryDays} days`;

  return (
    <div className="stack">
      <PageHeader
        title="Backup and restore"
        description="Your records live only on this device. A backup file is how you keep your own copy."
        actions={
          <Button variant="accent" icon="download" onClick={() => void exportBackup()}>
            Export backup now
          </Button>
        }
      />

      <Notice tone="warning" title="Local data can be lost.">
        Clearing your browser’s storage, uninstalling the app, using a private browsing window, or losing the phone all remove
        these records permanently. LIFEKIT has no server copy and cannot recover them for you. Export a backup file and keep it
        somewhere safe — a second device, an email to yourself, or a memory card.
      </Notice>

      {!storage.persistent ? (
        <Notice tone="danger" title="Storage is unavailable right now.">
          LIFEKIT is running in memory-only mode, so a backup exported from here may be empty and new entries will not persist.
        </Notice>
      ) : null}

      <div className="grid grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <Card title="What a backup contains">
          <ul className="small">
            <li>{data.entries.length} money entries, budgets and savings goals</li>
            <li>{data.tasks.length} tasks, {data.habits.length} habits and their history</li>
            <li>{data.notes.length} notes and {data.checklists.length} checklists</li>
            <li>{data.applications.length} application records and {data.resume ? 'your résumé draft' : 'no résumé draft yet'}</li>
            <li>Your settings and notification preferences</li>
          </ul>
          <p className="tiny muted" style={{ marginBottom: 0 }}>
            The file is plain JSON. It is readable by anyone who opens it, so keep it private — treat it like a bank statement.
          </p>
        </Card>

        <Card title="Restore from a file">
          <div className="field">
            <label className="field-label" htmlFor="backup-page-file">
              Choose a LIFEKIT backup file (.json)
            </label>
            <input
              id="backup-page-file"
              type="file"
              accept="application/json,.json"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setBusy(true);
                setVerification(await readBackupFile(file));
                setBusy(false);
              }}
            />
          </div>
          {busy ? <p className="small muted">Reading and validating…</p> : null}
          {verification ? (
            <div className={verification.ok ? 'notice' : 'notice notice-danger'} role={verification.ok ? undefined : 'alert'}>
              <div>
                {verification.ok ? (
                  <>
                    <p className="small" style={{ margin: 0 }}>
                      <strong>Verified.</strong> Exported{' '}
                      {verification.exportedAt ? new Date(verification.exportedAt).toLocaleString() : 'unknown date'}
                      {verification.appVersion ? ` · LIFEKIT ${verification.appVersion}` : ''}
                    </p>
                    <ul className="small">
                      {Object.entries(verification.counts)
                        .filter(([, count]) => count > 0)
                        .map(([key, count]) => (
                          <li key={key}>
                            {count} {key}
                          </li>
                        ))}
                    </ul>
                    {verification.warnings.length > 0 ? (
                      <details className="small">
                        <summary>{verification.warnings.length} warning(s)</summary>
                        <ul>
                          {verification.warnings.map((warning, index) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                    <Button
                      variant="danger"
                      icon="upload"
                      onClick={async () => {
                        if (verification.data) {
                          await applyRestore(verification.data);
                          setVerification(null);
                        }
                      }}
                    >
                      Replace this device’s records with the backup
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="small" style={{ margin: 0 }}>
                      <strong>Rejected — nothing was changed.</strong>
                    </p>
                    <ul className="small">
                      {verification.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          ) : null}
          <p className="tiny muted" style={{ marginTop: 12, marginBottom: 0 }}>
            Files are validated record by record before anything is written. Malformed records are reported and skipped, unsafe
            keys are rejected outright, and the whole operation runs offline.
          </p>
        </Card>
      </div>

      <Card title="Reminder schedule">
        <p className="small">
          LIFEKIT can nudge you to export a file, at an interval you choose. That reminder is local, contains no money amounts,
          and never uploads anything.
        </p>
        <div className="grid grid-2">
          <StatTile
            label="Last backup"
            value={settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleDateString() : 'Never'}
            hint={settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleTimeString() : 'Export one now to start the clock'}
          />
          <StatTile label="Reminder interval" value={`${settings.reminderCheckEnabled ? '' : 'Paused · '}${backupIntervalLabel}`} />
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <Button variant="secondary" icon="bell" onClick={() => navigate(ROUTES.notificationSettings)}>
            Change reminder settings
          </Button>
          <Button variant="ghost" icon="download" onClick={() => void exportBackup()}>
            Export a fresh backup
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------- about / privacy / licences ------------------------------- */

export function AboutPage(): JSX.Element {
  const { settings } = useStore();
  // Null in a browser; the Android shell's own details when installed as the Android app.
  const native = isNativeApp() ? nativePlatformInfo() : null;
  return (
    <div className="stack">
      <PageHeader title={`About ${APP_NAME}`} description={APP_TAGLINE} />

      <Card title="What LIFEKIT is">
        <p>
          LIFEKIT is a free, offline-first collection of everyday tools: a manual money record, a daily planner with habits,
          a learning library, a résumé and interview toolkit, digital safety checklists, a reviewed community directory, and a
          set of small utilities such as a calculator and unit converter.
        </p>
        <p>
          It was designed for budget Android phones and slow connections: the whole interface is small, works after one load,
          and never asks you to create an account.
        </p>
      </Card>

      <Card title="What LIFEKIT deliberately does not do">
        <ul className="small">
          <li><strong>No AI.</strong> No chatbot, no AI API, no generated text at runtime. Every word in the lessons was written in advance and reviewed by a person.</li>
          <li><strong>No bank connections.</strong> LIFEKIT cannot read your accounts. It will never ask for a PIN, OTP, password or card number.</li>
          <li><strong>No payments.</strong> There is no payment gateway, subscription, or in-app purchase anywhere in the app.</li>
          <li><strong>No ads and no tracking.</strong> No advertising SDK, no analytics, no third-party scripts.</li>
          <li><strong>No fabricated content.</strong> The community directory ships empty rather than showing organisations we have not verified. There are no invented job listings, statistics or support contacts.</li>
        </ul>
      </Card>

      <Card title="Where this copy runs">
        {native ? (
          <>
            <p>
              This is the <strong>Android app</strong>, version {APP_VERSION}
              {native.versionName && native.versionName !== APP_VERSION ? ` (shell ${native.versionName})` : ''}, running on
              Android API {native.apiLevel}. The whole toolkit is bundled inside the app, so it needs no connection and asks
              for no internet permission at all — the app on this device cannot reach the network even if something tried.
            </p>
            <ul className="small">
              <li>Your records are stored in this app's own private storage, not in a browser on this phone.</li>
              <li>Exports (CSV and backup files) are saved to <strong>Downloads/{native.downloadFolder}</strong> and can then be shared with any app you choose.</li>
              <li>Reminders are shown as Android notifications. Android may still delay them in battery-saver mode; nothing is lost, because the reminder stays in the in-app list.</li>
              <li>Uninstalling the app deletes its storage, so export a backup file before you uninstall or move to a new phone.</li>
            </ul>
          </>
        ) : (
          <p>
            This is the <strong>web app</strong>, opened in a browser. Installing it to your home screen (or using the Android
            app from the same build) gives the same toolkit with system notifications and exports saved to Downloads. Records
            made in a browser and records made in the Android app are separate; a backup file is the way to move between them.
          </p>
        )}
      </Card>

      <Card title="Versions and content">
        <div className="grid grid-2">
          <StatTile label="Application version" value={APP_VERSION} />
          <StatTile label="Bundled content pack" value={CONTENT_VERSION} />
          <StatTile label="Lessons in the library" value={String(LESSONS.length)} />
          <StatTile label="Interview questions" value={String(INTERVIEW_QUESTIONS.length)} />
        </div>
        <p className="small muted" style={{ marginTop: 12 }}>
          Safety information last reviewed {formatDate(SAFETY_REVIEWED_ON, 'long', settings.locale)}. Reporting channels were
          checked against the organisations’ own websites on that date; details can change, so confirm before relying on them.
        </p>
      </Card>

      <Card title="Honest limitations">
        <ul className="small">
          <li>Local reminders depend on the app being open and on browser behaviour you do not control. There is no guaranteed background delivery.</li>
          <li>Local storage is not encrypted by LIFEKIT. Anyone with access to your unlocked device and browser can open the app and read your records.</li>
          <li>The community directory contains no verified organisations until someone reviews and publishes one.</li>
          <li>No security audit has been performed on this codebase. It is written carefully, but "careful" is not the same as "audited".</li>
          <li>License compliance has been checked for the dependencies listed in the licenses page, but that reduces risk rather than eliminating it, and it is not legal advice.</li>
        </ul>
      </Card>

      <Card title="Credits">
        <p className="footer-credit" style={{ fontSize: '1.05rem' }}>
          {DEVELOPER_CREDIT}
        </p>
        <p className="small muted">
          LIFEKIT branding, logo mark, user interface, written lessons and safety content are original work created for this
          project. Open-source components are credited on the{' '}
          <a href={`#${ROUTES.licenses}`}>licenses page</a>.
        </p>
      </Card>
    </div>
  );
}

export function PrivacyPage(): JSX.Element {
  const { settings, storage } = useStore();
  return (
    <div className="stack">
      <PageHeader title="Privacy notice" description="Written in plain language, and current for version 1.0.1." />

      <Card title="The short version">
        <ul className="small">
          <li>LIFEKIT collects nothing about you. There is no account, no email, no phone number, no analytics.</li>
          <li>Your records are stored in this browser on this device and are never uploaded.</li>
          <li>There is one optional network feature — fetching public content — and it is off until you enable it.</li>
          <li>You can export everything as a file, and delete everything with two clicks and a confirmation.</li>
        </ul>
      </Card>

      <Card title="What is stored, and where">
        <div className="table-wrap">
          <table>
            <caption className="visually-hidden">Data LIFEKIT stores locally</caption>
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Where</th>
                <th scope="col">Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Money entries, budgets, savings goals</td>
                <td>This device (IndexedDB)</td>
                <td>Your own record of income and expenses</td>
              </tr>
              <tr>
                <td>Tasks, habits, notes, checklists</td>
                <td>This device (IndexedDB)</td>
                <td>Planning and tracking you asked for</td>
              </tr>
              <tr>
                <td>Résumé draft, application tracker</td>
                <td>This device (IndexedDB)</td>
                <td>Documents and follow-ups you create</td>
              </tr>
              <tr>
                <td>Settings, notification preferences</td>
                <td>This device (local storage)</td>
                <td>Remembering your choices</td>
              </tr>
              <tr>
                <td>Learning progress, directory drafts and reports</td>
                <td>This device (IndexedDB / local storage)</td>
                <td>Continuing where you left off</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 12 }}>
          Storage is <strong>{storage.mode === 'indexeddb' ? 'working normally' : 'unavailable in this context (memory-only mode)'}</strong>.
        </p>
      </Card>

      <Card title="What leaves your device">
        <ul className="small">
          <li>
            <strong>Nothing, by default.</strong> Loading the app fetches its own files from the host. No data about you is
            attached to those requests.
          </li>
          <li>
            <strong>Optional public content.</strong> If you enable it, LIFEKIT requests a public announcements file and a
            reviewed directory file from the same host. No identifier, no account and no personal record is included, and the
            request carries no query about you.
          </li>
          <li>
            <strong>Links you choose to open.</strong> Tapping a third-party link (for example a reporting portal or a source for
            further reading) leaves the app and the destination site sees what any website would see. LIFEKIT does not pass your
            data to it.
          </li>
          <li>
            <strong>Your exports.</strong> A backup or CSV file is written by your browser to your device. If you email it to
            yourself or store it in the cloud, that is your decision and it is outside LIFEKIT.
          </li>
        </ul>
      </Card>

      <Card title="Third parties, permissions and tracking">
        <ul className="small">
          <li>No advertising network, no analytics library, no social plug-in, no pixel, no third-party script of any kind.</li>
          <li>No cookies are set. The app uses local storage and IndexedDB only, which never leave the device on their own.</li>
          <li>
            The only permission LIFEKIT asks for is <strong>notifications</strong>, and only after you switch reminders on. Even
            then, denying it costs you nothing except the pop-up: reminders still appear inside the app.
          </li>
          <li>
            LIFEKIT does not request location, camera, microphone, contacts, SMS, calendars, files, or any banking permission,
            because no feature needs them.
          </li>
        </ul>
      </Card>

      <Card title="Shared and lost devices">
        <ul className="small">
          <li>Anyone who can open this browser profile on an unlocked device can read your LIFEKIT records. There is no separate app passcode.</li>
          <li>On a shared phone or computer, use your own browser profile, or clear LIFEKIT data after use from Settings.</li>
          <li>Browser data may be included in device backups or shared profiles, depending on the platform.</li>
          <li>If you use a public or library computer, export nothing and clear the data when you finish.</li>
        </ul>
      </Card>

      <Card title="Your controls">
        <ul className="small">
          <li><strong>Export:</strong> Settings → Backup and restore writes a complete JSON file.</li>
          <li><strong>Delete selectively:</strong> Settings → Clear data removes one category at a time.</li>
          <li><strong>Delete everything:</strong> Settings → Reset LIFEKIT removes all records and settings, confirmed by typing RESET.</li>
          <li><strong>Stop local storage entirely:</strong> clearing site data in your browser settings does the same thing from outside the app.</li>
        </ul>
        <p className="tiny muted" style={{ marginBottom: 0 }}>
          Because there is no account and no server copy, LIFEKIT cannot recover deleted data for you — and equally, LIFEKIT
          cannot hand your data to anyone else, because it never had it. Last updated {formatDate('2026-10-11', 'long', settings.locale)}.
        </p>
      </Card>
    </div>
  );
}

export function LicensesPage(): JSX.Element {
  const { settings } = useStore();
  return (
    <div className="stack">
      <PageHeader
        title="Licenses and credits"
        description="What LIFEKIT is built from, and under what terms."
      />

      <Card title="LIFEKIT itself">
        <p>
          LIFEKIT’s source code, visual design, logo mark, user interface text, lessons, interview question bank, safety content
          and documentation are original work created for this project and licensed under the <strong>MIT License</strong>. The
          copyright line in the source reads <em>Developed by Benny</em>.
        </p>
        <p className="small muted">
          You may use, modify and redistribute the project under the MIT terms, which require that the copyright notice and
          licence text are kept with substantial portions of the software. This page is a plain-language summary, not legal
          advice.
        </p>
      </Card>

      <Card title="Bundled dependencies" subtitle="Every runtime and build dependency, with the license it ships under">
        <div className="table-wrap">
          <table>
            <caption className="visually-hidden">Third-party dependency license inventory</caption>
            <thead>
              <tr>
                <th scope="col">Component</th>
                <th scope="col">Version</th>
                <th scope="col">License</th>
                <th scope="col">Used for</th>
              </tr>
            </thead>
            <tbody>
              {PROJECT_LICENSES.map((row) => (
                <tr key={row.name}>
                  <td>
                    {row.url ? (
                      <a href={row.url} target="_blank" rel="noopener noreferrer external">
                        {row.name}
                      </a>
                    ) : (
                      row.name
                    )}
                  </td>
                  <td className="nowrap">{row.version}</td>
                  <td>
                    <Badge tone={row.scope === 'runtime' ? 'accent' : 'neutral'}>{row.license}</Badge>
                    <div className="tiny muted">{row.scope}</div>
                  </td>
                  <td className="small">{row.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="tiny muted" style={{ marginTop: 12, marginBottom: 0 }}>
          Full license texts are included in the repository in <code>THIRD_PARTY_LICENSES.md</code> and in each package’s own
          distribution. No dependency was chosen for analytics, advertising, tracking or AI, because LIFEKIT uses none of those.
        </p>
      </Card>

      <Card title="Content and assets">
        <ul className="small">
          <li>The LIFEKIT logo mark, icons and the application interface are original and created for this project.</li>
          <li>All lessons, checklists, résumé tips and interview questions were written for LIFEKIT. No book, article, course or proprietary template was copied.</li>
          <li>External links point to third-party sites so you can read the original source there. LIFEKIT does not rehost, scrape or redistribute third-party content.</li>
          <li>Reporting-channel details were checked against official government websites on the date shown in the safety centre. Names are used descriptively; LIFEKIT is not affiliated with, endorsed by or acting for any of those organisations.</li>
          <li>No trademarked logo or brand asset from another product is used anywhere in LIFEKIT.</li>
        </ul>
      </Card>

      <Card title="Honest statement on compliance">
        <p className="small">
          Dependency licenses were reviewed and are permissive for this use, and every asset in the app is either original or a
          link to its origin. That reduces legal risk; it is not a legal guarantee, and it is not a substitute for advice from a
          qualified professional if you plan to distribute LIFEKIT commercially.
        </p>
        <p className="tiny muted" style={{ marginBottom: 0 }}>
          Summary generated for version {APP_VERSION} on {formatDate('2026-10-11', 'long', settings.locale)}.
        </p>
      </Card>
    </div>
  );
}
