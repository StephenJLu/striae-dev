# Striae Release Notes - v5.3.1

**Release Date**: March 29, 2026
**Period**: March 26 - March 29, 2026
**Total Commits**: 10 (non-merge since the v5.3.0 baseline)

## Patch Release - Designated Reviewer Flows, Import Decryption Follow-Up, and UX Improvements

## Summary

v5.3.1 is a focused patch that introduces designated reviewer assignment flows, adds self-designation guardrails, follows up on the v5.3.0 encrypted workflow consolidation by extending decryption support to import previews and removing remaining stale unencrypted import paths, and improves loading feedback during case operations with a dedicated loading toast. Compatibility dates across worker configurations are also refreshed.

## Detailed Changes

### Designated Reviewer Flows

- Added designated reviewer assignment flows to the case management and export surfaces, allowing examiners to formally record a designated reviewer when preparing case exports.
- Added a re-introduced export case modal component with dedicated styling to support the designated reviewer capture workflow.
- Added a self-designation guardrail to prevent users from assigning themselves as the designated reviewer for their own cases.
- Extended type definitions to support designated reviewer metadata across case, export, and import surfaces.

### Import Decryption Follow-Up

- Extended import preview flows to support decryption of encrypted package contents, so preview surfaces accurately reflect current encrypted archive contents.
- Removed remaining stale unencrypted import workflows from zip processing, orchestration, confirmation import, and confirmation package handling to align the import surface fully with the encrypted workflow baseline established in v5.3.0.
- Updated import preview UI components (`CasePreviewSection`, `ConfirmationPreviewSection`) and the `useFilePreview` hook to support the updated decryption-aware import data flow.

### Loading Toast UX

- Added a loading toast component with dedicated CSS module styling to provide visible feedback during case operations that have non-trivial processing time.
- Integrated the loading toast into the main Striae route for relevant action paths.

### Maintenance

- Updated compatibility dates across all worker `wrangler.jsonc` example configurations and the root `wrangler.toml.example`.
- Applied targeted code review refinements across import and export action surfaces.

## Release Statistics

- **Baseline**: `release-notes/RELEASE_NOTES_v5.3.0.md`
- **Commit Range**: `e68d4825466a742371bec5178158c7e27b3cb020..b2ca1fe80b681c930cb2614a32790dd5da7f5176`
- **Commits Included**: 10 (non-merge commits since the v5.3.0 baseline commit)
- **Build Status**: Succeeded (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed with 12 known worker configuration warnings and 0 errors (`npm run lint`)

## Closing Note

v5.3.1 completes the import-side encrypted workflow alignment started in v5.3.0 and introduces designated reviewer tracking to the export workflow, along with UX and maintenance improvements.
