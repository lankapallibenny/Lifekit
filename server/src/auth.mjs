/**
 * LIFEKIT backend — authentication and session handling.
 *
 * Design decisions, in the order that matters:
 *  1. Passwords are never stored. The administrator credential is supplied as a scrypt hash
 *     in an environment variable (`LIFEKIT_ADMIN_PASSWORD_HASH`), so the plaintext password
 *     exists only in the operator's head. `npm run server:hash` prints a hash.
 *  2. Sessions are stateless HMAC-signed tokens. The signing key comes from
 *     `LIFEKIT_SESSION_SECRET`; there is no default, so the server refuses to start without
 *     one rather than shipping a weak fallback.
 *  3. Comparison is timing-safe, tokens expire, and every failure is generic — the response
 *     never reveals whether the password or the account was wrong.
 *  4. There is no hardcoded frontend password and no admin check in client code: the client
 *     only ever learns what the server chooses to return.
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

/** Hash a password for storage in an environment variable: `scrypt$N$r$p$salt$hash`. */
export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt}$${derived.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nRaw, rRaw, pRaw, salt, hashHex] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
  let expected;
  try {
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (expected.length === 0) return false;
  let derived;
  try {
    derived = scryptSync(password, salt, expected.length, { N, r, p });
  } catch {
    return false;
  }
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/** Create a signed session token. `role` is always 'admin' in this release. */
export function createSession(secret, { actor = 'admin', ttlMs = SESSION_TTL_MS, now = Date.now() } = {}) {
  if (!secret) throw new Error('A session secret is required.');
  const body = base64url(
    JSON.stringify({ actor, role: 'admin', iat: now, exp: now + ttlMs, nonce: randomBytes(8).toString('hex') })
  );
  return `${body}.${sign(body, secret)}`;
}

/** Verify a token: signature first, then expiry. Returns the payload or null. */
export function verifySession(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || !secret) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = sign(body, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || typeof payload.exp !== 'number' || payload.exp <= now) return null;
  if (payload.role !== 'admin') return null;
  return payload;
}

export function parseCookies(header) {
  const out = {};
  if (typeof header !== 'string' || header === '') return out;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export const SESSION_COOKIE = 'lifekit_admin';

export function sessionCookie(token, { secure = true, maxAgeMs = SESSION_TTL_MS } = {}) {
  const attributes = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (secure) attributes.push('Secure');
  return attributes.join('; ');
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

/** Resolve the caller's admin identity from a request. Returns null when not authorized. */
export function authorize(request, secret, now = Date.now()) {
  const cookies = parseCookies(request.headers?.cookie ?? '');
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const payload = verifySession(token, secret, now);
  if (!payload) return null;
  return { actor: payload.actor, role: payload.role, expiresAt: payload.exp };
}
