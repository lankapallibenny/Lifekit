/**
 * LIFEKIT Digital Safety Centre.
 *
 * This screen is educational. It does not scan anything, does not detect malware, does
 * not block links and does not certify any website, caller or organisation as safe.
 * Reporting channels are limited to official government and platform channels that were
 * checked against their own websites on the review date shown in the header, and the page
 * tells the reader to confirm details themselves before relying on them.
 */
import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ExternalLink,
  PageHeader,
  SelectField,
  TextField,
} from '../components/ui';
import { Icon } from '../components/Icons';
import { useStore } from '../state/store';
import { REPORTING_CHANNELS, SAFETY_DISCLAIMER, SAFETY_REVIEWED_ON, SAFETY_TOPICS } from '../content/safety';
import { formatDate, todayISO } from '../lib/dates';
import { cleanText, createId } from '../lib/shared';

type ChannelRegion = 'All' | 'India' | 'United States' | 'United Kingdom' | 'Australia' | 'Canada' | 'Anywhere';

export function Safety(): JSX.Element {
  const { data, saveChecklist, settings } = useStore();
  const [query, setQuery] = useState('');
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const [region, setRegion] = useState<ChannelRegion>('All');
  const [savedTopic, setSavedTopic] = useState<string | null>(null);

  const topics = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SAFETY_TOPICS.filter((topic) =>
      q === ''
        ? true
        : `${topic.title} ${topic.summary} ${topic.warningSigns.join(' ')} ${topic.tags.join(' ')}`.toLowerCase().includes(q)
    );
  }, [query]);

  const channels = REPORTING_CHANNELS.filter((channel) => (region === 'All' ? true : channel.region === region));

  const saveTopicAsChecklist = async (topicId: string) => {
    const topic = SAFETY_TOPICS.find((t) => t.id === topicId);
    if (!topic) return;
    const now = new Date().toISOString();
    await saveChecklist({
      id: createId('list'),
      title: `${topic.title} — my steps`,
      kind: 'safety',
      items: topic.steps.map((step) => ({ id: createId('ci'), text: step.text, done: false })),
      createdAt: now,
      updatedAt: now,
    });
    setSavedTopic(topicId);
  };

  const savedCount = data.checklists.filter((list) => list.kind === 'safety').length;

  return (
    <div className="stack">
      <PageHeader
        title="Digital safety"
        description={`Educational checklists and official reporting channels. Information reviewed ${formatDate(SAFETY_REVIEWED_ON, 'long', settings.locale)}.`}
      />

      <div className="notice notice-warning" role="note">
        <Icon name="warning" size={20} />
        <div>
          <strong>What this page cannot do.</strong> {SAFETY_DISCLAIMER}
        </div>
      </div>

      {savedTopic ? (
        <div className="notice notice-success" role="status">
          <Icon name="check" size={20} />
          <div>
            Saved as a personal checklist with {savedCount} safety checklist{savedCount === 1 ? '' : 's'} on this device.
            Checklists live in <a href="#/tools?tab=checklists">Tools → Checklists</a> so you can tick items as you go.
          </div>
        </div>
      ) : null}

      <Card title="Checklists" subtitle="Search by topic, or open one to read the warning signs and the steps">
        <div className="toolbar" style={{ marginBottom: 'var(--space-3)' }}>
          <div className="grow" style={{ minWidth: 200 }}>
            <TextField
              label="Search the safety centre"
              type="search"
              placeholder="e.g. OTP, job offer, UPI, phishing"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        {topics.length === 0 ? (
          <EmptyState icon="search" title="No checklist matches that search">
            Try a shorter term such as “job”, “OTP”, “link” or “payment”.
          </EmptyState>
        ) : (
          <ul className="list">
            {topics.map((topic) => {
              const isOpen = openTopic === topic.id;
              return (
                <li className="list-item" key={topic.id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <button
                    type="button"
                    className="row-between"
                    aria-expanded={isOpen}
                    style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left', color: 'inherit', font: 'inherit' }}
                    onClick={() => setOpenTopic(isOpen ? null : topic.id)}
                  >
                    <span style={{ fontWeight: 650 }}>{topic.title}</span>
                    <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={20} />
                  </button>
                  <p className="small muted" style={{ margin: '4px 0 0' }}>
                    {topic.summary}
                  </p>
                  <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                    <Badge tone="accent">{topic.keyRule}</Badge>
                    {topic.tags.map((tag) => (
                      <Badge key={tag}>#{tag}</Badge>
                    ))}
                  </div>

                  {isOpen ? (
                    <div style={{ marginTop: 12 }}>
                      <h4>Warning signs</h4>
                      <ul className="small">
                        {topic.warningSigns.map((sign) => (
                          <li key={sign} style={{ marginBottom: 4 }}>
                            {sign}
                          </li>
                        ))}
                      </ul>
                      <h4>What to do</h4>
                      <ol className="small">
                        {topic.steps.map((step) => (
                          <li key={step.text} style={{ marginBottom: 4 }}>
                            {step.text}
                          </li>
                        ))}
                      </ol>
                      <h4>If it has already happened</h4>
                      <ul className="small">
                        {topic.ifAffected.map((item) => (
                          <li key={item} style={{ marginBottom: 4 }}>
                            {item}
                          </li>
                        ))}
                      </ul>
                      <div className="btn-row" style={{ marginTop: 10 }}>
                        <Button size="sm" variant="accent" icon="list" onClick={() => void saveTopicAsChecklist(topic.id)}>
                          Save as my checklist
                        </Button>
                        <Button size="sm" variant="ghost" icon="arrow-left" onClick={() => setOpenTopic(null)}>
                          Close
                        </Button>
                      </div>
                      <p className="tiny muted" style={{ marginTop: 10, marginBottom: 0 }}>
                        These steps are general guidance for people in different countries and legal systems. Where a step names
                        a national helpline, choose the channel for your own country from the list below, and confirm the current
                        details on the official website before relying on them.
                      </p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card
        title="Official reporting channels"
        subtitle="Government and platform channels only, each with the source we checked"
        actions={
          <SelectField
            label="Country or region"
            value={region}
            onChange={(event) => setRegion(event.target.value as ChannelRegion)}
            options={[
              { value: 'All', label: 'All' },
              { value: 'India', label: 'India' },
              { value: 'United States', label: 'United States' },
              { value: 'United Kingdom', label: 'United Kingdom' },
              { value: 'Australia', label: 'Australia' },
              { value: 'Canada', label: 'Canada' },
              { value: 'Anywhere', label: 'Applies anywhere' },
            ]}
          />
        }
      >
        <div className="table-wrap">
          <table>
            <caption className="visually-hidden">Official fraud and cybercrime reporting channels</caption>
            <thead>
              <tr>
                <th scope="col">Purpose</th>
                <th scope="col">Channel</th>
                <th scope="col">Details</th>
                <th scope="col">Source</th>
                <th scope="col">Checked</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((channel) => (
                <tr key={channel.id}>
                  <td>
                    <div style={{ fontWeight: 550 }}>{channel.purpose}</div>
                    <Badge>{channel.region}</Badge>
                  </td>
                  <td>{channel.channel}</td>
                  <td className="small">{channel.detail}</td>
                  <td>
                    {channel.website ? (
                      <ExternalLink href={channel.website}>{channel.website.replace('https://', '')}</ExternalLink>
                    ) : (
                      <span className="muted small">Use the number on your card or passbook</span>
                    )}
                  </td>
                  <td className="nowrap small">{formatDate(channel.lastReviewed, 'short', settings.locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="tiny muted" style={{ marginTop: 12 }}>
          LIFEKIT does not operate any of these channels, does not receive reports, and cannot follow up on a case on your
          behalf. Contact details, portal paths and helpline numbers can change — always confirm on the official website.
          {settings.language !== 'en' ? '' : ''}
        </p>
      </Card>

      <Card title="If you are in immediate danger">
        <ul className="small">
          <li>Contact your local emergency number first. In India this is 112; in the EU it is 112; in the US it is 911.</li>
          <li>Then use the reporting channel above for the fraud itself, and tell your bank so the account can be protected.</li>
          <li>
            Tell someone you trust. Isolation is the tool scammers rely on most, and a second person often spots the pattern
            quickly.
          </li>
        </ul>
        <p className="tiny muted" style={{ marginBottom: 0 }}>
          LIFEKIT is not an emergency service and cannot contact anyone on your behalf. Reviewed{' '}
          {formatDate(SAFETY_REVIEWED_ON, 'medium', settings.locale)} · today is {formatDate(todayISO(), 'medium', settings.locale)}.
        </p>
      </Card>
    </div>
  );
}

/** Exported for the automated tests so copy changes are caught. */
export const SAFETY_SUMMARY_TEXT = cleanText(SAFETY_DISCLAIMER, 200);

export default Safety;
