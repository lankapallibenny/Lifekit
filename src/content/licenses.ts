/**
 * Dependency license inventory — GENERATED FILE.
 *
 * Produced by `node scripts/dependency-inventory.mjs` from the packages actually installed
 * in node_modules, so it cannot drift from reality. Regenerate after changing dependencies:
 *   npm install && npm run inventory
 *
 * Generated: 2026-10-11T18:30:15.048Z
 */
export interface ProjectLicense {
  name: string;
  version: string;
  license: string;
  scope: 'runtime' | 'development';
  purpose: string;
  url: string;
}

export const LICENSES_GENERATED_AT = '2026-10-11T18:30:15.048Z';

export const PROJECT_LICENSES: ProjectLicense[] = [
  {
    "name": "react",
    "version": "18.3.1",
    "license": "MIT",
    "scope": "runtime",
    "purpose": "User interface rendering",
    "url": "https://reactjs.org/"
  },
  {
    "name": "react-dom",
    "version": "18.3.1",
    "license": "MIT",
    "scope": "runtime",
    "purpose": "Renders React into the browser DOM",
    "url": "https://reactjs.org/"
  },
  {
    "name": "@testing-library/dom",
    "version": "10.4.2",
    "license": "MIT",
    "scope": "development",
    "purpose": "DOM query helpers used with the testing library",
    "url": "https://github.com/testing-library/dom-testing-library#readme"
  },
  {
    "name": "@testing-library/react",
    "version": "16.3.3",
    "license": "MIT",
    "scope": "development",
    "purpose": "Renders React components inside the automated tests",
    "url": "https://github.com/testing-library/react-testing-library#readme"
  },
  {
    "name": "@testing-library/user-event",
    "version": "14.6.7",
    "license": "MIT",
    "scope": "development",
    "purpose": "Simulates real typing, clicks and keyboard input in the tests",
    "url": "https://github.com/testing-library/user-event#readme"
  },
  {
    "name": "@types/node",
    "version": "26.6.5",
    "license": "MIT",
    "scope": "development",
    "purpose": "TypeScript types for the Node APIs used by the tooling and tests",
    "url": "https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/node"
  },
  {
    "name": "@types/react",
    "version": "18.3.31",
    "license": "MIT",
    "scope": "development",
    "purpose": "TypeScript types for React (development only)",
    "url": "https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react"
  },
  {
    "name": "@types/react-dom",
    "version": "18.3.7",
    "license": "MIT",
    "scope": "development",
    "purpose": "TypeScript types for React DOM (development only)",
    "url": "https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react-dom"
  },
  {
    "name": "@vitejs/plugin-react",
    "version": "4.7.0",
    "license": "MIT",
    "scope": "development",
    "purpose": "React support for the Vite build",
    "url": "https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react#readme"
  },
  {
    "name": "fake-indexeddb",
    "version": "6.2.5",
    "license": "Apache-2.0",
    "scope": "development",
    "purpose": "In-memory IndexedDB implementation used by the persistence tests",
    "url": "https://github.com/dumbmatter/fakeIndexedDB"
  },
  {
    "name": "jsdom",
    "version": "25.0.1",
    "license": "MIT",
    "scope": "development",
    "purpose": "Browser-like DOM used by the layout and navigation tests",
    "url": "https://www.npmjs.com/package/jsdom"
  },
  {
    "name": "typescript",
    "version": "5.9.3",
    "license": "Apache-2.0",
    "scope": "development",
    "purpose": "Static type checking for the whole codebase",
    "url": "https://www.typescriptlang.org/"
  },
  {
    "name": "vite",
    "version": "6.4.4",
    "license": "MIT",
    "scope": "development",
    "purpose": "Build tool and development server",
    "url": "https://vite.dev"
  },
  {
    "name": "vitest",
    "version": "2.1.9",
    "license": "MIT",
    "scope": "development",
    "purpose": "Automated test runner",
    "url": "https://github.com/vitest-dev/vitest#readme"
  }
];
