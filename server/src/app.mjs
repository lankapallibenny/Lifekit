/**
 * LIFEKIT backend — HTTP application.
 *
 * Implemented on node:http with no framework, no database driver and no external service,
 * so it can be deployed on a free tier without a card on file. Everything the app needs is
 * here: routing, security headers, body limits, rate limiting, authorization, validation
 * and audit logging.
 *
 * Security properties this file is responsible for:
 *  - No secret is ever returned to a client. The admin password hash and the session secret
 *    stay in the environment; the client only receives an HttpOnly session cookie.
 *  - The public API exposes only public content: published, unexpired announcements and
 *    published, verified listings. Draft content is never sent to an unauthenticated caller.
 *  - Every privileged route re-checks authorization server-side. Client-side hiding is not a
 *    security control and is not relied on anywhere.
 *  - Requests are body-size limited, JSON-parse guarded, validated with allow-lists and
 *    rate limited per IP. Login attempts are limited more strictly than reads.
 *  - Responses carry a strict Content-Security-Policy and related headers.
 */
import { createHash } from 'node:crypto';
import { authorize, clearSessionCookie, createSession, sessionCookie, SESSION_TTL_MS, verifyPassword } from './auth.mjs';
import { MAX_BODY_BYTES, validateAnnouncement, validateListing, validateReport } from './validate.mjs';

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cache-Control': 'no-store',
};

export class RateLimiter {
  constructor({ windowMs = 60_000, max = 60 } = {}) {
    this.windowMs = windowMs;
    this.max = max;
    this.buckets = new Map();
  }
  /** Returns {allowed, remaining, retryAfterSeconds}. */
  check(key, now = Date.now()) {
    const bucket = this.buckets.get(key);
    if (!bucket || now - bucket.start >= this.windowMs) {
      this.buckets.set(key, { start: now, count: 1 });
      return { allowed: true, remaining: this.max - 1, retryAfterSeconds: 0 };
    }
    bucket.count += 1;
    if (bucket.count > this.max) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.start + this.windowMs - now) / 1000)),
      };
    }
    return { allowed: true, remaining: this.max - bucket.count, retryAfterSeconds: 0 };
  }
  prune(now = Date.now()) {
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.start >= this.windowMs) this.buckets.delete(key);
    }
  }
}

function hashIp(ip, salt) {
  // Logs and rate-limit keys hold a salted hash rather than the raw address.
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

function json(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...SECURITY_HEADERS,
    ...extraHeaders,
  });
  res.end(body);
}

async function readJsonBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve) => {
    let size = 0;
    let settled = false;
    const chunks = [];
    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > limit) {
        // Stop buffering and drain the rest of the upload, so the client receives a proper
        // 413 instead of a connection reset. Dropping the socket here would look to a user
        // like the service is broken.
        settled = true;
        chunks.length = 0;
        req.resume();
        resolve({ ok: false, error: 'body too large', tooLarge: true });
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.trim() === '') return resolve({ ok: true, value: {} });
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          return resolve({ ok: false, error: 'body must be a JSON object' });
        }
        resolve({ ok: true, value: parsed });
      } catch {
        resolve({ ok: false, error: 'body is not valid JSON' });
      }
    });
    req.on('error', () => resolve({ ok: false, error: 'request error' }));
  });
}

/**
 * Build the request handler.
 *
 * @param {object} options
 * @param {object} options.store       Content store (FileStore or MemoryStore)
 * @param {object} options.env         Reads ADMIN password hash + session secret
 * @param {Function} [options.now]     Injectable clock for deterministic tests
 */
export function createApp({ store, env, now = () => new Date() }) {
  if (!env.LIFEKIT_SESSION_SECRET) {
    throw new Error('LIFEKIT_SESSION_SECRET must be set: refusing to start with an unsigned session scheme.');
  }
  const readLimiter = new RateLimiter({ windowMs: 60_000, max: 120 });
  const writeLimiter = new RateLimiter({ windowMs: 60_000, max: 30 });
  const loginLimiter = new RateLimiter({ windowMs: 10 * 60_000, max: 8 });
  const reportLimiter = new RateLimiter({ windowMs: 60 * 60_000, max: 10 });
  const ipSalt = env.LIFEKIT_IP_SALT ?? env.LIFEKIT_SESSION_SECRET;

  return async function handle(req, res) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const ip = (req.headers['x-forwarded-for']?.split(',')[0] ?? req.socket?.remoteAddress ?? 'unknown').trim();
    const ipKey = hashIp(ip, ipSalt);
    const session = authorize(req, env.LIFEKIT_SESSION_SECRET, now().getTime());

    if (req.method === 'OPTIONS') {
      // Same-origin only: no permissive CORS, so browser requests from other origins fail.
      res.writeHead(204, { Allow: 'GET, POST, PATCH, OPTIONS', ...SECURITY_HEADERS });
      res.end();
      return;
    }

    const requireAdmin = () => {
      if (!session) {
        json(res, 401, { error: 'Authentication required.' });
        return false;
      }
      return true;
    };

    try {
      /* ----------------------------- public ----------------------------- */
      if (req.method === 'GET' && url.pathname === '/api/health') {
        json(res, 200, { status: 'ok', time: now().toISOString() });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/announcements') {
        const limit = readLimiter.check(`read:${ipKey}`, now().getTime());
        if (!limit.allowed) {
          json(res, 429, { error: 'Too many requests.' }, { 'Retry-After': String(limit.retryAfterSeconds) });
          return;
        }
        const language = url.searchParams.get('language');
        json(res, 200, { announcements: store.publicAnnouncements(now(), language) });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/directory') {
        const limit = readLimiter.check(`read:${ipKey}`, now().getTime());
        if (!limit.allowed) {
          json(res, 429, { error: 'Too many requests.' }, { 'Retry-After': String(limit.retryAfterSeconds) });
          return;
        }
        const listings = store
          .listListings()
          .filter((row) => row.verification === 'verified')
          .map((row) => ({
            id: row.id,
            organisation: row.organisation,
            category: row.category,
            region: row.region,
            city: row.city ?? '',
            services: row.services,
            contact: row.contact,
            website: row.website,
            sourceUrl: row.sourceUrl,
            lastVerified: row.lastVerified,
            verifiedByName: row.verifiedByName,
            verification: row.verification,
            published: row.published,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          }));
        json(res, 200, { listings });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/reports') {
        const limit = reportLimiter.check(`report:${ipKey}`, now().getTime());
        if (!limit.allowed) {
          json(res, 429, { error: 'Too many reports from this address. Try again later.' });
          return;
        }
        const body = await readJsonBody(req);
        if (!body.ok) {
          json(res, body.tooLarge ? 413 : 400, { error: body.error });
          return;
        }
        const parsed = validateReport(body.value);
        if (!parsed.ok) {
          json(res, 422, { error: 'Validation failed', details: parsed.errors });
          return;
        }
        const report = await store.insertReport(parsed.value);
        // Reports are intentionally not tied to a person, and no IP is stored with them.
        json(res, 201, { id: report.id, status: report.status });
        return;
      }

      /* ----------------------------- admin auth ----------------------------- */
      if (req.method === 'POST' && url.pathname === '/api/admin/login') {
        const limit = loginLimiter.check(`login:${ipKey}`, now().getTime());
        if (!limit.allowed) {
          json(res, 429, { error: 'Too many attempts. Try again later.' }, { 'Retry-After': String(limit.retryAfterSeconds) });
          return;
        }
        const body = await readJsonBody(req, 4096);
        if (!body.ok) {
          json(res, body.tooLarge ? 413 : 400, { error: body.error });
          return;
        }
        const password = typeof body.value.password === 'string' ? body.value.password : '';
        const stored = env.LIFEKIT_ADMIN_PASSWORD_HASH ?? '';
        // Same generic response whether the password is wrong or the configuration is missing.
        if (!password || !stored || !verifyPassword(password, stored)) {
          json(res, 401, { error: 'Invalid credentials.' });
          return;
        }
        const token = createSession(env.LIFEKIT_SESSION_SECRET, { actor: 'admin', now: now().getTime() });
        json(res, 200, { ok: true, expiresInSeconds: Math.floor(SESSION_TTL_MS / 1000) }, {
          'Set-Cookie': sessionCookie(token, { secure: env.LIFEKIT_COOKIE_SECURE !== 'false' }),
        });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/admin/logout') {
        json(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie() });
        return;
      }

      /* ----------------------------- admin: announcements ----------------------------- */
      if (url.pathname.startsWith('/api/admin/announcements')) {
        if (!requireAdmin()) return;
        const limit = writeLimiter.check(`write:${ipKey}`, now().getTime());
        if (!limit.allowed) {
          json(res, 429, { error: 'Too many requests.' }, { 'Retry-After': String(limit.retryAfterSeconds) });
          return;
        }

        if (req.method === 'GET' && url.pathname === '/api/admin/announcements') {
          json(res, 200, { announcements: store.listAnnouncements({ includeUnpublished: true }) });
          return;
        }

        if (req.method === 'POST' && url.pathname === '/api/admin/announcements') {
          const body = await readJsonBody(req);
          if (!body.ok) {
            json(res, body.tooLarge ? 413 : 400, { error: body.error });
            return;
          }
          const parsed = validateAnnouncement(body.value, now());
          if (!parsed.ok) {
            json(res, 422, { error: 'Validation failed', details: parsed.errors });
            return;
          }
          const created = await store.insertAnnouncement(parsed.value, session.actor);
          json(res, 201, { announcement: created });
          return;
        }

        if (req.method === 'PATCH') {
          const id = url.pathname.split('/')[4];
          if (!id) {
            json(res, 400, { error: 'Announcement id is required.' });
            return;
          }
          const body = await readJsonBody(req);
          if (!body.ok) {
            json(res, body.tooLarge ? 413 : 400, { error: body.error });
            return;
          }
          // Only a small allow-list of mutable fields is accepted on update.
          const patch = {};
          if (body.value.status !== undefined) {
            if (!['draft', 'published'].includes(body.value.status)) {
              json(res, 422, { error: 'Validation failed', details: ['status must be draft or published'] });
              return;
            }
            patch.status = body.value.status;
          }
          if (body.value.expiresAt !== undefined) {
            const validated = validateAnnouncement(
              { ...store.listAnnouncements({ includeUnpublished: true }).find((row) => row.id === id), expiresAt: body.value.expiresAt, title: 'validation', body: 'validation placeholder text long enough' },
              now()
            );
            if (!validated.ok) {
              json(res, 422, { error: 'Validation failed', details: validated.errors });
              return;
            }
            patch.expiresAt = validated.value.expiresAt;
          }
          if (Object.keys(patch).length === 0) {
            json(res, 422, { error: 'Validation failed', details: ['provide status and/or expiresAt'] });
            return;
          }
          const updated = await store.updateAnnouncement(id, patch, session.actor);
          if (!updated) {
            json(res, 404, { error: 'Announcement not found.' });
            return;
          }
          json(res, 200, { announcement: updated });
          return;
        }
      }

      /* ----------------------------- admin: directory ----------------------------- */
      if (url.pathname.startsWith('/api/admin/directory')) {
        if (!requireAdmin()) return;
        const limit = writeLimiter.check(`write:${ipKey}`, now().getTime());
        if (!limit.allowed) {
          json(res, 429, { error: 'Too many requests.' }, { 'Retry-After': String(limit.retryAfterSeconds) });
          return;
        }

        if (req.method === 'GET' && url.pathname === '/api/admin/directory') {
          json(res, 200, { listings: store.listListings({ includeUnpublished: true }) });
          return;
        }

        if (req.method === 'POST' && url.pathname === '/api/admin/directory') {
          const body = await readJsonBody(req);
          if (!body.ok) {
            json(res, body.tooLarge ? 413 : 400, { error: body.error });
            return;
          }
          const parsed = validateListing(body.value, now());
          if (!parsed.ok) {
            json(res, 422, { error: 'Validation failed', details: parsed.errors });
            return;
          }
          const created = await store.insertListing(parsed.value, session.actor);
          json(res, 201, { listing: created });
          return;
        }

        if (req.method === 'PATCH') {
          const id = url.pathname.split('/')[4];
          if (!id) {
            json(res, 400, { error: 'Listing id is required.' });
            return;
          }
          const body = await readJsonBody(req);
          if (!body.ok) {
            json(res, body.tooLarge ? 413 : 400, { error: body.error });
            return;
          }
          const existing = store.listListings({ includeUnpublished: true }).find((row) => row.id === id);
          if (!existing) {
            json(res, 404, { error: 'Listing not found.' });
            return;
          }
          const merged = {
            ...existing,
            verification: body.value.verification ?? existing.verification,
            verifiedByName: body.value.verifiedByName ?? existing.verifiedByName,
            published: body.value.published ?? existing.published,
            lastVerified: body.value.lastVerified ?? existing.lastVerified,
          };
          const parsed = validateListing(merged, now());
          if (!parsed.ok) {
            json(res, 422, { error: 'Validation failed', details: parsed.errors });
            return;
          }
          const updated = await store.updateListing(
            id,
            {
              verification: parsed.value.verification,
              verifiedByName: parsed.value.verifiedByName,
              published: parsed.value.published,
              lastVerified: parsed.value.lastVerified,
            },
            session.actor
          );
          json(res, 200, { listing: updated });
          return;
        }
      }

      /* ----------------------------- admin: reports and audit ----------------------------- */
      if (req.method === 'GET' && url.pathname === '/api/admin/reports') {
        if (!requireAdmin()) return;
        json(res, 200, { reports: store.listReports() });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/admin/audit') {
        if (!requireAdmin()) return;
        const limit = Number(url.searchParams.get('limit') ?? 100);
        json(res, 200, { audit: store.listAudit(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 100) });
        return;
      }

      json(res, 404, { error: 'Not found.' });
    } catch (error) {
      // Never echo internals to the caller; log a short line for the operator.
      console.error('[lifekit] request failed:', error instanceof Error ? error.message : 'unknown error');
      if (!res.headersSent) json(res, 500, { error: 'Server error.' });
    } finally {
      readLimiter.prune(now().getTime());
      writeLimiter.prune(now().getTime());
    }
  };
}
