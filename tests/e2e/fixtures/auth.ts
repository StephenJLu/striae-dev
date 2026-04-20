/**
 * Playwright authenticated test fixture.
 *
 * All E2E spec files should import `test` and `expect` from this module
 * rather than from @playwright/test directly. This ensures every test
 * runs with a pre-authenticated browser session.
 *
 * Usage:
 *   import { test, expect } from '../fixtures/auth';
 */

import { test as base, expect } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '../.auth/session.json');

export const test = base.extend({
  // Override storageState at the fixture level so it applies even if
  // playwright.config.ts changes its top-level default.
  storageState: AUTH_FILE,
});

export { expect };
