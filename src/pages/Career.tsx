/**
 * LIFEKIT Career & Résumé Toolkit.
 *
 * Everything here is a personal draft the user owns: the résumé, the application tracker
 * and interview notes are all local. LIFEKIT does not list jobs, does not contact
 * employers, does not verify recruiters, and does not guarantee any outcome.
 * PDF export uses the browser's own print-to-PDF, which needs no library and works offline.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ExternalLink,
  IconButton,
  Notice,
  PageHeader,
  SelectField,
  TextAreaField,
  TextField,
} from '../components/ui';
import { Icon } from '../components/Icons';
import { useStore } from '../state/store';
import {
  CAREER_DISCLAIMER,
  INTERVIEW_QUESTIONS,
  JOB_RESOURCES,
  RESUME_TIPS,
} from '../content/career';
import { cleanMultiline, cleanText, createId, downloadBlob } from '../lib/shared';
import { formatDate, relativeDayLabel, todayISO } from '../lib/dates';
import { sanitizeResume } from '../lib/backup';
import type { ApplicationStatus, JobApplication, Resume } from '../lib/models';
import { ROUTES } from '../router';

type Tab = 'resume' | 'interview' | 'tracker' | 'resources';

const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: 'saved', label: 'Saved' },
  { value: 'applied', label: 'Applied' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

const STATUS_TONE: Record<ApplicationStatus, 'neutral' | 'info' | 'accent' | 'warning' | 'danger'> = {
  saved: 'neutral',
  applied: 'info',
  interview: 'accent',
  offer: 'accent',
  rejected: 'danger',
  withdrawn: 'warning',
};

function emptyResume(): Resume {
  return sanitizeResume({});
}

/* ------------------------------- résumé ------------------------------- */

function ResumeEditor(): JSX.Element {
  const { data, saveResume, notify } = useStore();
  const [draft, setDraft] = useState<Resume>(() => data.resume ?? emptyResume());
  const [savedAt, setSavedAt] = useState<string | null>(data.resume?.updatedAt ?? null);

  useEffect(() => {
    if (data.resume) setDraft(data.resume);
  }, [data.resume]);

  const persist = async (next: Resume, message = 'Résumé draft saved on this device.') => {
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    setDraft(stamped);
    await saveResume(stamped);
    setSavedAt(stamped.updatedAt);
    notify(message, 'success');
  };

  const update = <K extends keyof Resume>(key: K, value: Resume[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const completeness = useMemo(() => {
    const checks: { label: string; done: boolean }[] = [
      { label: 'Name', done: draft.fullName.trim().length > 1 },
      { label: 'Headline', done: draft.headline.trim().length > 3 },
      { label: 'Contact (email or phone)', done: Boolean(draft.email.trim() || draft.phone.trim()) },
      { label: 'Summary', done: draft.summary.trim().length > 40 },
      { label: 'At least one education entry', done: draft.education.some((e) => e.qualification.trim()) },
      { label: 'At least one skill group', done: draft.skills.some((s) => s.items.trim()) },
      { label: 'Experience or a project', done: draft.experience.some((e) => e.role.trim()) || draft.projects.some((p) => p.name.trim()) },
    ];
    const done = checks.filter((c) => c.done).length;
    return { checks, done, percent: Math.round((done / checks.length) * 100) };
  }, [draft]);

  const emailInvalid = draft.email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(draft.email.trim());

  return (
    <div className="stack">
      <Notice tone="info" title="Written on your device, never uploaded.">
        The résumé draft is stored in this browser. Use the print or PDF button to produce a document — your browser generates
        it locally, so nothing is sent to a conversion service.
      </Notice>

      <Card title="Your details" subtitle="Saved automatically when you press Save draft">
        <div className="grid grid-2">
          <TextField label="Full name" value={draft.fullName} maxLength={120} onChange={(e) => update('fullName', e.target.value)} />
          <TextField
            label="Headline"
            hint="For example: Accounts assistant · 2 years · reconciliation and reporting"
            value={draft.headline}
            maxLength={160}
            onChange={(e) => update('headline', e.target.value)}
          />
          <TextField
            label="Email"
            type="email"
            value={draft.email}
            error={emailInvalid ? 'That does not look like a valid email address.' : null}
            maxLength={160}
            onChange={(e) => update('email', e.target.value)}
          />
          <TextField label="Phone" value={draft.phone} maxLength={40} onChange={(e) => update('phone', e.target.value)} />
          <TextField label="Location" value={draft.location} maxLength={120} onChange={(e) => update('location', e.target.value)} />
          <TextField
            label="Links (one per line)"
            hint="Portfolio, GitHub, LinkedIn — only if they are up to date."
            value={draft.links}
            onChange={(e) => update('links', e.target.value)}
          />
        </div>
        <TextAreaField
          label="Professional summary"
          hint="Three or four lines. What you do, what you are good at, what you want next."
          value={draft.summary}
          maxLength={1200}
          onChange={(e) => update('summary', e.target.value)}
        />
      </Card>

      <Card title="Education">
        {draft.education.map((item, index) => (
          <div className="card" key={item.id} style={{ boxShadow: 'none', marginBottom: 12 }}>
            <div className="grid grid-2">
              <TextField
                label="Qualification"
                value={item.qualification}
                onChange={(e) => {
                  const next = [...draft.education];
                  next[index] = { ...item, qualification: e.target.value };
                  update('education', next);
                }}
              />
              <TextField
                label="Institution"
                value={item.institution}
                onChange={(e) => {
                  const next = [...draft.education];
                  next[index] = { ...item, institution: e.target.value };
                  update('education', next);
                }}
              />
              <TextField
                label="Location"
                value={item.location ?? ''}
                onChange={(e) => {
                  const next = [...draft.education];
                  next[index] = { ...item, location: e.target.value };
                  update('education', next);
                }}
              />
              <TextField
                label="Start year"
                inputMode="numeric"
                placeholder="2019"
                value={item.startYear ?? ''}
                onChange={(e) => {
                  const next = [...draft.education];
                  next[index] = { ...item, startYear: e.target.value };
                  update('education', next);
                }}
              />
              <TextField
                label="End year"
                inputMode="numeric"
                placeholder="2022"
                value={item.endYear ?? ''}
                onChange={(e) => {
                  const next = [...draft.education];
                  next[index] = { ...item, endYear: e.target.value };
                  update('education', next);
                }}
              />
              <TextField
                label="Grade or percentage (optional)"
                value={item.grade ?? ''}
                onChange={(e) => {
                  const next = [...draft.education];
                  next[index] = { ...item, grade: e.target.value };
                  update('education', next);
                }}
              />
            </div>
            <Button
              size="sm"
              variant="ghost"
              icon="trash"
              onClick={() => update('education', draft.education.filter((row) => row.id !== item.id))}
            >
              Remove this entry
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="secondary"
          icon="plus"
          onClick={() => update('education', [...draft.education, { id: createId('edu'), qualification: '', institution: '', location: '', startYear: '', endYear: '', grade: '' }])}
        >
          Add education
        </Button>
      </Card>

      <Card title="Experience">
        {draft.experience.length === 0 ? (
          <p className="small muted">
            No experience yet? Leave this empty and use the Projects section instead — internships, volunteering and coursework
            count.
          </p>
        ) : null}
        {draft.experience.map((item, index) => (
          <div className="card" key={item.id} style={{ boxShadow: 'none', marginBottom: 12 }}>
            <div className="grid grid-2">
              <TextField
                label="Role"
                value={item.role}
                onChange={(e) => {
                  const next = [...draft.experience];
                  next[index] = { ...item, role: e.target.value };
                  update('experience', next);
                }}
              />
              <TextField
                label="Organisation"
                value={item.organisation}
                onChange={(e) => {
                  const next = [...draft.experience];
                  next[index] = { ...item, organisation: e.target.value };
                  update('experience', next);
                }}
              />
              <TextField
                label="Start"
                placeholder="Jan 2024"
                value={item.startDate ?? ''}
                onChange={(e) => {
                  const next = [...draft.experience];
                  next[index] = { ...item, startDate: e.target.value };
                  update('experience', next);
                }}
              />
              <TextField
                label="End (blank if current)"
                placeholder="Present"
                value={item.endDate ?? ''}
                onChange={(e) => {
                  const next = [...draft.experience];
                  next[index] = { ...item, endDate: e.target.value, current: e.target.value.trim() === '' };
                  update('experience', next);
                }}
              />
            </div>
            <TextAreaField
              label="Achievements"
              hint="One bullet per line. Start with a verb and add a number where you honestly can."
              value={item.bullets}
              onChange={(e) => {
                const next = [...draft.experience];
                next[index] = { ...item, bullets: e.target.value };
                update('experience', next);
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              icon="trash"
              onClick={() => update('experience', draft.experience.filter((row) => row.id !== item.id))}
            >
              Remove this entry
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="secondary"
          icon="plus"
          onClick={() =>
            update('experience', [
              ...draft.experience,
              { id: createId('exp'), role: '', organisation: '', location: '', startDate: '', endDate: '', current: true, bullets: '' },
            ])
          }
        >
          Add experience
        </Button>
      </Card>

      <Card title="Projects">
        {draft.projects.map((item, index) => (
          <div className="card" key={item.id} style={{ boxShadow: 'none', marginBottom: 12 }}>
            <TextField
              label="Project name"
              value={item.name}
              onChange={(e) => {
                const next = [...draft.projects];
                next[index] = { ...item, name: e.target.value };
                update('projects', next);
              }}
            />
            <TextAreaField
              label="What it does and what you did"
              value={item.description}
              onChange={(e) => {
                const next = [...draft.projects];
                next[index] = { ...item, description: e.target.value };
                update('projects', next);
              }}
            />
            <TextField
              label="Link (optional)"
              type="url"
              placeholder="https://"
              value={item.link ?? ''}
              error={item.link && !/^https?:\/\//i.test(item.link) ? 'Links must start with http:// or https://' : null}
              onChange={(e) => {
                const next = [...draft.projects];
                next[index] = { ...item, link: e.target.value };
                update('projects', next);
              }}
            />
            <Button size="sm" variant="ghost" icon="trash" onClick={() => update('projects', draft.projects.filter((row) => row.id !== item.id))}>
              Remove this project
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="secondary"
          icon="plus"
          onClick={() => update('projects', [...draft.projects, { id: createId('prj'), name: '', description: '', link: '' }])}
        >
          Add project
        </Button>
      </Card>

      <Card title="Skills, languages and certifications">
        {draft.skills.map((group, index) => (
          <div className="grid grid-2" key={group.id} style={{ marginBottom: 8 }}>
            <TextField
              label="Skill group"
              placeholder="e.g. Accounting software"
              value={group.label}
              onChange={(e) => {
                const next = [...draft.skills];
                next[index] = { ...group, label: e.target.value };
                update('skills', next);
              }}
            />
            <TextField
              label="Skills (comma separated)"
              value={group.items}
              onChange={(e) => {
                const next = [...draft.skills];
                next[index] = { ...group, items: e.target.value };
                update('skills', next);
              }}
            />
          </div>
        ))}
        <div className="btn-row">
          <Button
            size="sm"
            variant="secondary"
            icon="plus"
            onClick={() => update('skills', [...draft.skills, { id: createId('skl'), label: '', items: '' }])}
          >
            Add skill group
          </Button>
          {draft.skills.length > 0 ? (
            <Button size="sm" variant="ghost" icon="trash" onClick={() => update('skills', draft.skills.slice(0, -1))}>
              Remove last group
            </Button>
          ) : null}
        </div>
        <div style={{ marginTop: 12 }}>
          <TextField label="Languages" value={draft.languages} onChange={(e) => update('languages', e.target.value)} />
          <TextAreaField
            label="Certifications (one per line)"
            value={draft.certifications}
            onChange={(e) => update('certifications', e.target.value)}
          />
        </div>
      </Card>

      <Card title="Draft quality" subtitle={`${completeness.done} of ${completeness.checks.length} sections started`}>
        <ul className="list">
          {completeness.checks.map((check) => (
            <li className="list-item" key={check.label} style={{ padding: '6px 0' }}>
              <Icon name={check.done ? 'check' : 'close'} size={18} style={{ color: check.done ? 'var(--accent)' : 'var(--text-muted)' }} />
              <span className="small grow">{check.label}</span>
              <span className="tiny muted">{check.done ? 'Ready' : 'Missing'}</span>
            </li>
          ))}
        </ul>
        <hr className="divider" />
        <ul className="small">
          {RESUME_TIPS.slice(0, 5).map((tip) => (
            <li key={tip} style={{ marginBottom: 4 }}>
              {tip}
            </li>
          ))}
        </ul>
      </Card>

      <div className="btn-row no-print">
        <Button variant="accent" icon="check" onClick={() => void persist(draft)}>
          Save draft
        </Button>
        <Button variant="secondary" icon="print" onClick={() => window.print()}>
          Print / Save as PDF
        </Button>
        <Button
          variant="ghost"
          icon="download"
          onClick={() =>
            downloadBlob(
              `lifekit-resume-${todayISO()}.json`,
              new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' })
            )
          }
        >
          Export draft as JSON
        </Button>
        {savedAt ? (
          <span className="small muted" style={{ alignSelf: 'center' }}>
            Last saved {new Date(savedAt).toLocaleString()}
          </span>
        ) : null}
      </div>

      <Card title="Print preview" subtitle="Exactly what the browser will print" className="resume-preview">
        <h2 style={{ marginBottom: 2 }}>{draft.fullName || 'Your name'}</h2>
        <p style={{ margin: 0, fontWeight: 600 }}>{draft.headline || 'Your headline'}</p>
        <p className="entry-meta" style={{ marginTop: 4 }}>
          {[draft.email, draft.phone, draft.location].filter(Boolean).join(' · ')}
        </p>
        {draft.links
          .split('\n')
          .map((link) => link.trim())
          .filter(Boolean)
          .map((link) => (
            <p key={link} className="entry-meta" style={{ margin: '2px 0' }}>
              {link}
            </p>
          ))}

        {draft.summary ? (
          <>
            <div className="resume-heading">Profile</div>
            <p>{draft.summary}</p>
          </>
        ) : null}

        {draft.experience.length > 0 ? (
          <>
            <div className="resume-heading">Experience</div>
            {draft.experience.map((item) => (
              <div key={item.id} style={{ marginBottom: 10 }}>
                <div className="entry-title">{item.role || 'Role'}</div>
                <div className="entry-meta">
                  {[item.organisation, item.location, `${item.startDate ?? ''}${item.current ? ' – Present' : item.endDate ? ` – ${item.endDate}` : ''}`]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                <ul>
                  {item.bullets
                    .split('\n')
                    .map((line) => line.replace(/^[-•]\s*/, '').trim())
                    .filter(Boolean)
                    .map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                </ul>
              </div>
            ))}
          </>
        ) : null}

        {draft.projects.length > 0 ? (
          <>
            <div className="resume-heading">Projects</div>
            {draft.projects.map((item) => (
              <div key={item.id} style={{ marginBottom: 8 }}>
                <div className="entry-title">{item.name || 'Project'}</div>
                <p style={{ margin: 0 }}>{item.description}</p>
                {item.link ? <p className="entry-meta" style={{ margin: 0 }}>{item.link}</p> : null}
              </div>
            ))}
          </>
        ) : null}

        {draft.education.length > 0 ? (
          <>
            <div className="resume-heading">Education</div>
            {draft.education.map((item) => (
              <div key={item.id} style={{ marginBottom: 8 }}>
                <div className="entry-title">{item.qualification || 'Qualification'}</div>
                <div className="entry-meta">
                  {[item.institution, item.location, `${item.startYear ?? ''}${item.endYear ? ` – ${item.endYear}` : ''}`, item.grade]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
            ))}
          </>
        ) : null}

        {draft.skills.length > 0 ? (
          <>
            <div className="resume-heading">Skills</div>
            {draft.skills.map((group) => (
              <p key={group.id} style={{ margin: '2px 0' }}>
                <strong>{group.label}:</strong> {group.items}
              </p>
            ))}
          </>
        ) : null}

        {draft.languages ? (
          <>
            <div className="resume-heading">Languages</div>
            <p>{draft.languages}</p>
          </>
        ) : null}

        {draft.certifications ? (
          <>
            <div className="resume-heading">Certifications</div>
            <ul>
              {draft.certifications
                .split('\n')
                .filter(Boolean)
                .map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
            </ul>
          </>
        ) : null}
      </Card>
    </div>
  );
}

/* ------------------------------- interview ------------------------------- */

function InterviewPractice(): JSX.Element {
  const [category, setCategory] = useState<'all' | 'general' | 'behavioural' | 'technical' | 'fresh' | 'closing'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const questions = INTERVIEW_QUESTIONS.filter((q) => (category === 'all' ? true : q.category === category));

  return (
    <div className="stack">
      <Notice tone="info" title="Human-written examples, not scripts.">
        Each sample answer shows one way to structure a response. Rewrite it in your own words and only state facts you can
        support. LIFEKIT does not know what any particular employer wants to hear.
      </Notice>

      <Card title="Question bank" subtitle={`${questions.length} questions`}>
        <div className="toolbar" style={{ marginBottom: 'var(--space-3)' }}>
          <SelectField
            label="Category"
            value={category}
            onChange={(event) => setCategory(event.target.value as typeof category)}
            options={[
              { value: 'all', label: 'All categories' },
              { value: 'general', label: 'General' },
              { value: 'behavioural', label: 'Behavioural' },
              { value: 'technical', label: 'Technical / role' },
              { value: 'fresh', label: 'First job' },
              { value: 'closing', label: 'Closing the interview' },
            ]}
          />
          <Button variant="ghost" icon="repeat" onClick={() => { setRevealed(new Set()); setOpen(null); }}>
            Reset reveals
          </Button>
        </div>

        <ul className="list">
          {questions.map((question) => {
            const isOpen = open === question.id;
            const showAnswer = revealed.has(question.id);
            return (
              <li className="list-item" key={question.id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <button
                  type="button"
                  className="row-between"
                  style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left', color: 'inherit', font: 'inherit' }}
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : question.id)}
                >
                  <span style={{ fontWeight: 600 }}>{question.question}</span>
                  <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={20} />
                </button>
                <div className="tiny muted" style={{ marginTop: 4 }}>
                  <Badge>{question.category}</Badge>
                </div>
                {isOpen ? (
                  <div style={{ marginTop: 10 }}>
                    <h4>How to approach it</h4>
                    <p className="small">{question.approach}</p>
                    <h4>Avoid</h4>
                    <p className="small">{question.avoid}</p>
                    {showAnswer ? (
                      <>
                        <h4>Sample answer</h4>
                        <p className="small" style={{ whiteSpace: 'pre-line' }}>
                          {question.sampleAnswer}
                        </p>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon="info"
                        onClick={() => setRevealed(new Set([...revealed, question.id]))}
                      >
                        Read the sample answer
                      </Button>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className="tiny muted" style={{ marginTop: 12, marginBottom: 0 }}>
          Practise out loud and time yourself at around 90 seconds per answer. {CAREER_DISCLAIMER}
        </p>
      </Card>
    </div>
  );
}

/* ------------------------------- tracker ------------------------------- */

function ApplicationTracker(): JSX.Element {
  const { data, saveApplication, deleteApplication, notify } = useStore();
  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<JobApplication | null>(null);
  const [form, setForm] = useState({
    id: '',
    role: '',
    organisation: '',
    location: '',
    link: '',
    status: 'saved' as ApplicationStatus,
    appliedDate: '',
    nextFollowUp: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const save = async () => {
    const next: Record<string, string | null> = {};
    if (form.role.trim().length === 0 && form.organisation.trim().length === 0) {
      next.role = 'Enter at least a role or an organisation.';
    }
    if (form.link.trim() !== '' && !/^https?:\/\/[^\s]+$/i.test(form.link.trim())) {
      next.link = 'Links must start with http:// or https://';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const now = new Date().toISOString();
    const existing = data.applications.find((a) => a.id === form.id);
    await saveApplication({
      id: form.id || createId('app'),
      role: cleanText(form.role, 120) || 'Untitled role',
      organisation: cleanText(form.organisation, 120),
      location: cleanText(form.location, 120),
      link: form.link.trim(),
      status: form.status,
      appliedDate: form.appliedDate || null,
      nextFollowUp: form.nextFollowUp || null,
      notes: cleanMultiline(form.notes, 4000),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    notify(existing ? 'Application updated.' : 'Application saved locally.', 'success');
    setOpen(false);
  };

  const upcoming = data.applications
    .filter((a) => a.nextFollowUp && new Date(a.nextFollowUp) >= new Date(todayISO()))
    .sort((a, b) => (a.nextFollowUp ?? '').localeCompare(b.nextFollowUp ?? ''));

  const counts = STATUS_OPTIONS.map((option) => ({
    ...option,
    count: data.applications.filter((a) => a.status === option.value).length,
  }));

  return (
    <div className="stack">
      <Notice tone="info" title="Your own records, and nothing more.">
        LIFEKIT does not list jobs, does not contact employers on your behalf, and cannot verify a recruiter or a vacancy. If
        an “employer” asks you for a fee, an OTP or your bank details, treat it as fraud — see the Safety centre.
      </Notice>

      <Card
        title="Applications"
        subtitle={`${data.applications.length} tracked`}
        actions={
          <Button
            size="sm"
            variant="accent"
            icon="plus"
            onClick={() => {
              setForm({ id: '', role: '', organisation: '', location: '', link: '', status: 'saved', appliedDate: '', nextFollowUp: '', notes: '' });
              setOpen(true);
            }}
          >
            Add application
          </Button>
        }
      >
        <div className="row wrap" style={{ gap: 8, marginBottom: 'var(--space-3)' }}>
          {counts.map((count) => (
            <Badge key={count.value} tone={count.count > 0 ? STATUS_TONE[count.value] : 'neutral'}>
              {count.label}: {count.count}
            </Badge>
          ))}
        </div>

        {upcoming.length > 0 ? (
          <Notice tone="warning" title="Follow-ups coming up">
            {upcoming
              .slice(0, 3)
              .map((a) => `${a.role}${a.organisation ? ` at ${a.organisation}` : ''} — ${relativeDayLabel(a.nextFollowUp as string)}`)
              .join(' · ')}
          </Notice>
        ) : null}

        {data.applications.length === 0 ? (
          <EmptyState icon="briefcase" title="No applications tracked yet" action={<Button variant="secondary" icon="plus" onClick={() => setOpen(true)}>Add the first one</Button>}>
            Tracking is most useful once you are applying regularly: it keeps follow-up dates from slipping and gives you a
            record of what you sent to whom.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <caption className="visually-hidden">Job applications you are tracking</caption>
              <thead>
                <tr>
                  <th scope="col">Role</th>
                  <th scope="col">Organisation</th>
                  <th scope="col">Status</th>
                  <th scope="col">Applied</th>
                  <th scope="col">Follow-up</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.applications.map((application) => (
                  <tr key={application.id}>
                    <td>
                      <div style={{ fontWeight: 550 }}>{application.role}</div>
                      {application.notes ? <div className="tiny muted truncate" style={{ maxWidth: 200 }}>{application.notes}</div> : null}
                    </td>
                    <td>
                      {application.organisation || '—'}
                      {application.link ? (
                        <div>
                          <ExternalLink href={application.link}>Posting</ExternalLink>
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <Badge tone={STATUS_TONE[application.status]}>{application.status}</Badge>
                    </td>
                    <td className="nowrap">{application.appliedDate ? formatDate(application.appliedDate, 'short') : '—'}</td>
                    <td className="nowrap">
                      {application.nextFollowUp ? relativeDayLabel(application.nextFollowUp) : '—'}
                    </td>
                    <td>
                      <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                        <IconButton
                          icon="edit"
                          label={`Edit ${application.role}`}
                          onClick={() => {
                            setForm({
                              id: application.id,
                              role: application.role,
                              organisation: application.organisation,
                              location: application.location ?? '',
                              link: application.link ?? '',
                              status: application.status,
                              appliedDate: application.appliedDate ?? '',
                              nextFollowUp: application.nextFollowUp ?? '',
                              notes: application.notes ?? '',
                            });
                            setOpen(true);
                          }}
                        />
                        <IconButton icon="trash" label={`Delete ${application.role}`} onClick={() => setPendingDelete(application)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} title={form.id ? 'Edit application' : 'Add application'}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <TextField label="Role" value={form.role} error={errors.role ?? null} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          <TextField label="Organisation" value={form.organisation} onChange={(e) => setForm({ ...form, organisation: e.target.value })} />
          <div className="grid grid-2">
            <TextField label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <SelectField
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as ApplicationStatus })}
              options={STATUS_OPTIONS}
            />
          </div>
          <TextField
            label="Link to the posting (optional)"
            type="url"
            placeholder="https://"
            value={form.link}
            error={errors.link ?? null}
            onChange={(e) => setForm({ ...form, link: e.target.value })}
          />
          <div className="grid grid-2">
            <TextField label="Applied on" type="date" value={form.appliedDate} onChange={(e) => setForm({ ...form, appliedDate: e.target.value })} />
            <TextField label="Follow up on" type="date" value={form.nextFollowUp} onChange={(e) => setForm({ ...form, nextFollowUp: e.target.value })} />
          </div>
          <TextAreaField label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="accent">
              Save application
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this application record?"
        message={pendingDelete ? <><strong>{pendingDelete.role}</strong> at {pendingDelete.organisation || 'unknown organisation'} will be removed from this device.</> : null}
        confirmLabel="Delete record"
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await deleteApplication(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

/* ------------------------------- main ------------------------------- */

export function Career(): JSX.Element {
  const [tab, setTab] = useState<Tab>('resume');

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
    const requested = params.get('tab');
    if (requested === 'resume' || requested === 'interview' || requested === 'tracker' || requested === 'resources') setTab(requested);
  }, []);

  return (
    <div className="stack">
      <PageHeader
        title="Career"
        description="Résumé builder, interview practice, an application tracker and links to public job services."
        actions={
          <Button variant="secondary" icon="print" onClick={() => window.print()}>
            Print this page
          </Button>
        }
      />

      <div className="segmented no-print" role="tablist" aria-label="Career sections" style={{ alignSelf: 'flex-start' }}>
        {(
          [
            { value: 'resume', label: 'Résumé builder' },
            { value: 'interview', label: 'Interview practice' },
            { value: 'tracker', label: 'Application tracker' },
            { value: 'resources', label: 'Job resources' },
          ] as { value: Tab; label: string }[]
        ).map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            aria-pressed={tab === item.value}
            onClick={() => setTab(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'resume' ? <ResumeEditor /> : null}
      {tab === 'interview' ? <InterviewPractice /> : null}
      {tab === 'tracker' ? <ApplicationTracker /> : null}
      {tab === 'resources' ? (
        <>
          <Card title="Public employment services and job boards" subtitle="Links open the organisation’s own site in a new tab">
            <ul className="list">
              {JOB_RESOURCES.map((resource) => (
                <li className="list-item" key={resource.id}>
                  <div className="list-item-main">
                    <div className="row wrap" style={{ gap: 8 }}>
                      <ExternalLink href={resource.url}>{resource.name}</ExternalLink>
                      <Badge tone={resource.kind === 'public-service' ? 'accent' : 'neutral'}>{resource.kind.replace('-', ' ')}</Badge>
                    </div>
                    <p className="small" style={{ margin: '2px 0 0' }}>
                      {resource.what}
                    </p>
                    <p className="tiny muted" style={{ margin: 0 }}>
                      {resource.note}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="tiny muted" style={{ marginTop: 12, marginBottom: 0 }}>
              These links need an internet connection. LIFEKIT does not list, verify, rank or endorse vacancies, employers or
              recruiters, and it cannot confirm that a listing is genuine. {CAREER_DISCLAIMER}
            </p>
          </Card>

          <Card title="Résumé guidance written for LIFEKIT">
            <ol className="small">
              {RESUME_TIPS.map((tip) => (
                <li key={tip} style={{ marginBottom: 6 }}>
                  {tip}
                </li>
              ))}
            </ol>
            <p className="tiny muted" style={{ marginBottom: 0 }}>
              Want the longer version? Read <a href={`#${ROUTES.learn}/resume-bullets`}>“Writing a résumé bullet that says
              something”</a> and <a href={`#${ROUTES.learn}/star-answers`}>“Interview answers with the STAR shape”</a> in the
              Learning Library.
            </p>
          </Card>
        </>
      ) : null}
    </div>
  );
}

export default Career;
