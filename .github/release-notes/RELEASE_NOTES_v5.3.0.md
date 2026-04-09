# Striae Release Notes - v5.3.0

**Release Date**: March 26, 2026
**Period**: March 25 - March 26, 2026
**Total Commits**: 33 (non-merge since the v5.2.1 baseline)

## Minor Release - Export Workflow Consolidation, Worker Refactors, and Deployment Cleanup

## Summary

v5.3.0 is a substantial cleanup and consolidation release that streamlines Striae's active export workflow, removes obsolete worker and deployment surfaces, and refactors audit, data, and user worker internals around the current architecture. This release also improves case import preview behavior, tightens account-deletion file cleanup, adds Badge/ID capture to registration, and includes repository/package cleanup completed in the same release window.

## Detailed Changes

### Export Workflow Consolidation

- Removed legacy and unencrypted export paths so the export surface aligns with the current encrypted workflow baseline.
- Removed the old sidebar case-export modal implementation and consolidated active export handling into the current action paths.
- Dropped obsolete browser-side ExcelJS vendored assets and related export helper files that were only supporting retired export flows.
- Updated package metadata and README content to better reflect the active published package surface.

### Worker Refactors and Account-Deletion Handling

- Refactored the audit-worker and data-worker internals, including route/config/storage updates, while removing obsolete backfill-function code from both workers.
- Refactored the user-worker around current auth, Firebase admin, storage, and registry pathways to reduce dead paths and align account operations with the active runtime model.
- Updated account-deletion handling to use direct worker calls and corrected encrypted file cleanup behavior during deletion.
- Removed account-deletion audit-trail deletion behavior after the in-window follow-up determined that audit retention should remain outside the deletion flow.

### Deployment and Runtime Surface Cleanup

- Corrected deploy-all, Pages secrets deployment, worker secret deployment, and related deployment-script behavior across the release window.
- Removed the obsolete keys-worker package and its deployment/config scaffolding from the active repository surface.
- Refreshed Wrangler-generated type files and aligned example/runtime configuration files with the streamlined worker set.
- Removed stale public/package assets and older archived release-note files as part of broader repository cleanup.

### Import, Registration, and UI Follow-Up Improvements

- Improved case import preview logic and data sourcing so import review surfaces reflect the current package contents more reliably.
- Corrected confirmation-import audit entry handling to better align import events with current audit expectations.
- Added Badge/ID capture to registration and profile-related flows, then removed the now-unnecessary Badge/ID alert from the login example path.
- Added additional bullet core and cartridge-case metal options in the class details workflow.

### Maintenance Window Items

- Included npm/package-lock refresh work, lint cleanup, and Dependabot configuration cleanup in the same release window.
- Removed dead configuration, dead auth exports, console output, and related inactive app/runtime files uncovered during the refactor cycle.

## Release Statistics

- **Baseline**: `release-notes/RELEASE_NOTES_v5.2.1.md`
- **Commit Range**: `870274507db1aa12216254c0a7654d1bba3728e6..e68d4825466a742371bec5178158c7e27b3cb020`
- **Commits Included**: 33 (non-merge commits since the v5.2.1 baseline commit)
- **Build Status**: Succeeded (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed with 12 known worker configuration warnings and 0 errors (`npm run lint`)

## Closing Note

v5.3.0 advances the post-v5.2.1 cleanup cycle by removing retired export and worker surfaces, tightening deployment automation, and simplifying Striae around the currently supported secure workflows.
