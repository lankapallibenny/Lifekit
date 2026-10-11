/**
 * Vitest setup.
 *
 * jsdom does not implement IndexedDB, so `fake-indexeddb` provides a real, spec-shaped
 * implementation. That means the persistence tests exercise the same code path as a
 * browser (upgrade, transactions, object stores) rather than a mock.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { __resetStorageForTests } from '../src/lib/storage';

// jsdom has no matchMedia; the theme layer and useMediaQuery depend on it.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

// Deterministic scroll behaviour for the router tests.
window.scrollTo = vi.fn();

// crypto.randomUUID exists in modern jsdom, but keep a fallback for older versions.
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: () => `uuid-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`,
  });
}

beforeEach(async () => {
  localStorage.clear();
  window.location.hash = '';
  delete (globalThis as { __LIFEKIT_FORCE_MEMORY__?: boolean }).__LIFEKIT_FORCE_MEMORY__;
  // Close the connection the previous test left open, then drop the database, so every
  // test starts from an empty store — the equivalent of a fresh browser profile.
  await __resetStorageForTests();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase('lifekit');
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
