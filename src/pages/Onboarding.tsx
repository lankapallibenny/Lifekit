/**
 * First-run onboarding.
 *
 * The point of this screen is honesty plus orientation: what LIFEKIT does, what it
 * deliberately does not do, and the one risk the user must understand before entering
 * real records (local storage can be cleared). There is no account, no permission
 * request and no sign-up — the only optional field is a local display name.
 */
import { useState } from 'react';
import { Button, Card, CheckboxRow, Notice, TextField } from '../components/ui';
import { Icon } from '../components/Icons';
import { APP_NAME, APP_TAGLINE, DEVELOPER_CREDIT } from '../lib/defaults';

const STEPS = [
  {
    title: 'It is a toolkit, not a service',
    body: 'Money records, tasks, a study planner, habits, learning lessons, a résumé builder, safety checklists and offline utilities. Everything is built in; nothing is downloaded from a server to work.',
  },
  {
    title: 'Your records stay on this device',
    body: 'Money entries, tasks and notes are stored in this browser’s own storage. LIFEKIT has no server for personal data, no account, and no analytics. Because of that, the local copy is the only copy — clearing browser data, uninstalling, or losing the phone will remove it. Exporting a backup from Settings is the way to protect yourself.',
  },
  {
    title: 'No AI, no bank linking, no ads',
    body: 'LIFEKIT never connects to a bank, never asks for a card PIN, OTP or password, never sends your records anywhere, and contains no advertising or tracking code. Reminders are scheduled locally on your device.',
  },
  {
    title: 'Start small',
    body: 'The most useful first step is one week of money entries and three tasks in the planner. Empty screens will stay empty until you add something — there is no sample data pretending to be yours.',
  },
];

export function Onboarding({ onDone }: { onDone: (displayName: string) => void | Promise<void> }): JSX.Element {
  const [displayName, setDisplayName] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="stack" style={{ maxWidth: 640, margin: '0 auto' }}>
      <Card>
        <div style={{ textAlign: 'center', paddingBottom: 8 }}>
          <h1 style={{ marginBottom: 4 }}>{APP_NAME}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {APP_TAGLINE}
          </p>
        </div>
        <Notice tone="info" title="Free, offline-first and account-free.">
          Everything in this release works without an internet connection after the first load, and without giving LIFEKIT
          anything about you.
        </Notice>

        <div style={{ marginTop: 'var(--space-4)' }}>
          {STEPS.map((step, index) => (
            <div className="onboard-step" key={step.title}>
              <span className="step-number" aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <h3 style={{ marginBottom: 2 }}>{step.title}</h3>
                <p className="small muted" style={{ margin: 0 }}>
                  {step.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Before you start">
        <TextField
          label="What should LIFEKIT call you? (optional)"
          hint="Stored only on this device and used for the greeting on the Home screen. Leave it blank if you prefer."
          value={displayName}
          maxLength={40}
          autoComplete="off"
          onChange={(event) => setDisplayName(event.target.value)}
        />
        <CheckboxRow
          checked={acknowledged}
          onChange={setAcknowledged}
          label="I understand that my records live in this browser’s storage, and that I should export backups."
          description="LIFEKIT cannot recover data from a cleared browser or a lost phone. Backups are a manual file you keep."
        />
        <div className="btn-row" style={{ marginTop: 'var(--space-3)' }}>
          <Button
            variant="accent"
            icon="check"
            disabled={!acknowledged || busy}
            onClick={async () => {
              setBusy(true);
              await onDone(displayName.trim());
            }}
          >
            {busy ? 'Preparing…' : 'Start using LIFEKIT'}
          </Button>
        </div>
        <p className="tiny muted" style={{ marginTop: 'var(--space-3)' }}>
          No email, phone number or password is ever requested. Notifications are off until you switch them on yourself,
          and the app will not ask for permission during this setup. {DEVELOPER_CREDIT}{' '}
          <Icon name="sparkle" size={14} style={{ verticalAlign: '-2px' }} />
        </p>
      </Card>
    </div>
  );
}
