#!/usr/bin/env node
/**
 * LIFEKIT backend entry point.
 *
 * Runs the optional public-content API: announcements and reviewed community listings.
 * The core LIFEKIT app never needs this server — it is only for operators who want to
 * publish public content to their users.
 *
 * Start:
 *   LIFEKIT_SESSION_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" \
 *   LIFEKIT_ADMIN_PASSWORD_HASH="$(npm run --silent server:hash -- 'your password')" \
 *   node server/src/index.mjs
 *
 * Environment variables are documented in server/.env.example. No secret is ever sent to
 * the browser, and the server refuses to start without a session secret.
 */
import { createServer } from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.mjs';
import { FileStore } from './store.mjs';
import { hashPassword } from './auth.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// `npm run server:hash -- "password"` prints a scrypt hash for the environment variable.
if (process.argv[2] === '--hash') {
  const password = process.argv[3];
  if (!password) {
    console.error('Usage: node server/src/index.mjs --hash "your password"');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error('Choose a password of at least 12 characters. Length matters more than symbols.');
    process.exit(1);
  }
  console.log(hashPassword(password));
  process.exit(0);
}

const env = process.env;
const port = Number(env.PORT ?? 8787);
const dataFile = env.LIFEKIT_DATA_FILE ?? join(HERE, '..', 'data', 'db.json');

if (!env.LIFEKIT_SESSION_SECRET || env.LIFEKIT_SESSION_SECRET.length < 32) {
  console.error(
    'Refusing to start: set LIFEKIT_SESSION_SECRET to at least 32 random characters.\n' +
      'Example: LIFEKIT_SESSION_SECRET="$(node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))")"'
  );
  process.exit(1);
}
if (!env.LIFEKIT_ADMIN_PASSWORD_HASH) {
  console.warn(
    'Warning: LIFEKIT_ADMIN_PASSWORD_HASH is not set, so no administrator can log in. ' +
      'Generate one with: npm run server:hash -- "a long passphrase"'
  );
}

const store = new FileStore(dataFile);
const app = createApp({ store, env });

const server = createServer((req, res) => {
  void app(req, res);
});

server.listen(port, env.HOST ?? '0.0.0.0', () => {
  console.log(`LIFEKIT content API listening on http://${env.HOST ?? '0.0.0.0'}:${port}`);
  console.log(`Data file: ${dataFile}`);
  console.log('Public routes: GET /api/health, GET /api/announcements, GET /api/directory, POST /api/reports');
  console.log('Admin routes:  POST /api/admin/login, /api/admin/logout, GET|POST /api/admin/announcements,');
  console.log('               GET|POST /api/admin/directory, GET /api/admin/reports, GET /api/admin/audit');
  console.log('Serve the built frontend from a static host, and put this API behind the same origin or a reverse proxy.');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`\nReceived ${signal}; shutting down.`);
    server.close(() => process.exit(0));
    // Give in-flight requests a moment, then exit regardless.
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
