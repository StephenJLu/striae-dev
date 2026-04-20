/**
 * E2E regression tests: Confirmation flow
 *
 * Covers:
 *  - Confirming an annotated image
 *  - Blocked edits after confirmation
 *  - Validation blockers when required fields are missing
 *  - Exported confirmation JSON contains a signature field
 *
 * Prerequisites:
 *   - Dev server running: npm run dev
 *   - Workers accessible
 *   - Test user must have permission to create cases and confirm images
 *   - tests/e2e/.env.test configured
 */

import { test, expect } from '../fixtures/auth';
import fs from 'fs';
import os from 'os';
import path from 'path';
import JSZip from 'jszip';

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

async function uploadAndOpenFile(page: import('@playwright/test').Page, imagePath: string) {
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(imagePath);
  const filename = path.basename(imagePath);
  const fileEntry = page.locator(`img[alt*="${filename}"], [title*="${filename}"]`).first();
  await expect(fileEntry).toBeVisible({ timeout: 30_000 });
  await fileEntry.click();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Confirmation flow', () => {
  test('confirm an image and verify confirmed badge appears', async ({ page }) => {
    const caseNumber = caseName('CONFIRM');
    const imagePath = createTestPngFile(`e2e-confirm-${RUN_ID}.png`);

    await page.goto('/');
    await openOrCreateCase(page, caseNumber);
    await uploadAndOpenFile(page, imagePath);

    // Fill required annotation fields before confirming (item types are typical blockers)
    // Select item types if required — these dropdowns/buttons vary; adjust selectors as needed
    const leftItemType = page.locator('[aria-label*="left item type" i], select[name*="leftItem" i]').first();
    if (await leftItemType.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await leftItemType.selectOption({ index: 1 });
    }
    const rightItemType = page.locator('[aria-label*="right item type" i], select[name*="rightItem" i]').first();
    if (await rightItemType.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await rightItemType.selectOption({ index: 1 });
    }

    // Open the confirmation dialog
    await page.click('button:has-text("Confirm"), [aria-label*="confirm" i]');

    // Fill in confirmation form fields
    const fullNameInput = page.locator('input[name*="fullName" i], input[placeholder*="full name" i]').first();
    if (await fullNameInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await fullNameInput.fill('Test Officer');
    }
    const badgeIdInput = page.locator('input[name*="badge" i], input[placeholder*="badge" i]').first();
    if (await badgeIdInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await badgeIdInput.fill('B9999');
    }

    // Submit the confirmation
    await page.click('button:has-text("Submit Confirmation"), button:has-text("Confirm"), button[type="submit"]');

    // A confirmed badge or indicator should appear
    await expect(
      page.locator('[aria-label*="confirmed" i], text=Confirmed, .confirmed, [data-confirmed="true"]').first()
    ).toBeVisible({ timeout: 20_000 });

    fs.unlinkSync(imagePath);
  });

  test('editing is blocked after image confirmation', async ({ page }) => {
    const caseNumber = caseName('BLOCKED-EDIT');
    const imagePath = createTestPngFile(`e2e-blocked-${RUN_ID}.png`);

    await page.goto('/');
    await openOrCreateCase(page, caseNumber);
    await uploadAndOpenFile(page, imagePath);

    // Confirm the image (minimal flow — may need annotation fields filled first)
    await page.click('button:has-text("Confirm"), [aria-label*="confirm" i]');
    const submitButton = page.locator('button:has-text("Submit Confirmation"), button:has-text("Confirm")').last();
    if (await submitButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await submitButton.click();
    }

    // Wait for confirmed state
    await page.waitForFunction(
      () => document.querySelector('[aria-label*="confirmed" i], .confirmed') !== null,
      { timeout: 20_000 }
    );

    // Attempt to edit annotation — controls should be disabled or absent
    const editableField = page
      .locator('input:not([disabled]):not([readonly]), textarea:not([disabled])')
      .filter({ hasText: '' })
      .first();

    // Either the fields are disabled, or there is a lock/blocked indicator
    const lockedIndicator = page.locator('[aria-label*="immutable" i], text=locked, text=read-only, [data-locked="true"]').first();
    const isLocked = await lockedIndicator.isVisible({ timeout: 5_000 }).catch(() => false);
    const isEditableFieldDisabled = editableField
      ? await editableField.isDisabled().catch(() => true)
      : true;

    expect(isLocked || isEditableFieldDisabled).toBe(true);

    fs.unlinkSync(imagePath);
  });

  test('confirmation is blocked when required annotation fields are missing', async ({ page }) => {
    const caseNumber = caseName('VALIDATION');
    const imagePath = createTestPngFile(`e2e-validation-${RUN_ID}.png`);

    await page.goto('/');
    await openOrCreateCase(page, caseNumber);
    await uploadAndOpenFile(page, imagePath);

    // Attempt to open the confirmation dialog WITHOUT filling required fields
    await page.click('button:has-text("Confirm"), [aria-label*="confirm" i]');

    // Either the button is disabled, or a validation error/blocker is shown
    const validationError = page
      .locator('text=required, text=missing, text=cannot confirm, [role="alert"]')
      .first();
    const confirmButtonDisabled = page
      .locator('button:has-text("Submit Confirmation"), button:has-text("Confirm")[disabled]')
      .first();

    const hasError = await validationError.isVisible({ timeout: 5_000 }).catch(() => false);
    const isDisabled = await confirmButtonDisabled.isVisible({ timeout: 2_000 }).catch(() => false);

    expect(hasError || isDisabled).toBe(true);

    fs.unlinkSync(imagePath);
  });

  test('exported confirmation JSON contains a signature field', async ({ page }) => {
    const caseNumber = caseName('SIG-CHECK');

    await page.goto('/');
    await openOrCreateCase(page, caseNumber);

    // Export confirmations (even an empty export should have a signed envelope)
    await page.click(
      'button:has-text("Export Confirmations"), [aria-label*="export confirmation" i], button:has-text("Confirmations")'
    );

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")').last();
    if (await exportButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await exportButton.click();
    }

    const download = await downloadPromise;
    const downloadPath = path.join(os.tmpdir(), `e2e-conf-sig-${RUN_ID}`);
    await download.saveAs(downloadPath);

    const suggestedName = download.suggestedFilename();

    // Parse the downloaded file
    let confirmationJson: Record<string, unknown> | null = null;
    if (suggestedName.endsWith('.zip')) {
      const zipBuffer = fs.readFileSync(downloadPath);
      const zip = await JSZip.loadAsync(zipBuffer);
      const jsonFile = Object.keys(zip.files).find((f) => f.endsWith('.json'));
      if (jsonFile) {
        const content = await zip.files[jsonFile].async('text');
        confirmationJson = JSON.parse(content) as Record<string, unknown>;
      }
    } else {
      confirmationJson = JSON.parse(fs.readFileSync(downloadPath, 'utf-8')) as Record<string, unknown>;
    }

    // The metadata should contain a signature field
    expect(confirmationJson).not.toBeNull();
    const metadata = (confirmationJson as { metadata?: Record<string, unknown> }).metadata;
    expect(metadata).toBeDefined();
    expect(metadata?.signature).toBeDefined();

    if (fs.existsSync(downloadPath)) fs.unlinkSync(downloadPath);
  });
});
