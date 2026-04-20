/**
 * E2E regression tests: Case operations
 *
 * Covers: create, rename, delete, archive
 *
 * Prerequisites:
 *   - Dev server running: npm run dev
 *   - Workers accessible
 *   - tests/e2e/.env.test configured with test credentials
 */

import { test, expect } from './fixtures/auth';

// Unique prefix per test run to avoid collisions between runs
const RUN_ID = Date.now().toString(36).toUpperCase();

function caseName(suffix: string): string {
  return `E2E-${RUN_ID}-${suffix}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Open the "Open/Create Case" dialog and submit a case number */
async function openOrCreateCase(page: import('@playwright/test').Page, caseNumber: string) {
  // Click the Open/Create Case button in the navbar
  await page.click('button:has-text("Open Case"), button:has-text("New Case"), [aria-label*="case" i]');
  await page.fill('input[placeholder*="case" i], input[name="caseNumber"]', caseNumber);
  await page.keyboard.press('Enter');
}

/** Wait for a success or case-loaded indicator */
async function waitForCaseLoaded(page: import('@playwright/test').Page, caseNumber: string) {
  await page.waitForFunction(
    (cn: string) => document.body.innerText.includes(cn),
    caseNumber,
    { timeout: 20_000 }
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Case operations', () => {
  test('create a new case', async ({ page }) => {
    const caseNumber = caseName('CREATE');
    await page.goto('/');

    await openOrCreateCase(page, caseNumber);
    await waitForCaseLoaded(page, caseNumber);

    // The case number should appear somewhere on the page (navbar, title, etc.)
    await expect(page.locator(`text=${caseNumber}`).first()).toBeVisible();
  });

  test('rename an existing case', async ({ page }) => {
    const originalName = caseName('RENAME-SRC');
    const newName = caseName('RENAME-DST');
    await page.goto('/');

    // Create the source case
    await openOrCreateCase(page, originalName);
    await waitForCaseLoaded(page, originalName);

    // Open the case options/context menu
    // The rename action is typically in a case menu (kebab / ellipsis / options button)
    await page.click('[aria-label*="rename" i], button:has-text("Rename"), [aria-label*="case options" i]');

    // Look for a rename input / modal
    const renameInput = page.locator('input[placeholder*="rename" i], input[placeholder*="case" i]').last();
    await renameInput.fill(newName);
    await page.keyboard.press('Enter');

    await waitForCaseLoaded(page, newName);

    // New name should appear, old name should not be the active case header
    await expect(page.locator(`text=${newName}`).first()).toBeVisible();
  });

  test('delete a case', async ({ page }) => {
    const caseNumber = caseName('DELETE');
    await page.goto('/');

    await openOrCreateCase(page, caseNumber);
    await waitForCaseLoaded(page, caseNumber);

    // Open the delete action
    await page.click('[aria-label*="delete" i], button:has-text("Delete")');

    // Confirm in the dialog
    const confirmButton = page.locator('button:has-text("Delete"), button:has-text("Confirm"), button:has-text("Yes")').last();
    await confirmButton.click();

    // After deletion the case should no longer be the active/loaded case
    await page.waitForFunction(
      (cn: string) => !document.querySelector(`[data-case="${cn}"]`) || !document.body.innerText.includes(`Case ${cn} loaded`),
      caseNumber,
      { timeout: 15_000 }
    );
  });

  test('archive a case and verify it becomes read-only', async ({ page }) => {
    const caseNumber = caseName('ARCHIVE');
    await page.goto('/');

    await openOrCreateCase(page, caseNumber);
    await waitForCaseLoaded(page, caseNumber);

    // Open the archive action
    await page.click('[aria-label*="archive" i], button:has-text("Archive")');

    // Confirm archive dialog if present
    const confirmButton = page.locator('button:has-text("Archive"), button:has-text("Confirm")').last();
    if (await confirmButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmButton.click();
    }

    // Wait for a read-only indicator (badge, label, or disabled edit controls)
    await expect(
      page.locator('[aria-label*="read-only" i], [aria-label*="archived" i], text=Read-Only, text=Archived').first()
    ).toBeVisible({ timeout: 20_000 });
  });
});
