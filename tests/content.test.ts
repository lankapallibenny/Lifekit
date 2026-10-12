/**
 * Content integrity tests.
 *
 * LIFEKIT ships its own written lessons, safety guidance, interview material and reporting
 * channels. The rules that make that safe to ship are mechanical, so they are checked here
 * rather than trusted: every external link is https, no content claims to be an official
 * service LIFEKIT is not, bundled announcements are flagged as examples, and every lesson
 * carries the review date it was last checked against.
 */
import { describe, expect, it } from 'vitest';
import { LESSONS, LESSON_CATEGORIES, findLesson, lessonsByCategory, LEARNING_DISCLAIMER } from '../src/content/learning';
import { REPORTING_CHANNELS, SAFETY_REVIEWED_ON, SAFETY_TOPICS, SAFETY_DISCLAIMER } from '../src/content/safety';
import { CAREER_DISCLAIMER, INTERVIEW_QUESTIONS, JOB_RESOURCES, RESUME_TIPS } from '../src/content/career';
import { SAMPLE_ANNOUNCEMENTS, CONTENT_VERSION, APP_VERSION } from '../src/lib/defaults';
import { MAX_PACK_ANNOUNCEMENTS, validateAnnouncementPack } from '../src/lib/contentPacks';

const TODAY = '2026-10-11';

function isPastOrToday(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= TODAY;
}

describe('learning library', () => {
  it('covers all seven required categories', () => {
    expect(LESSON_CATEGORIES.map((c) => c.id).sort()).toEqual(
      ['career-skills', 'computer-basics', 'digital-safety', 'languages', 'maths', 'personal-finance', 'study-methods'].sort()
    );
    // Every category actually has lessons behind it — no empty shelves.
    for (const group of lessonsByCategory()) {
      expect(group.lessons.length).toBeGreaterThan(0);
    }
  });

  it('gives every lesson unique ids, a summary, a body and a review date', () => {
    const ids = new Set<string>();
    for (const lesson of LESSONS) {
      expect(ids.has(lesson.id)).toBe(false);
      ids.add(lesson.id);
      expect(lesson.title.length).toBeGreaterThan(5);
      expect(lesson.summary.length).toBeGreaterThan(20);
      expect(lesson.body.length).toBeGreaterThan(300);
      expect(lesson.minutes).toBeGreaterThan(0);
      expect(isPastOrToday(lesson.reviewedOn)).toBe(true);
    }
  });

  it('resolves a lesson by id and returns nothing for an unknown one', () => {
    const first = LESSONS[0]!;
    expect(findLesson(first.id)?.title).toBe(first.title);
    expect(findLesson('no-such-lesson')).toBeUndefined();
  });

  it('links only to https sources and explains why each is listed', () => {
    for (const lesson of LESSONS) {
      for (const source of lesson.furtherReading) {
        expect(source.url.startsWith('https://')).toBe(true);
        expect(source.label.length).toBeGreaterThan(2);
        expect(source.note.length).toBeGreaterThan(10);
      }
    }
  });

  it('contains no advertising language and no claim to be official guidance', () => {
    const all = LESSONS.map((lesson) => `${lesson.title} ${lesson.body}`).join(' ');
    expect(all).not.toMatch(/\bbuy now\b|\bsubscribe\b|\bsponsored\b|\baffiliate\b/i);
    expect(all).not.toMatch(/government approved|certified by|guaranteed income/i);
    expect(LEARNING_DISCLAIMER.length).toBeGreaterThan(40);
  });

  it('keeps the offline lesson list small enough to precache on a budget phone', () => {
    const bytes = LESSONS.reduce((total, lesson) => total + lesson.body.length, 0);
    expect(bytes).toBeLessThan(200_000);
  });
});

describe('safety content', () => {
  it('covers the required topics, including what to do after fraud', () => {
    const ids = SAFETY_TOPICS.map((topic) => topic.id);
    for (const expected of [
      'fake-job-offer',
      'phishing',
      'suspicious-link',
      'impersonation',
      'payment-fraud',
      'otp-password-requests',
      'after-fraud',
    ]) {
      expect(ids).toContain(expected);
    }
  });

  it('gives every topic a key rule, warning signs, steps and a recovery list', () => {
    for (const topic of SAFETY_TOPICS) {
      expect(topic.keyRule.length).toBeGreaterThan(15);
      // Topics vary in depth, so the floor is two of each — enough to be actionable.
      expect(topic.warningSigns.length).toBeGreaterThanOrEqual(2);
      expect(topic.steps.length).toBeGreaterThanOrEqual(2);
      expect(topic.ifAffected.length).toBeGreaterThanOrEqual(2);
      for (const step of topic.steps) {
        expect(step.text.trim().length).toBeGreaterThan(15);
        // Guards against the string-manipulation artefact that once shipped here.
        expect(step.text).not.toContain('.replace(');
      }
    }
  });

  it('lists official reporting channels with a source URL and a review date', () => {
    expect(REPORTING_CHANNELS.length).toBeGreaterThanOrEqual(8);
    // One entry is deliberately generic advice — "use the number printed on your own card" —
    // rather than a named organisation, so it carries no URL and invents no phone number.
    const generic = REPORTING_CHANNELS.filter((channel) => channel.website === '');
    expect(generic).toHaveLength(1);
    expect(generic[0]?.id).toBe('any-bank');
    expect(generic[0]?.detail).toMatch(/printed on your card|official website/i);

    for (const channel of REPORTING_CHANNELS) {
      if (channel.website === '') continue;
      expect(channel.website.startsWith('https://')).toBe(true);
      expect(channel.lastReviewed).toBe(SAFETY_REVIEWED_ON);
      expect(isPastOrToday(channel.lastReviewed)).toBe(true);
      expect(channel.verified).toBe(true);
      expect(channel.purpose.length).toBeGreaterThan(10);
      // Each entry is described as an external organisation's channel, never as LIFEKIT's own
      // service. (The safety pages mention LIFEKIT's backup feature separately.)
      expect(channel.channel).not.toMatch(/^LIFEKIT/);
    }
  });

  it('covers the four countries whose guidance is bundled', () => {
    const regions = new Set(REPORTING_CHANNELS.map((channel) => channel.region));
    for (const region of ['India', 'United States', 'United Kingdom', 'Australia']) {
      expect(regions.has(region as never)).toBe(true);
    }
  });

  it('tells the reader how to check whether a channel is still current', () => {
    expect(SAFETY_DISCLAIMER).toMatch(/confirm|current|change/i);
    expect(SAFETY_DISCLAIMER).toMatch(/not (a )?(substitute|legal advice)|does not|no guarantee/i);
  });

  it('does not claim any scanning, detection or recovery capability', () => {
    const text = SAFETY_TOPICS.map((topic) => `${topic.summary} ${topic.keyRule} ${topic.steps.map((s) => s.text).join(' ')}`).join(' ');
    expect(text).not.toMatch(/LIFEKIT (scans|detects|blocks|recovers|protects you)/i);
    expect(text).not.toMatch(/guaranteed recovery|100% safe/i);
  });
});

describe('career content', () => {
  it('provides interview questions with a structure and a caution for each', () => {
    expect(INTERVIEW_QUESTIONS.length).toBeGreaterThanOrEqual(12);
    for (const item of INTERVIEW_QUESTIONS) {
      expect(item.question.length).toBeGreaterThan(10);
      expect(item.approach.length).toBeGreaterThan(30);
      expect(item.sampleAnswer.length).toBeGreaterThan(60);
      expect(item.avoid.length).toBeGreaterThan(20);
    }
  });

  it('points to real, https resources and never promises a job or a salary', () => {
    expect(JOB_RESOURCES.length).toBeGreaterThanOrEqual(5);
    for (const resource of JOB_RESOURCES) {
      expect(resource.url.startsWith('https://')).toBe(true);
      expect(resource.note.length).toBeGreaterThan(15);
    }
    const text = `${JOB_RESOURCES.map((r) => `${r.name} ${r.what} ${r.note}`).join(' ')} ${CAREER_DISCLAIMER}`;
    expect(text).not.toMatch(/guaranteed (job|placement|salary)|\bwe will place you\b/i);
  });

  it('includes résumé tips that advise honesty rather than padding', () => {
    expect(RESUME_TIPS.length).toBeGreaterThanOrEqual(6);
    expect(RESUME_TIPS.join(' ')).toMatch(/truth|honest|accurate|never (invent|exaggerate)|do not (invent|exaggerate)/i);
  });
});

describe('bundled example announcements', () => {
  it('flags every bundled announcement as an example the app itself wrote', () => {
    expect(SAMPLE_ANNOUNCEMENTS.length).toBeGreaterThan(0);
    for (const announcement of SAMPLE_ANNOUNCEMENTS) {
      expect(announcement.sample).toBe(true);
      // Examples must never reach the notification engine.
      expect(announcement.notifyEligible).toBe(false);
      expect(announcement.title).toMatch(/example/i);
      expect(announcement.body).not.toMatch(/\boutage\b|\bincident\b|\bdowntime\b/i);
    }
  });

  it('keeps the advertised content and app versions in step with this build', () => {
    expect(CONTENT_VERSION).toBe(SAFETY_REVIEWED_ON);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('published announcement packs (opt-in feed)', () => {
  const good = {
    id: 'notice-1',
    title: 'Scheduled maintenance on Sunday',
    body: 'The optional content service will be briefly unavailable while the operator updates it.',
    category: 'service',
    priority: 'normal',
    publishedAt: '2026-10-01',
  };

  it('accepts a reviewed pack in either shape and marks it as published content', () => {
    for (const raw of [[good], { version: 1, announcements: [good] }]) {
      const { items, rejected } = validateAnnouncementPack(raw, TODAY);
      expect(rejected).toBe(0);
      expect(items).toHaveLength(1);
      expect(items[0]?.sample).toBe(false);
      expect(items[0]?.title).toBe(good.title);
    }
  });

  it('never lets a pack claim to be a bundled example or to notify on low priority', () => {
    const { items } = validateAnnouncementPack(
      [{ ...good, sample: true, priority: 'low', notifyEligible: true }],
      TODAY
    );
    expect(items[0]?.sample).toBe(false);
    // Low-priority messages must not be delivered as notifications.
    expect(items[0]?.notifyEligible).toBe(false);
  });

  it('keeps only high/normal eligible messages notify-eligible', () => {
    const { items } = validateAnnouncementPack(
      [
        { ...good, id: 'a', priority: 'high', notifyEligible: true },
        { ...good, id: 'b', priority: 'low', notifyEligible: true },
        { ...good, id: 'c', priority: 'normal', notifyEligible: false },
      ],
      TODAY
    );
    expect(items.map((item) => item.notifyEligible)).toEqual([true, false, false]);
  });

  it('drops malformed rows instead of rendering them', () => {
    const { items, rejected } = validateAnnouncementPack(
      [
        good,
        null,
        'nonsense',
        { ...good, id: 'short', title: 'x' },
        { ...good, id: 'body', body: 'too short' },
        { ...good, id: 'cat', category: 'advertising' },
        { ...good, id: 'future', publishedAt: '2027-01-01' },
        { ...good, id: 'expiry', expiresAt: '2026-09-01' },
        { ...good, id: 'bad-expiry', expiresAt: 'soon' },
      ],
      TODAY
    );
    expect(items).toHaveLength(1);
    // Eight of the nine rows above fail at least one rule.
    expect(rejected).toBe(8);
  });

  it('returns an empty result rather than throwing for junk input', () => {
    for (const junk of [null, 42, 'text', { announcements: 'no' }, {}]) {
      expect(validateAnnouncementPack(junk, TODAY)).toEqual({ items: [], rejected: 0 });
    }
  });

  it('caps the pack size so one file cannot fill a phone', () => {
    const huge = Array.from({ length: MAX_PACK_ANNOUNCEMENTS + 25 }, (_, index) => ({ ...good, id: `n${index}` }));
    const { items, rejected } = validateAnnouncementPack(huge, TODAY);
    expect(items).toHaveLength(MAX_PACK_ANNOUNCEMENTS);
    expect(rejected).toBe(25);
  });

  it('sanitises dangerous source URLs and strips control characters from text', () => {
    const { items } = validateAnnouncementPack(
      [{ ...good, sourceUrl: 'javascript:alert(1)', title: 'Line\u0000breaks\u0007 removed here' }],
      TODAY
    );
    expect(items[0]?.sourceUrl).toBeUndefined();
    expect(items[0]?.title).not.toMatch(/[\u0000-\u001F\u007F]/);
  });

  it('accepts an https source and passes it through for display', () => {
    const { items } = validateAnnouncementPack([{ ...good, sourceUrl: 'https://example.org/notice' }], TODAY);
    expect(items[0]?.sourceUrl).toBe('https://example.org/notice');
  });
});
