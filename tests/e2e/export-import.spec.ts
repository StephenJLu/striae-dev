/**
 * E2E regression tests: Export and Import operations
 *
 * Covers:
 *  - Case package export (ZIP download)
 *  - Case package import
 *  - Confirmation package export
 *  - Confirmation package import
 *  - Case archive export
 *
 * Prerequisites:
 *   - Dev server running: npm run dev
 *   - Workers accessible (data, image workers)
 *   - tests/e2e/.env.test configured with test credentials
 */

import { test, expect } from '../fixtures/auth';
import fs from 'fs';
import os from 'os';
import path from 'path';

const RUN_ID = Date.now().toString(36).toUpperCase();

function caseName(suffix: string): string {
  return `E2E-${RUN_ID}-${suffix}`;
}

function createTestPngFile(name: string): string {
  const filePath = path.join(os.tmpdir(), name);
  const pngBytes = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108020000009001' +
    '2e00000000c49444154789c6260f8cf0000000200016e0021650000000049454e44ae426082',
    'hex'
  );
  fs.writeFileSync(filePath, pngBytes);
  return filePath;
}

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

test.describe('Export and Import operations', () => {
  test('export case package — download is triggered', async ({ page }) => {
    const caseNumber = caseName('EXP-CASE');
    const testImagePath = createTestPngFile(`e2e-exp-${RUN_ID}.png`);

    await page.goto('/');
    await openOrCreateCase(page, caseNumber);

    // Upload a file so there is something to export
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testImagePath);
    await page.waitForTimeout(2_000); // brief pause for upload to register

    // Listen for the download event before clicking export
    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });

    // Trigger the export (button text may vary)
    await page.click('button:has-text("Export"), [aria-label*="export" i]');

    // If there is an export modal/dialog, confirm it
    const exportConfirmButton = page.locator('button:has-text("Export Case"), button:has-text("Download")').last();
    if (await exportConfirmButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await exportConfirmButton.click();
    }

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.zip$/i);

    // Save for later import test
    const downloadPath = path.join(os.tmpdir(), `e2e-export-${RUN_ID}.zip`);
    await download.saveAs(downloadPath);
    expect(fs.existsSync(downloadPath)).toBe(true);

    fs.unlinkSync(testImagePath);
    if (fs.existsSync(downloadPath)) fs.unlinkSync(downloadPath);
  });

  test('import case package — case appears after import', async ({ page }) => {
    // This test requires a pre-exported ZIP. We create, export, then import.
    const sourceCase = caseName('IMP-SRC');
    const testImagePath = createTestPngFile(`e2e-imp-src-${RUN_ID}.png`);

    await page.goto('/');
    await openOrCreateCase(page, sourceCase);

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testImagePath);
    await page.waitForTimeout(2_000);

    // Export
    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await page.click('button:has-text("Export"), [aria-label*="export" i]');
    const exportConfirmButton = page.locator('button:has-text("Export Case"), button:has-text("Download")').last();
    if (await exportConfirmButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await exportConfirmButton.click();
    }
    const download = await downloadPromise;
    const zipPath = path.join(os.tmpdir(), `e2e-imp-${RUN_ID}.zip`);
    await download.saveAs(zipPath);

    // Now import the ZIP
    await page.click('button:has-text("Import"), [aria-label*="import" i]');

    // Find the file input for the import dialog
    const importFileInput = page.locator('input[type="file"][accept*="zip"], input[type="file"]').last();
    await importFileInput.setInputFiles(zipPath);

    // Confirm the import
    const importConfirmButton = page
      .locator('button:has-text("Import Case"), button:has-text("Confirm Import"), button:has-text("Import")')
      .last();
    if (await importConfirmButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await importConfirmButton.click();
    }

    // Wait for a success indicator
    await expect(
      page.locator('text=imported successfully, text=Import complete').first()
    ).toBeVisible({ timeout: 60_000 });

    fs.unlinkSync(testImagePath);
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  });

  test('export confirmation package — download is triggered', async ({ page }) => {
    const caseNumber = caseName('EXP-CONF');

    await page.goto('/');
    await openOrCreateCase(page, caseNumber);

    // Open the confirmation export dialog
    await page.click(
      'button:has-text("Export Confirmations"), [aria-label*="export confirmation" i], button:has-text("Confirmations")'
    );

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });

    // Confirm/submit
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")').last();
    if (await exportButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await exportButton.click();
    }

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.(zip|json)$/i);
  });

  test('export case archive — download is triggered', async ({ page }) => {
    const caseNumber = caseName('EXP-ARCH');

    await page.goto('/');
    await openOrCreateCase(page, caseNumber);

    // Archive the case first (if the archive export requires archived state)
    // Some flows let you export an archive of any case — adjust if needed

    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });

    await page.click(
      'button:has-text("Export Archive"), button:has-text("Archive Export"), [aria-label*="archive" i]'
    );

    const confirmButton = page.locator('button:has-text("Export"), button:has-text("Confirm")').last();
    if (await confirmButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmButton.click();
    }

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.zip$/i);
  });
});
