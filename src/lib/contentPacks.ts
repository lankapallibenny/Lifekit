/**
 * Validation for optional published content packs.
 *
 * LIFEKIT ships its written content inside the app. An operator may additionally publish a
 * reviewed pack at a fixed path, and the app fetches it **only** when the user has switched
 * that on in Settings. Because a pack is remote input, it is treated as untrusted: every field
 * is allow-listed, lengths are capped, and anything that does not look like a reviewed message
 * is dropped and counted rather than displayed.
 *
 * The directory pack is validated by `validateListingPack` in `src/pages/Community.tsx`; this
 * module covers the announcement feed.
 */
import { cleanMultiline, cleanText } from './shared';
import { safeUrl } from './backup';
import { todayISO } from './dates';
import type { Announcement } from './models';

const CATEGORIES = ['feature', 'tip', 'update', 'security', 'privacy', 'service'] as const;
const PRIORITIES = ['low', 'normal', 'high'] as const;

/** A published pack may contain at most this many messages. */
export const MAX_PACK_ANNOUNCEMENTS = 100;
/** Announcement bodies are capped so one pack cannot bloat local storage. */
export const MAX_PACK_BODY = 2000;

export interface PackValidation<T> {
  items: T[];
  rejected: number;
}

export function validateAnnouncementPack(raw: unknown, today = todayISO()): PackValidation<Announcement> {
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { announcements?: unknown }).announcements)
      ? ((raw as { announcements: unknown[] }).announcements)
      : null;
  if (!rows) return { items: [], rejected: 0 };

  let rejected = rows.length > MAX_PACK_ANNOUNCEMENTS ? rows.length - MAX_PACK_ANNOUNCEMENTS : 0;
  const items: Announcement[] = [];

  for (const row of rows.slice(0, MAX_PACK_ANNOUNCEMENTS)) {
    if (typeof row !== 'object' || row === null) {
      rejected++;
      continue;
    }
    const record = row as Record<string, unknown>;
    const title = cleanText(record.title, 160);
    const body = cleanMultiline(record.body, MAX_PACK_BODY);
    const category = CATEGORIES.find((value) => value === record.category);
    const priority = PRIORITIES.find((value) => value === record.priority) ?? 'normal';
    const language = cleanText(record.language, 12) || 'en';
    const publishedAt = cleanText(record.publishedAt, 20) || today;
    const expiresRaw = cleanText(record.expiresAt, 20);
    const sourceUrl = record.sourceUrl ? safeUrl(record.sourceUrl) : '';

    const validPublished = /^\d{4}-\d{2}-\d{2}$/.test(publishedAt) && publishedAt <= today;
    const validExpiry = expiresRaw === '' || (/^\d{4}-\d{2}-\d{2}$/.test(expiresRaw) && expiresRaw >= publishedAt);
    if (title.length < 4 || body.length < 20 || !category || !validPublished || !validExpiry) {
      rejected++;
      continue;
    }

    items.push({
      id: cleanText(record.id, 80) || `pack_${items.length}`,
      title,
      body,
      category,
      priority,
      language,
      publishedAt,
      expiresAt: expiresRaw === '' ? null : expiresRaw,
      sourceUrl: sourceUrl === '' ? undefined : sourceUrl,
      // A pack can never claim something is not an operator message, and can never mark its
      // own content as a bundled LIFEKIT example.
      sample: false,
      notifyEligible: record.notifyEligible === true && priority !== 'low',
    });
  }

  return { items, rejected };
}
