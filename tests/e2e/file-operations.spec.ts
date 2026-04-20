/**
 * E2E regression tests: File operations
 *
 * Covers: upload, delete, and file persistence across case rename
 *
 * Prerequisites:
 *   - Dev server running: npm run dev
 *   - Workers accessible
 *   - tests/e2e/.env.test configured with test credentials
 */

import { test, expect } from '../fixtures/auth';
import path from 'path';
import fs from 'fs';
import os from 'os';

const RUN_ID = Date.now().toString(36).toUpperCase();

function caseName(suffix: string): string {
  return `E2E-${RUN_ID}-${suffix}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal PNG file in the OS temp directory for upload testing */
function createTestPngFile(name = 'test-image.png'): string {
  const filePath = path.join(os.tmpdir(), name);
  // Minimal valid 1×1 PNG (89 bytes)
  const pngBytes = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108020000009001' +
    '2e00000000c49444154789c6260f8cf0000000200016e0021650000000049454e44ae426082',
    'hex'
  );
  fs.writeFileSync(filePath, pngBytes);
  return filePath;
}

/** Open or create a case */
async function openOrCreateCase(page: import('@playwright/test').Page, caseNumber: string) {
  await page.click('button:has-text("Open Case"), button:has-text("New Case"), [aria-label*="case" i]');
  await page.fill('input[placeholder*="case" i], input[name="caseNumber"]', caseNumber);
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    (cn: string) => document.body.innerText.includes(cn),
    caseNumber,
    { timeout: 20_000 }
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('File operations', () => {
  test('upload a file to a case and verify it appears in the file list', async ({ page }) => {
    const caseNumber = caseName('UPLOAD');
    const testImagePath = createTestPngFile(`e2e-upload-${RUN_ID}.png`);

    await page.goto('/');
    await openOrCreateCase(page, caseNumber);

    // Find the file input (hidden or visible) and upload
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testImagePath);

    // Wait for the upload to complete — thumbnail or filename should appear
    const filename = path.basename(testImagePath);
    await expect(
      page.locator(`img[alt*="${filename}"], [title*="${filename}"], text=${filename}`).first()
    ).toBeVisible({ timeout: 30_000 });

    fs.unlinkSync(testImagePath);
  });

  test('delete an uploaded file', async ({ page }) => {
    const caseNumber = caseName('DELETE-FILE');
    const testImagePath = createTestPngFile(`e2e-delete-${RUN_ID}.png`);
    const filename = path.basename(testImagePath);

    await page.goto('/');
    await openOrCreateCase(page, caseNumber);

    // Upload the file
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testImagePath);

    // Wait for it to appear
    await expect(
      page.locator(`img[alt*="${filename}"], [title*="${filename}"]`).first()
    ).toBeVisible({ timeout: 30_000 });

    // Select the file and open delete action
    await page.click(`img[alt*="${filename}"], [title*="${filename}"]`);
    await page.click('[aria-label*="delete" i], button:has-text("Delete File"), button:has-text("Delete")');

    // Confirm
    const confirmButton = page.locator('button:has-text("Delete"), button:has-text("Confirm")').last();
    if (await confirmButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmButton.click();
    }

    // File should be gone
    await expect(
      page.locator(`img[alt*="${filename}"], [title*="${filename}"]`)
    ).toHaveCount(0, { timeout: 15_000 });

    fs.unlinkSync(testImagePath);
  });

  test('files remain accessible after case rename', async ({ page }) => {
    const originalCase = caseName('RENAME-FILES-SRC');
    const renamedCase = caseName('RENAME-FILES-DST');
    const testImagePath = createTestPngFile(`e2e-rename-${RUN_ID}.png`);
    const filename = path.basename(testImagePath);

    await page.goto('/');
    await openOrCreateCase(page, originalCase);

    // Upload a file
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testImagePath);

    await expect(
      page.locator(`img[alt*="${filename}"], [title*="${filename}"]`).first()
    ).toBeVisible({ timeout: 30_000 });

    // Rename the case
    await page.click('[aria-label*="rename" i], button:has-text("Rename"), [aria-label*="case options" i]');
    const renameInput = page.locator('input[placeholder*="rename" i], input[placeholder*="case" i]').last();
    await renameInput.fill(renamedCase);
    await page.keyboard.press('Enter');

    // Wait for renamed case to load
    await page.waitForFunction(
      (cn: string) => document.body.innerText.includes(cn),
      renamedCase,
      { timeout: 20_000 }
    );

    // Files should still be visible under the new case name
    await expect(
      page.locator(`img[alt*="${filename}"], [title*="${filename}"]`).first()
    ).toBeVisible({ timeout: 15_000 });

    fs.unlinkSync(testImagePath);
  });
});
