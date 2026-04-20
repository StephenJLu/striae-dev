import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, 'tests/e2e/.auth/session.json');

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false, // Case operations are stateful; run sequentially by default
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 1,
  timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never' }]],

  globalSetup: './tests/e2e/setup/global-setup.ts',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:7777',
    storageState: authFile,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Reuse a running dev server if already active; do not start one automatically.
  // To run E2E tests, start the dev server first: npm run dev
  // Then in a separate terminal: npm run test:e2e
  //
  // webServer: {
  //   command: 'npm run dev',
  //   port: 7777,
  //   reuseExistingServer: true,
  //   timeout: 120_000,
  // },
});
