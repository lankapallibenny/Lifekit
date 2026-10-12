import { defineConfig } from 'vitest/config';

/**
 * Test configuration lives in its own file so the application's Vite config stays free of
 * test-only settings (and so the two can be type-checked against their own tooling).
 * Vitest transforms TSX through esbuild using the project's tsconfig `jsx` setting, so no
 * React plugin is needed here.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    // Keep output readable in CI logs while still reporting every failure.
    reporters: ['default'],
  },
});
