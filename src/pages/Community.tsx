/**
 * LIFEKIT Community Help Directory.
 *
 * Hard rule enforced by this screen: LIFEKIT never invents an organisation, phone number
 * or service. The bundled directory therefore ships **empty** and shows an honest empty
 * state. Listings only appear when:
 *   1. an operator publishes a reviewed content pack at content/directory.json, or
 *   2. a user submits a listing locally, which is stored as an unpublished draft that a
 *      reviewer must approve before it is visible.
 *
 * Reports ("this is outdated") are kept locally as well; nothing about the user is sent
 * anywhere, and no personal contact details are collected from submissions.
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
  Notice,
  PageHeader,
  SelectField,
  TextAreaField,
  TextField,
} from '../components/ui';
import { useStore } from '../state/store';
import { cleanText, createId } from '../lib/shared';
import { formatDate, todayISO } from '../lib/dates';
import { REMOTE_CONTENT_PATHS } from '../lib/defaults';
import { safeUrl } from '../lib/backup';
import type { DirectoryListing } from '../lib/models';
import { storageHealth } from '../lib/storage';

const CATEGORIES: { value: DirectoryListing['category']; label: string }[] = [
  { value: 'food', label: 'Food support' },
  { value: 'education', label: 'Education assistance' },
  { value: 'volunteering', label: 'Volunteering' },
  { value: 'community', label: 'Community organisations' },
  { value: 'emergency', label: 'Emergency resources' },
  { value: 'public-support', label: 'Public support services' },
];

const DRAFTS_KEY = 'directory_drafts';

/**
 * Validate an incoming published pack.
 *
 * A pack is the *reviewed* channel: an operator has checked each entry against a source.
 * That claim has to be explicit, so a row survives only when it names a reviewer, carries
 * a verification date that is not in the future, and links an http(s) source someone can
 * re-check. Missing any of those, the row is dropped and counted — the screen reports how
 * many were skipped rather than quietly showing unchecked contact details.
 *
 * Local submissions never pass through here: they are stored as unpublished drafts.
 */
export function validateListingPack(raw: unknown, today = todayISO()): { listings: DirectoryListing[]; rejected: number } {
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { listings?: unknown }).listings)
      ? ((raw as { listings: unknown[] }).listings)
      : null;
  if (!rows) return { listings: [], rejected: 0 };

  const MAX_LISTINGS = 200;
  let rejected = rows.length > MAX_LISTINGS ? rows.length - MAX_LISTINGS : 0;
  const listings: DirectoryListing[] = [];

  for (const item of rows.slice(0, MAX_LISTINGS)) {
    if (typeof item !== 'object' || item === null) {
      rejected++;
      continue;
    }
    const row = item as Record<string, unknown>;
    const organisation = cleanText(row.organisation, 160);
    const services = cleanText(row.services, 400);
    const region = cleanText(row.region, 120);
    const sourceUrl = safeUrl(row.sourceUrl);
    const lastVerified = cleanText(row.lastVerified, 20);
    const verifiedByName = cleanText(row.verifiedByName, 120);
    const category = CATEGORIES.find((c) => c.value === row.category)?.value;
    const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(lastVerified) && lastVerified <= today;
    const claimsReview = row.verification === 'verified' && verifiedByName.length > 1;
    if (!organisation || !services || !region || !sourceUrl || !category || !isValidDate || !claimsReview) {
      rejected++;
      continue;
    }
    listings.push({
      id: cleanText(row.id, 80) || `listing_${listings.length}`,
      organisation,
      category,
      region,
      city: cleanText(row.city, 120),
      services,
      contact: cleanText(row.contact, 300),
      website: safeUrl(row.website),
      sourceUrl,
      lastVerified,
      verifiedByName,
      verification: 'verified',
      published: row.published !== false,
      createdAt: cleanText(row.createdAt, 40) || new Date().toISOString(),
      updatedAt: cleanText(row.updatedAt, 40) || new Date().toISOString(),
    });
  }
  return { listings, rejected };
}

export function Community(): JSX.Element {
  const { settings, notify } = useStore();
  const [pack, setPack] = useState<DirectoryListing[]>([]);
  const [packStatus, setPackStatus] = useState<'idle' | 'loading' | 'loaded' | 'unavailable'>('idle');
  const [drafts, setDrafts] = useState<DirectoryListing[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<DirectoryListing['category'] | 'all'>('all');
  const [reporting, setReporting] = useState<DirectoryListing | null>(null);
  const [reportReason, setReportReason] = useState<'outdated' | 'wrong-contact' | 'closed' | 'other'>('outdated');
  const [reportDetails, setReportDetails] = useState('');
  const [reported, setReported] = useState<string[]>([]);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submission, setSubmission] = useState({ organisation: '', region: '', services: '', contact: '', website: '', sourceUrl: '', category: 'community' as DirectoryListing['category'] });
  const [submissionErrors, setSubmissionErrors] = useState<Record<string, string | null>>({});
  const [pendingDraftDelete, setPendingDraftDelete] = useState<DirectoryListing | null>(null);

  const loadDrafts = () => {
    const stored = readDrafts();
    setDrafts(stored);
  };

  useEffect(() => {
    loadDrafts();
  }, []);

  // The published pack is optional: it only loads when the user has enabled remote content
  // and a server is actually serving one. Offline, the app simply keeps the last state.
  useEffect(() => {
    if (!settings.remoteAnnouncementsEnabled) return;
    let cancelled = false;
    setPackStatus('loading');
    fetch(REMOTE_CONTENT_PATHS.directory, { headers: { Accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((json) => {
        if (cancelled) return;
        const { listings, rejected } = validateListingPack(json);
        setPack(listings);
        setPackStatus('loaded');
        if (rejected > 0) notify(`${rejected} directory listing(s) were skipped because they were not verified.`, 'error');
      })
      .catch(() => {
        if (!cancelled) setPackStatus('unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, [settings.remoteAnnouncementsEnabled, notify]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...pack, ...drafts.filter((d) => d.published)]
      .filter((listing) => (category === 'all' ? true : listing.category === category))
      .filter((listing) =>
        q === '' ? true : `${listing.organisation} ${listing.services} ${listing.region} ${listing.city ?? ''}`.toLowerCase().includes(q)
      )
      .sort((a, b) => a.organisation.localeCompare(b.organisation));
  }, [pack, drafts, query, category]);

  const submitListing = () => {
    const errors: Record<string, string | null> = {};
    if (cleanText(submission.organisation, 160).length < 2) errors.organisation = 'Organisation name is required.';
    if (cleanText(submission.region, 120).length < 2) errors.region = 'Region or city is required.';
    if (cleanText(submission.services, 400).length < 10) errors.services = 'Describe the services in at least one short sentence.';
    if (submission.sourceUrl.trim() === '' || safeUrl(submission.sourceUrl) === '') {
      errors.sourceUrl = 'An official source URL is required so a reviewer can check the details.';
    }
    setSubmissionErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const now = new Date().toISOString();
    const draft: DirectoryListing = {
      id: createId('listing'),
      organisation: cleanText(submission.organisation, 160),
      category: submission.category,
      region: cleanText(submission.region, 120),
      services: cleanText(submission.services, 400),
      contact: cleanText(submission.contact, 300),
      website: safeUrl(submission.website),
      sourceUrl: safeUrl(submission.sourceUrl),
      lastVerified: todayISO(),
      verification: 'unverified',
      published: false,
      createdAt: now,
      updatedAt: now,
    };
    const next = [...readDrafts(), draft];
    writeDrafts(next);
    setDrafts(next);
    setSubmitOpen(false);
    setSubmission({ organisation: '', region: '', services: '', contact: '', website: '', sourceUrl: '', category: 'community' });
    notify('Saved as an unpublished draft. It is not visible in the directory until a reviewer checks it.', 'success');
  };

  const publishDraft = (id: string) => {
    const next = readDrafts().map((draft) =>
      draft.id === id ? { ...draft, published: true, verification: 'verified' as const, verifiedByName: 'Local reviewer', updatedAt: new Date().toISOString() } : draft
    );
    writeDrafts(next);
    setDrafts(next);
    notify('Listing published locally after your review.', 'success');
  };

  const deleteDraft = (id: string) => {
    const next = readDrafts().filter((draft) => draft.id !== id);
    writeDrafts(next);
    setDrafts(next);
    setPendingDraftDelete(null);
  };

  const reportListing = (listing: DirectoryListing, reason: typeof reportReason, details: string) => {
    const record = {
      id: createId('rep'),
      listingId: listing.id,
      reason,
      details: cleanText(details, 600),
      createdAt: new Date().toISOString(),
    };
    const next = [...readReports(), record];
    writeReports(next);
    setReported([...reported, listing.id]);
    setReporting(null);
    setReportDetails('');
    notify('Thanks — your report is stored on this device so you can pass it on to the organisation or a reviewer.', 'success');
  };

  const pendingDrafts = drafts.filter((draft) => !draft.published);
  const storageOk = storageHealth().persistent;

  return (
    <div className="stack">
      <PageHeader
        title="Community help"
        description="A directory of services, with every listing traceable to an official source."
        actions={
          <Button variant="secondary" icon="plus" onClick={() => setSubmitOpen(true)}>
            Suggest a listing
          </Button>
        }
      />

      <Notice tone="warning" title="Confirm details before you travel or call.">
        Opening hours, eligibility rules and whether a service is currently running all change. Always confirm directly with
        the organisation using the contact details on their own website. LIFEKIT does not run any of these services, cannot
        verify eligibility, and is not affiliated with the organisations listed.
      </Notice>

      {!storageOk ? (
        <Notice tone="danger" title="Local storage is unavailable.">
          Draft listings and reports cannot be saved, and nothing will persist after this tab closes.
        </Notice>
      ) : null}

      <Card
        title="Search the directory"
        subtitle={`${visible.length} published listing${visible.length === 1 ? '' : 's'}`}
      >
        <div className="toolbar" style={{ marginBottom: 'var(--space-3)' }}>
          <div className="grow" style={{ minWidth: 200 }}>
            <TextField
              label="Search by name, service or region"
              type="search"
              placeholder="e.g. food bank, tuition, Kanpur"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <SelectField
            label="Category"
            value={category}
            onChange={(event) => setCategory(event.target.value as DirectoryListing['category'] | 'all')}
            options={[{ value: 'all', label: 'All categories' }, ...CATEGORIES]}
          />
        </div>

        {visible.length === 0 ? (
          <EmptyState icon="users" title="No verified listings are available yet">
            <p style={{ marginTop: 0 }}>
              LIFEKIT will not invent an organisation, a phone number or a service to fill this page. That means the bundled
              directory starts empty on purpose. You have three honest ways to use it:
            </p>
            <ol style={{ textAlign: 'left', maxWidth: 520, margin: '0 auto' }}>
              <li>Use <strong>Suggest a listing</strong> to add an organisation you know, with its official source URL.</li>
              <li>Review your own submission in the queue below and publish it once you have checked the details.</li>
              <li>
                If an operator has published a reviewed content pack at{' '}
                <code>content/directory.json</code>, enable remote content in Settings and it will load here.
              </li>
            </ol>
            <p style={{ marginBottom: 0 }}>
              For urgent help, contact your local emergency number or a public service you already trust — do not wait for a
              directory entry.
            </p>
          </EmptyState>
        ) : (
          <div className="grid grid-cards">
            {visible.map((listing) => (
              <article className="card" key={listing.id} style={{ boxShadow: 'none', display: 'flex', flexDirection: 'column' }}>
                <div className="row-between" style={{ alignItems: 'flex-start' }}>
                  <h3 style={{ margin: 0 }}>{listing.organisation}</h3>
                  <Badge tone={listing.verification === 'verified' ? 'accent' : 'warning'}>
                    {listing.verification === 'verified' ? 'Verified' : 'Unverified'}
                  </Badge>
                </div>
                <p className="tiny muted" style={{ margin: '4px 0' }}>
                  {CATEGORIES.find((c) => c.value === listing.category)?.label} · {listing.city ? `${listing.city}, ` : ''}
                  {listing.region}
                </p>
                <p className="small grow">{listing.services}</p>
                {listing.contact ? (
                  <p className="small" style={{ margin: 0 }}>
                    <strong>Contact:</strong> {listing.contact}
                  </p>
                ) : null}
                <p className="tiny muted" style={{ margin: '6px 0 0' }}>
                  Last verified {formatDate(listing.lastVerified, 'medium', settings.locale)}
                  {listing.verifiedByName ? ` by ${listing.verifiedByName}` : ''}.
                </p>
                <div className="btn-row" style={{ marginTop: 10 }}>
                  <ExternalLink href={listing.sourceUrl}>Official source</ExternalLink>
                  {listing.website ? <ExternalLink href={listing.website}>Website</ExternalLink> : null}
                </div>
                <div className="btn-row" style={{ marginTop: 8 }}>
                  {reported.includes(listing.id) ? (
                    <Badge tone="info">Reported by you</Badge>
                  ) : (
                    <Button size="sm" variant="ghost" icon="warning" onClick={() => setReporting(listing)}>
                      Report outdated
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {settings.remoteAnnouncementsEnabled ? (
          <p className="tiny muted" style={{ marginTop: 12, marginBottom: 0 }}>
            Remote content is enabled.{' '}
            {packStatus === 'loading'
              ? 'Checking for a published directory pack…'
              : packStatus === 'loaded'
                ? `Loaded ${pack.length} verified listing(s) from content/directory.json.`
                : packStatus === 'unavailable'
                  ? 'No published pack was available (offline, or the file does not exist). The bundled directory still works.'
                  : ''}
          </p>
        ) : (
          <p className="tiny muted" style={{ marginTop: 12, marginBottom: 0 }}>
            Remote content is off, so only listings saved on this device are shown. Enable it in Settings → Privacy and data if
            an operator has published a reviewed pack.
          </p>
        )}
      </Card>

      {pendingDrafts.length > 0 ? (
        <Card
          title="Review queue"
          subtitle="Submissions are never published until someone checks them"
        >
          <ul className="list">
            {pendingDrafts.map((draft) => (
              <li className="list-item" key={draft.id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div className="row-between wrap">
                  <div>
                    <strong>{draft.organisation}</strong>{' '}
                    <Badge tone="warning">Awaiting review</Badge>
                    <div className="tiny muted">
                      {draft.region} · submitted {formatDate(draft.createdAt.slice(0, 10), 'short', settings.locale)}
                    </div>
                  </div>
                  <div className="btn-row">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => window.open(draft.sourceUrl, '_blank', 'noopener,noreferrer')}
                      icon="external"
                    >
                      Check source
                    </Button>
                    <Button size="sm" variant="accent" icon="check" onClick={() => publishDraft(draft.id)}>
                      Publish locally
                    </Button>
                    <Button size="sm" variant="ghost" icon="trash" onClick={() => setPendingDraftDelete(draft)}>
                      Delete
                    </Button>
                  </div>
                </div>
                <p className="small" style={{ margin: '6px 0 0' }}>
                  {draft.services}
                </p>
                {draft.contact ? (
                  <p className="small" style={{ margin: 0 }}>
                    Contact given: {draft.contact}
                  </p>
                ) : null}
                <p className="tiny muted" style={{ margin: '4px 0 0' }}>
                  Source: {draft.sourceUrl}
                </p>
              </li>
            ))}
          </ul>
          <p className="tiny muted" style={{ marginTop: 8, marginBottom: 0 }}>
            In this offline release the reviewer is you. A LIFEKIT operator can take over this step later through the optional
            backend, where publishing is an authenticated administrator action with an audit trail.
          </p>
        </Card>
      ) : null}

      <Card title="How submissions and reports work">
        <ul className="small">
          <li>
            <strong>No personal contact details are collected.</strong> The form asks for an organisation and an official source
            URL — not your name, email or phone number.
          </li>
          <li>Drafts are stored on this device only. Nothing is uploaded by this release.</li>
          <li>
            A listing becomes visible only after a review step checks the organisation against its own official source. LIFEKIT
            never invents an entry to fill the page.
          </li>
          <li>Reports are stored locally so you can hand them to the organisation or a reviewer; they are not transmitted.</li>
          <li>
            LIFEKIT does not endorse, rank or guarantee any organisation, and cannot confirm that a service is available,
            funded or suitable for you.
          </li>
        </ul>
      </Card>

      <Dialog open={reporting !== null} onClose={() => setReporting(null)} title="Report an outdated listing">
        {reporting ? (
          <>
            <p className="small">
              Reporting <strong>{reporting.organisation}</strong>. The report is stored on this device so you can pass it on.
            </p>
            <SelectField
              label="What is wrong?"
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value as typeof reportReason)}
              options={[
                { value: 'outdated', label: 'Details are out of date' },
                { value: 'wrong-contact', label: 'Contact details are wrong' },
                { value: 'closed', label: 'Service has stopped' },
                { value: 'other', label: 'Something else' },
              ]}
            />
            <TextAreaField
              label="Anything else a reviewer should know (optional)"
              value={reportDetails}
              onChange={(event) => setReportDetails(event.target.value)}
            />
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setReporting(null)}>
                Cancel
              </Button>
              <Button variant="accent" onClick={() => reportListing(reporting, reportReason, reportDetails)}>
                Save report
              </Button>
            </div>
          </>
        ) : null}
      </Dialog>

      <Dialog open={submitOpen} onClose={() => setSubmitOpen(false)} title="Suggest a listing">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitListing();
          }}
        >
          <p className="small muted">
            Only submit organisations you can point to an official source for. Submissions are <strong>not</strong> published
            automatically, and LIFEKIT does not collect your contact details.
          </p>
          <TextField
            label="Organisation name"
            value={submission.organisation}
            error={submissionErrors.organisation ?? null}
            onChange={(event) => setSubmission({ ...submission, organisation: event.target.value })}
          />
          <SelectField
            label="Category"
            value={submission.category}
            onChange={(event) => setSubmission({ ...submission, category: event.target.value as DirectoryListing['category'] })}
            options={CATEGORIES}
          />
          <div className="grid grid-2">
            <TextField
              label="Region"
              hint="State, district or city"
              value={submission.region}
              error={submissionErrors.region ?? null}
              onChange={(event) => setSubmission({ ...submission, region: event.target.value })}
            />
            <TextField
              label="Contact (as published by them)"
              hint="Optional"
              value={submission.contact}
              onChange={(event) => setSubmission({ ...submission, contact: event.target.value })}
            />
          </div>
          <TextAreaField
            label="Services offered"
            value={submission.services}
            error={submissionErrors.services ?? null}
            onChange={(event) => setSubmission({ ...submission, services: event.target.value })}
          />
          <TextField
            label="Official source URL"
            hint="Required. A page on the organisation’s own site, or a government page about it."
            type="url"
            placeholder="https://"
            value={submission.sourceUrl}
            error={submissionErrors.sourceUrl ?? null}
            onChange={(event) => setSubmission({ ...submission, sourceUrl: event.target.value })}
          />
          <TextField
            label="Website (optional)"
            type="url"
            placeholder="https://"
            value={submission.website}
            onChange={(event) => setSubmission({ ...submission, website: event.target.value })}
          />
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setSubmitOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="accent">
              Save as draft for review
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={pendingDraftDelete !== null}
        title="Delete this draft?"
        message={pendingDraftDelete ? <><strong>{pendingDraftDelete.organisation}</strong> will be removed from this device.</> : null}
        confirmLabel="Delete draft"
        onCancel={() => setPendingDraftDelete(null)}
        onConfirm={() => pendingDraftDelete && deleteDraft(pendingDraftDelete.id)}
      />
    </div>
  );
}

/* ------------------------------- local persistence ------------------------------- */

interface StoredReport {
  id: string;
  listingId: string;
  reason: string;
  details: string;
  createdAt: string;
}

function readDrafts(): DirectoryListing[] {
  try {
    const raw = localStorage.getItem(`lifekit.${DRAFTS_KEY}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is DirectoryListing => typeof item === 'object' && item !== null && typeof item.organisation === 'string');
  } catch {
    return [];
  }
}

function writeDrafts(drafts: DirectoryListing[]): void {
  try {
    localStorage.setItem(`lifekit.${DRAFTS_KEY}`, JSON.stringify(drafts));
  } catch {
    // Storage full or unavailable — the UI already warned the user.
  }
}

function readReports(): StoredReport[] {
  try {
    const raw = localStorage.getItem('lifekit.directory_reports');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredReport[]) : [];
  } catch {
    return [];
  }
}

function writeReports(reports: StoredReport[]): void {
  try {
    localStorage.setItem('lifekit.directory_reports', JSON.stringify(reports));
  } catch {
    /* ignore */
  }
}

export default Community;
