/**
 * LIFEKIT backend — pluggable content store.
 *
 * The default implementation is a JSON file store: it needs no database, no account and no
 * payment, which keeps the "free to start" promise honest. The interface is deliberately
 * narrow (list/get/insert/update/appendAudit) so an operator who outgrows a single process
 * can swap in PostgreSQL by writing one adapter — `PostgresStore` notes in the README show
 * the equivalent SQL and the least-privilege role it should use.
 *
 * Writes are atomic (temp file + rename) and serialized through a promise chain so two
 * concurrent requests cannot interleave a read-modify-write on the same file.
 *
 * The persistence hooks are `_load` / `_persist` (not private `#` methods) precisely so a
 * subclass can override them: `MemoryStore` swaps the file for an in-object database, which
 * is what the test suite uses.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const EMPTY_DB = { announcements: [], listings: [], reports: [], audit: [], version: 1 };

export class FileStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.queue = Promise.resolve();
    this.db = this._load();
  }

  /** Read the JSON file. Overridable by subclasses (see MemoryStore). */
  _load() {
    try {
      if (!existsSync(this.filePath)) return structuredClone(EMPTY_DB);
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8'));
      return {
        announcements: Array.isArray(parsed.announcements) ? parsed.announcements : [],
        listings: Array.isArray(parsed.listings) ? parsed.listings : [],
        reports: Array.isArray(parsed.reports) ? parsed.reports : [],
        audit: Array.isArray(parsed.audit) ? parsed.audit.slice(-500) : [],
        version: 1,
      };
    } catch {
      // A corrupt file must not take the service down; start empty and let the operator restore.
      return structuredClone(EMPTY_DB);
    }
  }

  /** Write the JSON file atomically. Overridable by subclasses (see MemoryStore). */
  _persist() {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.${randomUUID()}.tmp`;
    writeFileSync(temp, JSON.stringify(this.db, null, 2), { mode: 0o600 });
    renameSync(temp, this.filePath);
  }

  /** Serialize mutations so concurrent requests cannot corrupt the file. */
  _mutate(work) {
    const run = this.queue.then(() => {
      const result = work(this.db);
      this._persist();
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  listAnnouncements({ includeUnpublished = false } = {}) {
    const rows = includeUnpublished
      ? [...this.db.announcements]
      : this.db.announcements.filter((row) => row.status === 'published');
    return rows.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.createdAt.localeCompare(a.createdAt));
  }

  /** Public feed: published, not expired, optionally filtered by language. */
  publicAnnouncements(now = new Date(), language = null) {
    const today = now.toISOString().slice(0, 10);
    return this.listAnnouncements()
      .filter((row) => row.publishedAt <= today)
      .filter((row) => !row.expiresAt || row.expiresAt >= today)
      .filter((row) => (language ? row.language === language : true))
      .map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        category: row.category,
        priority: row.priority,
        language: row.language,
        publishedAt: row.publishedAt,
        expiresAt: row.expiresAt,
        sourceUrl: row.sourceUrl,
        notifyEligible: row.notifyEligible,
      }));
  }

  insertAnnouncement(value, actor) {
    return this._mutate((db) => {
      const row = {
        ...value,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: actor,
      };
      db.announcements.push(row);
      db.audit.push({ at: row.createdAt, actor, action: 'announcement.create', targetId: row.id });
      return row;
    });
  }

  updateAnnouncement(id, patch, actor) {
    return this._mutate((db) => {
      const index = db.announcements.findIndex((row) => row.id === id);
      if (index < 0) return null;
      const updated = { ...db.announcements[index], ...patch, updatedAt: new Date().toISOString() };
      db.announcements[index] = updated;
      db.audit.push({ at: updated.updatedAt, actor, action: 'announcement.update', targetId: id, fields: Object.keys(patch) });
      return updated;
    });
  }

  listListings({ includeUnpublished = false } = {}) {
    const rows = includeUnpublished ? [...this.db.listings] : this.db.listings.filter((row) => row.published);
    return rows.sort((a, b) => a.organisation.localeCompare(b.organisation));
  }

  insertListing(value, actor) {
    return this._mutate((db) => {
      const row = {
        ...value,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: actor,
      };
      db.listings.push(row);
      db.audit.push({ at: row.createdAt, actor, action: 'listing.create', targetId: row.id });
      return row;
    });
  }

  updateListing(id, patch, actor) {
    return this._mutate((db) => {
      const index = db.listings.findIndex((row) => row.id === id);
      if (index < 0) return null;
      const updated = { ...db.listings[index], ...patch, updatedAt: new Date().toISOString() };
      db.listings[index] = updated;
      db.audit.push({ at: updated.updatedAt, actor, action: 'listing.update', targetId: id, fields: Object.keys(patch) });
      return updated;
    });
  }

  insertReport(value) {
    return this._mutate((db) => {
      const row = { ...value, id: randomUUID(), createdAt: new Date().toISOString(), status: 'open' };
      db.reports.push(row);
      // Reports contain no personal data by design, so they can be logged without redaction.
      db.audit.push({ at: row.createdAt, actor: 'public', action: 'report.create', targetId: row.listingId });
      return row;
    });
  }

  listAudit(limit = 100) {
    return [...this.db.audit].slice(-limit).reverse();
  }

  listReports() {
    return [...this.db.reports].reverse();
  }
}

/**
 * In-memory store used by the automated tests. Identical interface, no filesystem.
 */
export class MemoryStore extends FileStore {
  constructor() {
    super(':memory:');
    this.db = structuredClone(EMPTY_DB);
  }
  /** Write the JSON file atomically. Overridable by subclasses (see MemoryStore). */
  _persist() {}
}
