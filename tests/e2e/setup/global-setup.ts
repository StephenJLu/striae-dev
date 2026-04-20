/**
 * Playwright global setup: logs in with test credentials and saves session state.
 *
 * Prerequisites before running E2E tests:
 *  1. Copy tests/e2e/.env.test.example → tests/e2e/.env.test
 *  2. Fill in TEST_USER_EMAIL and TEST_USER_PASSWORD with a real (or emulator) test account
 *  3. Start the dev server:         npm run dev
 *  4. Ensure workers are accessible (wrangler pages dev or deployed workers)
 *  5. Run E2E tests:                npm run test:e2e
 *
 * Auth state is saved to tests/e2e/.auth/session.json (gitignored).
 * If the session file already exists and SKIP_AUTH_SETUP=1 is set, login is skipped.
 */

import { chromium, type FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const AUTH_FILE = path.join(__dirname, '../.auth/session.json');
const ENV_FILE = path.join(__dirname, '../.env.test');

function loadEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    result[key] = value;
  }
  return result;
}

export default async function globalSetup(_config: FullConfig) {
  // Load .env.test vars if present
  const envVars = loadEnvFile(ENV_FILE);
  const email = process.env.TEST_USER_EMAIL ?? envVars.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD ?? envVars.TEST_USER_PASSWORD;
  const skipAuthSetup = (process.env.SKIP_AUTH_SETUP ?? envVars.SKIP_AUTH_SETUP) === '1';

  // Skip if already have a session and skip flag is set
  if (skipAuthSetup && fs.existsSync(AUTH_FILE)) {
    console.log('[global-setup] Reusing existing session from', AUTH_FILE);
    return;
  }

  if (!email || !password) {
    throw new Error(
      '[global-setup] TEST_USER_EMAIL and TEST_USER_PASSWORD must be set.\n' +
      'Copy tests/e2e/.env.test.example → tests/e2e/.env.test and fill in credentials.'
    );
  }

  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:7777';

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  try {
    // Navigate to the app root — the login page renders at /
    await page.goto('/');

    // Wait for the email input to be visible (login form)
    await page.waitForSelector('input[name="email"]', { timeout: 30_000 });

    // Fill credentials
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);

    // Submit the form
    await page.click('button[type="submit"]');

    // Wait until we are no longer on the login form (auth state changed)
    // The app renders the Striae workspace after login
    await page.waitForFunction(
      () => !document.querySelector('button[type="submit"]'),
      { timeout: 30_000 }
    );

    // Ensure the .auth directory exists
    const authDir = path.dirname(AUTH_FILE);
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    // Save authenticated session state
    await context.storageState({ path: AUTH_FILE });
    console.log('[global-setup] Session saved to', AUTH_FILE);
  } finally {
    await browser.close();
  }
}
