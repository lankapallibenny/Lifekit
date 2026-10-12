/**
 * LIFEKIT Learning Library.
 *
 * All lessons are bundled with the application, so reading them works offline with no
 * network request at all. "Saving" a lesson caches a copy of its text in local storage as
 * well, which keeps a lesson available even if a future version of the app reorganises or
 * removes it. Third-party material is never copied — external links are labelled as
 * further reading and point at the original source.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ExternalLink,
  PageHeader,
  ProgressBar,
  Segmented,
  SelectField,
  TextField,
} from '../components/ui';
import { Markdown } from '../components/Markdown';
import { Icon } from '../components/Icons';
import { useStore } from '../state/store';
import { LESSONS, LESSON_CATEGORIES, LEARNING_DISCLAIMER, findLesson, type LessonCategory } from '../content/learning';
import { formatDate } from '../lib/dates';
import { navigate, ROUTES } from '../router';

type Filter = 'all' | 'bookmarked' | 'unread' | 'completed';

export function Learn({ lessonId }: { lessonId?: string }): JSX.Element {
  const { data } = useStore();
  const [category, setCategory] = useState<LessonCategory | 'all'>('all');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const lesson = lessonId ? findLesson(lessonId) : undefined;

  // Reading progress is written when the reader reaches the end of the article.
  const progressFor = (id: string) =>
    data.learningProgress.find((p) => p.id === id) ?? {
      id,
      read: false,
      progress: 0,
      bookmarked: false,
      updatedAt: '',
      cached: null,
    };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LESSONS.filter((item) => (category === 'all' ? true : item.category === category))
      .filter((item) => {
        const progress = data.learningProgress.find((p) => p.id === item.id);
        if (filter === 'bookmarked') return Boolean(progress?.bookmarked);
        if (filter === 'completed') return Boolean(progress?.read);
        if (filter === 'unread') return !progress?.read;
        return true;
      })
      .filter((item) => (q === '' ? true : `${item.title} ${item.summary} ${item.body}`.toLowerCase().includes(q)));
  }, [category, filter, query, data.learningProgress]);

  if (lessonId) {
    if (!lesson) {
      return (
        <Card title="Lesson not found">
          <p className="muted">
            There is no bundled lesson with the id <code>{lessonId}</code>. It may have been renamed in a newer version.
          </p>
          <Button icon="book" onClick={() => navigate(ROUTES.learn)}>
            Back to the library
          </Button>
        </Card>
      );
    }
    return <LessonReader lessonId={lesson.id} />;
  }

  const bookmarkedCount = data.learningProgress.filter((p) => p.bookmarked).length;
  const completedCount = data.learningProgress.filter((p) => p.read).length;

  return (
    <div className="stack">
      <PageHeader
        title="Learn"
        description="Short, original lessons you can read offline. No accounts, no tracking, no AI-written filler."
      />

      <div className="grid grid-3">
        <div className="stat">
          <div className="stat-label">Lessons available</div>
          <div className="stat-value">{LESSONS.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Saved offline</div>
          <div className="stat-value">{bookmarkedCount}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Completed</div>
          <div className="stat-value">{completedCount}</div>
        </div>
      </div>

      <Card title="Browse" subtitle="Filter by subject, or search the full text of every lesson">
        <div className="toolbar" style={{ marginBottom: 'var(--space-3)' }}>
          <div className="grow" style={{ minWidth: 200 }}>
            <TextField
              label="Search lessons"
              type="search"
              placeholder="e.g. percentages, phishing, résumé"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <SelectField
            label="Subject"
            value={category}
            onChange={(event) => setCategory(event.target.value as LessonCategory | 'all')}
            options={[
              { value: 'all', label: 'All subjects' },
              ...LESSON_CATEGORIES.map((c) => ({ value: c.id, label: c.title })),
            ]}
          />
          <div>
            <span className="field-label">Show</span>
            <Segmented
              label="Lesson filter"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'unread', label: 'Unread' },
                { value: 'bookmarked', label: 'Saved' },
                { value: 'completed', label: 'Done' },
              ]}
            />
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState icon="search" title="No lessons match">
            Try a different subject, or clear the search box. Every lesson ships inside the app, so this list never fails to
            load because of a connection problem.
          </EmptyState>
        ) : (
          <div className="grid grid-cards">
            {visible.map((item) => {
              const progress = progressFor(item.id);
              const categoryInfo = LESSON_CATEGORIES.find((c) => c.id === item.category);
              return (
                <article className="card" key={item.id} style={{ boxShadow: 'none', display: 'flex', flexDirection: 'column' }}>
                  <div className="row-between" style={{ alignItems: 'flex-start' }}>
                    <Badge tone="info">{categoryInfo?.title ?? item.category}</Badge>
                    {progress.bookmarked ? <Icon name="bookmark" size={18} /> : null}
                  </div>
                  <h3 style={{ marginTop: 8 }}>
                    <a href={`#${ROUTES.learn}/${item.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                      {item.title}
                    </a>
                  </h3>
                  <p className="small muted grow" style={{ margin: 0 }}>
                    {item.summary}
                  </p>
                  <div className="row-between" style={{ marginTop: 10 }}>
                    <span className="tiny muted">
                      {item.minutes} min · {item.level}
                    </span>
                    <Button size="sm" variant="secondary" icon="book" onClick={() => navigate(`${ROUTES.learn}/${item.id}`)}>
                      {progress.read ? 'Read again' : progress.progress > 0 ? 'Continue' : 'Read'}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="About this library">
        <ul className="small">
          <li>Every lesson was written for LIFEKIT and is stored inside the application, so reading works with no connection.</li>
          <li>
            “Further reading” links go to the original third-party source in a new tab. Nothing is scraped or reproduced — you
            always read the original on the owner’s site, which requires internet access.
          </li>
          <li>Bookmarking a lesson also stores a private copy of its text on this device for offline reference.</li>
          <li>{LEARNING_DISCLAIMER}</li>
        </ul>
      </Card>
    </div>
  );
}

function LessonReader({ lessonId }: { lessonId: string }): JSX.Element {
  const { data, saveLearningProgress, settings } = useStore();
  const lesson = findLesson(lessonId);
  const stored = data.learningProgress.find((p) => p.id === lessonId);
  const [bookmarked, setBookmarked] = useState(Boolean(stored?.bookmarked));
  const [progress, setProgress] = useState(stored?.progress ?? 0);

  useEffect(() => {
    setBookmarked(Boolean(stored?.bookmarked));
    setProgress(stored?.progress ?? 0);
  }, [stored?.bookmarked, stored?.progress]);

  // Track how far the reader has scrolled, without blocking the main thread.
  useEffect(() => {
    if (!lesson) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const percent = scrollable <= 0 ? 100 : Math.min(100, Math.round((window.scrollY / scrollable) * 100));
        setProgress((current) => (percent > current ? percent : current));
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [lesson]);

  const persist = async (next: { bookmarked?: boolean; read?: boolean; progress?: number }) => {
    if (!lesson) return;
    const current = data.learningProgress.find((p) => p.id === lesson.id);
    await saveLearningProgress({
      id: lesson.id,
      read: next.read ?? current?.read ?? false,
      progress: next.progress ?? current?.progress ?? 0,
      bookmarked: next.bookmarked ?? current?.bookmarked ?? false,
      updatedAt: new Date().toISOString(),
      // Caching the text is what makes a saved lesson readable offline even if the
      // bundled lesson list ever changes.
      cached: next.bookmarked ?? current?.bookmarked
        ? { title: lesson.title, body: lesson.body, savedAt: new Date().toISOString() }
        : current?.cached ?? null,
    });
  };

  if (!lesson) {
    return (
      <Card title="Lesson not found">
        <Button icon="arrow-left" onClick={() => navigate(ROUTES.learn)}>
          Back to the library
        </Button>
      </Card>
    );
  }

  const categoryInfo = LESSON_CATEGORIES.find((c) => c.id === lesson.category);
  const index = LESSONS.findIndex((item) => item.id === lesson.id);
  const previous = LESSONS[index - 1];
  const next = LESSONS[index + 1];

  return (
    <div className="stack">
      <div className="row-between wrap no-print">
        <Button size="sm" variant="ghost" icon="arrow-left" onClick={() => navigate(ROUTES.learn)}>
          All lessons
        </Button>
        <div className="row" style={{ gap: 8 }}>
          <Button
            size="sm"
            variant={bookmarked ? 'accent' : 'secondary'}
            icon="bookmark"
            onClick={async () => {
              const value = !bookmarked;
              setBookmarked(value);
              await persist({ bookmarked: value });
            }}
          >
            {bookmarked ? 'Saved offline' : 'Save offline'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon="check"
            onClick={() => void persist({ read: true, progress: 100 })}
          >
            Mark complete
          </Button>
        </div>
      </div>

      <Card>
        <Badge tone="info">{categoryInfo?.title ?? lesson.category}</Badge>
        <h1 style={{ marginTop: 10 }}>{lesson.title}</h1>
        <p className="muted">{lesson.summary}</p>
        <div className="row wrap small muted" style={{ gap: 12 }}>
          <span>{lesson.minutes} minute read</span>
          <span>{lesson.level}</span>
          <span>Content reviewed {formatDate(lesson.reviewedOn, 'medium', settings.locale)}</span>
        </div>
        <div style={{ marginTop: 10 }}>
          <ProgressBar percent={progress} label="Your reading progress" tone="never-over" />
          <span className="tiny muted">{progress}% scrolled</span>
        </div>
        <hr className="divider" />
        <Markdown body={lesson.body} />

        {lesson.furtherReading.length > 0 ? (
          <>
            <h3>Further reading (third-party, opens in a new tab)</h3>
            <ul className="small">
              {lesson.furtherReading.map((source) => (
                <li key={source.url} style={{ marginBottom: 6 }}>
                  <ExternalLink href={source.url}>{source.label}</ExternalLink>{' '}
                  <span className="muted">— {source.note}</span>
                </li>
              ))}
            </ul>
            <p className="tiny muted" style={{ marginBottom: 0 }}>
              These links need an internet connection. LIFEKIT does not download or republish third-party material, and is not
              affiliated with the organisations linked here.
            </p>
          </>
        ) : null}
      </Card>

      <nav className="row-between wrap no-print" aria-label="Lesson navigation">
        {previous ? (
          <Button variant="secondary" icon="chevron-left" onClick={() => navigate(`${ROUTES.learn}/${previous.id}`)}>
            {previous.title.slice(0, 28)}
            {previous.title.length > 28 ? '…' : ''}
          </Button>
        ) : (
          <span />
        )}
        {next ? (
          <Button variant="secondary" onClick={() => navigate(`${ROUTES.learn}/${next.id}`)}>
            {next.title.slice(0, 28)}
            {next.title.length > 28 ? '…' : ''} <Icon name="chevron-right" size={16} />
          </Button>
        ) : null}
      </nav>
    </div>
  );
}

export default Learn;
