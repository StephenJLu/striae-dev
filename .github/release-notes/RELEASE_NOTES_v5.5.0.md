# Striae Release Notes - v5.5.0

**Release Date**: April 8, 2026
**Period**: April 4, 2026 through April 8, 2026
**Total Commits**: 12 (non-merge since the v5.4.5 baseline)

## Minor Release - Audit Trail PDF Export

## Summary

v5.5.0 introduces PDF export capability for the audit trail, allowing users to generate a formatted PDF report directly from the audit viewer. The audit trail PDF export pipeline is implemented as a format-independent worker path, keeping the report generation decoupled from the main case report format. This release also includes a notes save button UI refinement and Vite and Wrangler dependency bumps across the app and all workers.

## Detailed Changes

### Audit Trail PDF Export

- Added a new `export-audit-pdf.ts` action in `app/components/actions/` implementing client-side orchestration for audit trail PDF generation.
- Updated `user-audit-viewer.tsx` to surface the PDF export action from the audit viewer header.
- Added a new `audit-viewer-header.tsx` sub-component to the audit viewer for cleaner header/action separation.
- Added CSS updates to `user-audit.module.css` to support the export action presentation.
- Added `audit-trail-report.ts` in the PDF worker (`workers/pdf-worker/src/`) implementing server-side report rendering for audit trail data.
- Registered audit trail as a new report type in `report-types.ts`.

### Audit Trail Exports Format Independence

- Decoupled audit trail PDF export from the Striae-specific format path in `format-striae.ts`, making it format-independent and available across all report format configurations.
- Added corresponding example routing in `pdf-worker.example.ts`.

### Audit History Fix and Code Review

- Applied a targeted fix to `export-audit-pdf.ts` for correcting audit history processing behavior.
- Incorporated code-review refinements across `export-audit-pdf.ts` and `audit-trail-report.ts` for correctness and maintainability.

### Notes Save Button UI Polish

- Adjusted gradient styling on the save notes button in `notes.module.css` for improved visual consistency.

### Dependency Maintenance

- Bumped Vite and Wrangler across the root app package and all worker packages (`audit-worker`, `data-worker`, `image-worker`, `pdf-worker`, `user-worker`).
- Applied multiple compatibility-date metadata refreshes across the release window.

## Release Statistics

- **Baseline**: `release-notes/RELEASE_NOTES_v5.4.5.md`
- **Commit Range**: `783e8859..b766d66e`
- **Commits Included**: 12 (non-merge commits since the v5.4.5 baseline commit)
- **Build Status**: Succeeded (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed with known worker configuration warnings and 0 errors (`npm run lint`)

## Closing Note

v5.5.0 delivers audit trail PDF export as the headline capability, adding a meaningful new reporting surface to the audit workflow. Dependency maintenance and UI polish round out the release.
