/**
 * LIFEKIT backend — request validation.
 *
 * Every field that reaches the datastore passes through here. Validation is allow-list
 * based: unknown keys are dropped rather than stored, strings are length-capped and
 * control characters stripped, URLs must be http(s), dates must be real ISO dates, and
 * enums are matched exactly. Nothing here trusts the client.
 */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function text(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function multiline(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value
    .replace(CONTROL_CHARS, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

export function bool(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

export function isoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return value;
}

export function httpUrl(value) {
  const cleaned = text(value, 500);
  if (!/^https?:\/\/[^\s]+$/i.test(cleaned)) return null;
  try {
    const url = new URL(cleaned);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function oneOf(value, allowed, fallback = null) {
  return allowed.includes(value) ? value : fallback;
}

export const ANNOUNCEMENT_CATEGORIES = ['feature', 'tip', 'update', 'security', 'privacy', 'service'];
export const ANNOUNCEMENT_PRIORITIES = ['low', 'normal', 'high'];
export const DIRECTORY_CATEGORIES = [
  'food',
  'education',
  'volunteering',
  'community',
  'emergency',
  'public-support',
];

export const MAX_BODY_BYTES = 64 * 1024;

/** Validate an announcement payload. Returns {ok, value, errors}. */
export function validateAnnouncement(input, now = new Date()) {
  const errors = [];
  const row = input && typeof input === 'object' ? input : {};
  const title = text(row.title, 160);
  const body = multiline(row.body, 4000);
  const category = oneOf(row.category, ANNOUNCEMENT_CATEGORIES);
  const priority = oneOf(row.priority, ANNOUNCEMENT_PRIORITIES, 'normal');
  const language = text(row.language ?? 'en', 12) || 'en';
  const publishedAt = isoDate(row.publishedAt) ?? now.toISOString().slice(0, 10);
  const expiresAtRaw = row.expiresAt === null || row.expiresAt === undefined || row.expiresAt === '' ? null : isoDate(row.expiresAt);
  const sourceUrl = row.sourceUrl ? httpUrl(row.sourceUrl) : null;

  if (title.length < 4) errors.push('title must be at least 4 characters');
  if (body.length < 20) errors.push('body must be at least 20 characters');
  if (!category) errors.push(`category must be one of: ${ANNOUNCEMENT_CATEGORIES.join(', ')}`);
  if (row.expiresAt && !expiresAtRaw) errors.push('expiresAt must be a valid ISO date (YYYY-MM-DD) or empty');
  if (expiresAtRaw && expiresAtRaw < publishedAt) errors.push('expiresAt cannot be before publishedAt');
  if (row.sourceUrl && !sourceUrl) errors.push('sourceUrl must be an http(s) URL');
  if (row.notifyEligible === true && priority === 'low') {
    // Low-priority notices must not be pushed at people; this is a product rule, not a bug.
    errors.push('low priority announcements cannot be notification eligible');
  }

  if (errors.length > 0) return { ok: false, errors, value: null };

  return {
    ok: true,
    errors: [],
    value: {
      title,
      body,
      category,
      priority,
      language,
      publishedAt,
      expiresAt: expiresAtRaw,
      sourceUrl,
      notifyEligible: bool(row.notifyEligible, false),
      status: oneOf(row.status, ['draft', 'published'], 'draft'),
    },
  };
}

/** Validate a community directory listing. Verified listings require a source and date. */
export function validateListing(input, now = new Date()) {
  const errors = [];
  const row = input && typeof input === 'object' ? input : {};
  const organisation = text(row.organisation, 160);
  const services = multiline(row.services, 2000);
  const region = text(row.region, 120);
  const city = text(row.city, 120);
  const contact = text(row.contact, 300);
  const category = oneOf(row.category, DIRECTORY_CATEGORIES);
  const sourceUrl = httpUrl(row.sourceUrl);
  const website = row.website ? httpUrl(row.website) : null;
  const lastVerified = isoDate(row.lastVerified) ?? now.toISOString().slice(0, 10);
  const verification = oneOf(row.verification, ['verified', 'unverified'], 'unverified');
  const published = bool(row.published, false);
  const verifiedByName = text(row.verifiedByName, 120);

  if (organisation.length < 2) errors.push('organisation is required');
  if (services.length < 10) errors.push('services must be at least 10 characters');
  if (region.length < 2) errors.push('region is required');
  if (!category) errors.push(`category must be one of: ${DIRECTORY_CATEGORIES.join(', ')}`);
  if (!sourceUrl) errors.push('sourceUrl must be a valid http(s) URL so a reviewer can check the listing');
  if (lastVerified > now.toISOString().slice(0, 10)) errors.push('lastVerified cannot be in the future');
  // A listing can only be published once it is marked verified by a named reviewer.
  if (published && verification !== 'verified') errors.push('only verified listings may be published');
  if (published && verifiedByName.length < 2) errors.push('published listings must record who verified them');

  if (errors.length > 0) return { ok: false, errors, value: null };

  return {
    ok: true,
    errors: [],
    value: {
      organisation,
      services,
      region,
      city,
      contact,
      category,
      sourceUrl,
      website,
      lastVerified,
      verification,
      verifiedByName,
      published,
    },
  };
}

/** Validate a public "this listing is outdated" report. */
export function validateReport(input) {
  const errors = [];
  const row = input && typeof input === 'object' ? input : {};
  const listingId = text(row.listingId, 80);
  const reason = oneOf(row.reason, ['outdated', 'wrong-contact', 'closed', 'other']);
  const details = multiline(row.details, 600);
  if (!listingId) errors.push('listingId is required');
  if (!reason) errors.push('reason must be outdated, wrong-contact, closed or other');
  if (errors.length > 0) return { ok: false, errors, value: null };
  return { ok: true, errors: [], value: { listingId, reason, details } };
}
