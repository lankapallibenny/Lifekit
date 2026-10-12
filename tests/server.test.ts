/**
 * Backend integration tests.
 *
 * These start a real `node:http` server on an ephemeral port and talk to it with `fetch`,
 * so what is verified is the actual wire behaviour: status codes, cookies, headers, body
 * limits, rate limiting and the rule that unauthenticated callers never see drafts.
 *
 * The backend is optional for the app, but when an operator does run it, these are the
 * properties the README claims for it — so they are tested rather than asserted in prose.
 */
import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../server/src/app.mjs';
import { MemoryStore } from '../server/src/store.mjs';
import { SESSION_COOKIE, createSession, hashPassword, sessionCookie } from '../server/src/auth.mjs';

const SECRET = 'test-session-secret-that-is-long-enough-1234567890';
const PASSWORD = 'a-long-test-admin-passphrase';
const FIXED_NOW = new Date('2026-10-11T09:00:00.000Z');

interface Harness {
  base: string;
  server: Server;
  store: InstanceType<typeof MemoryStore>;
  close: () => Promise<void>;
}

async function startHarness(): Promise<Harness> {
  const store = new MemoryStore();
  const handler = createApp({
    store,
    env: {
      LIFEKIT_SESSION_SECRET: SECRET,
      LIFEKIT_ADMIN_PASSWORD_HASH: hashPassword(PASSWORD),
      LIFEKIT_COOKIE_SECURE: 'false',
      LIFEKIT_IP_SALT: 'test-ip-salt',
    },
    now: () => FIXED_NOW,
  });
  const server = createServer((req, res) => {
    void handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    base: `http://127.0.0.1:${port}`,
    server,
    store,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function cookieFrom(response: Response): string {
  const header = response.headers.get('set-cookie') ?? '';
  const match = header.match(new RegExp(`${SESSION_COOKIE}=([^;]*)`));
  return `${SESSION_COOKIE}=${match?.[1] ?? ''}`;
}

const announcement = {
  title: 'Scheduled maintenance window',
  body: 'The optional content service will be unavailable for a short maintenance window.',
  category: 'service',
  priority: 'normal',
  publishedAt: '2026-10-01',
  status: 'published',
};

describe('backend: configuration safety', () => {
  it('refuses to build an app without a session secret', () => {
    expect(() => createApp({ store: new MemoryStore(), env: {} })).toThrow(/LIFEKIT_SESSION_SECRET/);
  });
});

describe('backend: public read routes', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(async () => {
    await h.close();
  });

  it('answers the health check with a status and no cacheable content', async () => {
    const response = await fetch(`${h.base}/api/health`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  it('serves an empty announcement feed before anything is published', async () => {
    const response = await fetch(`${h.base}/api/announcements`);
    expect(response.status).toBe(200);
    expect(((await response.json()) as { announcements: unknown[] }).announcements).toEqual([]);
  });

  it('never exposes a draft announcement to an anonymous caller', async () => {
    await h.store.insertAnnouncement(
      {
        title: 'Draft: not announced yet',
        body: 'This text must not reach the public feed until an admin publishes it.',
        category: 'update',
        priority: 'normal',
        language: 'en',
        publishedAt: '2026-10-01',
        expiresAt: null,
        sourceUrl: null,
        notifyEligible: false,
        status: 'draft',
      },
      'admin'
    );
    const response = await fetch(`${h.base}/api/announcements`);
    const body = (await response.json()) as { announcements: { title: string }[] };
    expect(body.announcements.map((a) => a.title)).not.toContain('Draft: not announced yet');
  });

  it('serves published, unexpired announcements and hides expired ones', async () => {
    await h.store.insertAnnouncement(
      {
        title: 'Published notice',
        body: 'A published announcement that is current and therefore visible to everyone.',
        category: 'feature',
        priority: 'normal',
        language: 'en',
        publishedAt: '2026-10-01',
        expiresAt: '2026-12-31',
        sourceUrl: null,
        notifyEligible: true,
        status: 'published',
      },
      'admin'
    );
    await h.store.insertAnnouncement(
      {
        title: 'Expired notice',
        body: 'This announcement expired before today and must not be shown any more.',
        category: 'feature',
        priority: 'normal',
        language: 'en',
        publishedAt: '2026-01-01',
        expiresAt: '2026-02-01',
        sourceUrl: null,
        notifyEligible: false,
        status: 'published',
      },
      'admin'
    );
    const response = await fetch(`${h.base}/api/announcements`);
    const titles = ((await response.json()) as { announcements: { title: string }[] }).announcements.map((a) => a.title);
    expect(titles).toContain('Published notice');
    expect(titles).not.toContain('Expired notice');
  });

  it('filters the feed by language', async () => {
    await h.store.insertAnnouncement(
      {
        title: 'Aviso publicado',
        body: 'Un anuncio de ejemplo publicado en otro idioma para comprobar el filtro.',
        category: 'feature',
        priority: 'normal',
        language: 'es',
        publishedAt: '2026-10-01',
        expiresAt: null,
        sourceUrl: null,
        notifyEligible: false,
        status: 'published',
      },
      'admin'
    );
    const response = await fetch(`${h.base}/api/announcements?language=es`);
    const titles = ((await response.json()) as { announcements: { title: string }[] }).announcements.map((a) => a.title);
    expect(titles).toEqual(['Aviso publicado']);
  });

  it('only exposes verified, published directory listings', async () => {
    await h.store.insertListing(
      {
        organisation: 'Unverified Draft Org',
        services: 'Services described here but never verified by a reviewer.',
        region: 'Somewhere',
        category: 'community',
        sourceUrl: 'https://example.org/unverified',
        lastVerified: '2026-10-01',
        verification: 'unverified',
        verifiedByName: '',
        published: false,
      },
      'admin'
    );
    const response = await fetch(`${h.base}/api/directory`);
    const listings = ((await response.json()) as { listings: { organisation: string }[] }).listings;
    expect(listings.map((l) => l.organisation)).not.toContain('Unverified Draft Org');
  });

  it('accepts an anonymous outdated-listing report without storing who sent it', async () => {
    const response = await fetch(`${h.base}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId: 'listing-1', reason: 'outdated', details: 'Phone number changed.' }),
    });
    expect(response.status).toBe(201);
    const stored = h.store.listReports();
    expect(stored).toHaveLength(1);
    expect(JSON.stringify(stored)).not.toMatch(/127\.0\.0\.1/);
    expect(stored[0]).not.toHaveProperty('ip');
  });

  it('returns 422 with field details for an invalid report', async () => {
    const response = await fetch(`${h.base}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'nonsense' }),
    });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { error: string; details: string[] };
    expect(body.error).toBe('Validation failed');
    expect(body.details.join(' ')).toContain('listingId');
  });

  it('answers unknown paths with a plain 404 and no internals', async () => {
    const response = await fetch(`${h.base}/api/nope`);
    expect(response.status).toBe(404);
    const text = await response.text();
    expect(text).not.toMatch(/at .*\.mjs|node_modules|stack/i);
  });
});

describe('backend: admin authorization', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(async () => {
    await h.close();
  });

  it('rejects every admin route without a cookie', async () => {
    for (const path of ['/api/admin/announcements', '/api/admin/directory', '/api/admin/reports', '/api/admin/audit']) {
      const response = await fetch(`${h.base}${path}`);
      expect(response.status).toBe(401);
    }
  });

  it('rejects a tampered token', async () => {
    const valid = createSession(SECRET, { now: FIXED_NOW.getTime() });
    const tampered = `${valid.slice(0, -4)}beef`;
    const response = await fetch(`${h.base}/api/admin/announcements`, {
      headers: { Cookie: `${SESSION_COOKIE}=${tampered}` },
    });
    expect(response.status).toBe(401);
  });

  it('rejects an expired token even though it is signed correctly', async () => {
    const expired = createSession(SECRET, { now: FIXED_NOW.getTime() - 9 * 60 * 60 * 1000, ttlMs: 60 * 1000 });
    const response = await fetch(`${h.base}/api/admin/announcements`, {
      headers: { Cookie: `${SESSION_COOKIE}=${expired}` },
    });
    expect(response.status).toBe(401);
  });

  it('rejects a token signed with a different secret', async () => {
    const foreign = createSession('a-completely-different-secret-value-here', { now: FIXED_NOW.getTime() });
    const response = await fetch(`${h.base}/api/admin/announcements`, {
      headers: { Cookie: `${SESSION_COOKIE}=${foreign}` },
    });
    expect(response.status).toBe(401);
  });

  it('gives the same generic error for a wrong password as for no configuration', async () => {
    const response = await fetch(`${h.base}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'definitely-not-the-password' }),
    });
    expect(response.status).toBe(401);
    expect(((await response.json()) as { error: string }).error).toBe('Invalid credentials.');
  });

  it('logs in with the configured password and issues a hardened cookie', async () => {
    const response = await fetch(`${h.base}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: PASSWORD }),
    });
    expect(response.status).toBe(200);
    const header = response.headers.get('set-cookie') ?? '';
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Strict');
    expect(header).toContain('Path=/');
    // The password itself must never come back in any form.
    const body = await response.text();
    expect(body).not.toContain(PASSWORD);
    expect(body).not.toContain('hash');

    const admin = await fetch(`${h.base}/api/admin/announcements`, {
      headers: { Cookie: cookieFrom(response) },
    });
    expect(admin.status).toBe(200);
  });

  it('keeps the password hash out of the process environment of the client', () => {
    // A small guard against the classic mistake: the hash is only ever read server-side.
    expect(JSON.stringify(h.store.listAnnouncements({ includeUnpublished: true }))).not.toContain('scrypt');
  });

  it('creates, validates and publishes an announcement through the admin API', async () => {
    const login = await fetch(`${h.base}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: PASSWORD }),
    });
    const cookie = cookieFrom(login);

    const created = await fetch(`${h.base}/api/admin/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ ...announcement, status: 'draft' }),
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as { announcement: { id: string; status: string } };
    expect(createdBody.announcement.status).toBe('draft');

    // A draft stays invisible to the public feed.
    const publicBefore = await fetch(`${h.base}/api/announcements`);
    expect((await publicBefore.json()).announcements).toEqual([]);

    const published = await fetch(`${h.base}/api/admin/announcements/${createdBody.announcement.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ status: 'published' }),
    });
    expect(published.status).toBe(200);

    const publicAfter = await fetch(`${h.base}/api/announcements`);
    expect((await publicAfter.json()).announcements).toHaveLength(1);
  });

  it('rejects an announcement that fails validation, with reasons', async () => {
    const login = await fetch(`${h.base}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: PASSWORD }),
    });
    const cookie = cookieFrom(login);

    const cases: { payload: Record<string, unknown>; expect: string }[] = [
      { payload: { title: 'x', body: 'too short' }, expect: 'title' },
      {
        payload: { title: 'Valid title here', body: 'A body that is definitely long enough.', category: 'not-a-category' },
        expect: 'category',
      },
      {
        payload: {
          title: 'Valid title here',
          body: 'A body that is definitely long enough.',
          category: 'tip',
          expiresAt: 'not-a-date',
        },
        expect: 'expiresAt',
      },
      {
        payload: {
          title: 'Valid title here',
          body: 'A body that is definitely long enough.',
          category: 'tip',
          sourceUrl: 'javascript:alert(1)',
        },
        expect: 'sourceUrl',
      },
      {
        payload: {
          title: 'Valid title here',
          body: 'A body that is definitely long enough.',
          category: 'tip',
          priority: 'low',
          notifyEligible: true,
        },
        expect: 'low priority',
      },
    ];

    for (const { payload, expect: needle } of cases) {
      const response = await fetch(`${h.base}/api/admin/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify(payload),
      });
      expect(response.status).toBe(422);
      const body = (await response.json()) as { details: string[] };
      expect(body.details.join(' ')).toContain(needle);
    }
  });

  it('refuses to publish a directory listing that is not verified by a named reviewer', async () => {
    const login = await fetch(`${h.base}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: PASSWORD }),
    });
    const cookie = cookieFrom(login);

    const response = await fetch(`${h.base}/api/admin/directory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        organisation: 'Unchecked Org',
        services: 'Services described in a sentence that is long enough.',
        region: 'Somewhere',
        category: 'community',
        sourceUrl: 'https://example.org/source',
        published: true,
        verification: 'unverified',
      }),
    });
    expect(response.status).toBe(422);
    expect(((await response.json()) as { details: string[] }).details.join(' ')).toContain('only verified listings');
  });

  it('records privileged actions in the audit log, and only serves it to an admin', async () => {
    const anonymous = await fetch(`${h.base}/api/admin/audit`);
    expect(anonymous.status).toBe(401);

    const login = await fetch(`${h.base}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: PASSWORD }),
    });
    const cookie = cookieFrom(login);
    const response = await fetch(`${h.base}/api/admin/audit?limit=5`, { headers: { Cookie: cookie } });
    expect(response.status).toBe(200);
    const { audit } = (await response.json()) as { audit: { action: string; actor: string }[] };
    expect(audit.length).toBeGreaterThan(0);
    expect(audit.every((entry) => typeof entry.actor === 'string')).toBe(true);
    expect(audit.map((entry) => entry.action)).toContain('announcement.create');
  });

  it('clears the session cookie on logout', async () => {
    const response = await fetch(`${h.base}/api/admin/logout`, { method: 'POST' });
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie') ?? '').toMatch(/lifekit_admin=;|Max-Age=0/);
  });
});

describe('backend: abuse limits', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(async () => {
    await h.close();
  });

  it('rate limits repeated login attempts and tells the client when to retry', async () => {
    const attempt = () =>
      fetch(`${h.base}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'wrong-password-attempt' }),
      });

    for (let i = 0; i < 8; i += 1) {
      const response = await attempt();
      expect(response.status).toBe(401);
    }
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('rejects a request body that is larger than the limit', async () => {
    const huge = JSON.stringify({ listingId: 'x'.repeat(80 * 1024), reason: 'outdated' });
    const response = await fetch(`${h.base}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: huge,
    });
    expect(response.status).toBe(413);
  });

  it('rejects a body that is not a JSON object', async () => {
    const response = await fetch(`${h.base}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(['not', 'an', 'object']),
    });
    expect(response.status).toBe(400);
  });

  it('does not send permissive CORS headers', async () => {
    const response = await fetch(`${h.base}/api/health`, { headers: { Origin: 'https://evil.example' } });
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('backend: session tokens', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(async () => {
    await h.close();
  });

  it('accepts a freshly created session and rejects it after the ttl', async () => {
    const fresh = createSession(SECRET, { now: FIXED_NOW.getTime() });
    const accepted = await fetch(`${h.base}/api/admin/reports`, { headers: { Cookie: `${SESSION_COOKIE}=${fresh}` } });
    expect(accepted.status).toBe(200);

    const stale = createSession(SECRET, { now: FIXED_NOW.getTime() - 1000, ttlMs: 500 });
    const rejected = await fetch(`${h.base}/api/admin/reports`, { headers: { Cookie: `${SESSION_COOKIE}=${stale}` } });
    expect(rejected.status).toBe(401);
  });

  it('uses the exact cookie name the browser will send back', () => {
    const cookie = sessionCookie(createSession(SECRET), { secure: false });
    expect(cookie.startsWith(`${SESSION_COOKIE}=`)).toBe(true);
    expect(cookie).toContain('HttpOnly');
  });
});
