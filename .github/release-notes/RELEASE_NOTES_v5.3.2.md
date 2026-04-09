# Striae Release Notes - v5.3.2

**Release Date**: March 29, 2026
**Period**: March 29, 2026
**Total Commits**: 5 (non-merge since the v5.3.1 baseline)

## Patch Release - Image Signed URL Proxy, Export Confirmations Modal, and PDF Image Fix

## Summary

v5.3.2 introduces a signed URL bypass path for the Pages image proxy, allowing images to be served via `?st=` token-authenticated GET requests without requiring Firebase identity verification for each request. This is paired with a PDF generation fix that pre-fetches signed URL images client-side and embeds them as data URLs to ensure Puppeteer doesn't need to make outbound requests for proxy-served images. The release also adds an export confirmations modal with label and wording refinements.

## Detailed Changes

### Image Signed URL Proxy

- Updated the Pages image proxy function (`functions/api/image/[[path]].ts`) to support a signed token bypass path: GET requests carrying a `?st=` query parameter skip Firebase identity verification and are served directly, enabling signed URL image delivery.
- Updated the image worker example configuration to reflect the updated proxy authentication expectations.
- Added relevant environment variable examples to `.env.example`.

### PDF Image Signed URL Fix

- Updated `generate-pdf.ts` to detect signed URL images (those containing `?st=`) and pre-fetch them client-side, embedding the result as a data URL before PDF generation. This prevents the PDF worker's Puppeteer context from needing to make outbound requests for proxy-served signed URL images.

### Export Confirmations Modal

- Added an export confirmations modal component (`export-confirmations-modal.tsx`) with dedicated CSS module styling and route integration in the main Striae route.
- Refined labelling and wording for confirmed images in the export confirmations surface.

## Release Statistics

- **Baseline**: `release-notes/RELEASE_NOTES_v5.3.1.md`
- **Commit Range**: `b2ca1fe80b681c930cb2614a32790dd5da7f5176..c2b7ecf9e0699eeab09b24a5ef4ad4eacd016277`
- **Commits Included**: 5 (non-merge commits since the v5.3.1 baseline commit)
- **Build Status**: Succeeded (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed with 12 known worker configuration warnings and 0 errors (`npm run lint`)

## Closing Note

v5.3.2 completes the image signed URL integration work with a proxy-level bypass and a corresponding PDF generation fix, and ships the export confirmations modal introduced during the v5.3.1 cycle.
