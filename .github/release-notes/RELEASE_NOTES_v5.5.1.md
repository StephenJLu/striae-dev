# Striae Release Notes - v5.5.1

**Release Date**: April 9, 2026
**Period**: April 8, 2026 through April 9, 2026
**Total Commits**: 26 (non-merge since 04/08/2026)

## Patch Release - Timestamp UX and Release Tooling Follow-Ups

## Summary

v5.5.1 focuses on post-v5.5.0 stabilization work completed since 04/08/2026. The release improves timestamp handling in the UI by converting ISO values into the signed-in user's timezone and refining end-range display behavior. It also includes dependency/version maintenance across workers and app packages, plus targeted notes UI styling and behavior refinements.

## Detailed Changes

### Timestamp Display and Range Refinements

- Converted ISO timestamp rendering to the signed-in user's timezone for clearer, locality-correct audit/time displays.
- Adjusted timestamp presentation behavior and range end timestamp handling for better readability and consistency.

### Notes UI and Interaction Polish

- Added dirty notes state intercept behavior refinements.
- Applied iterative notes/button styling updates, message spacing/wording improvements, and title color polish.
- Included follow-up prop handling and code review adjustments tied to those UI refinements.

### Worker and Dependency Maintenance

- Added worker package version update support and follow-up update script fixes.
- Added/updated worker package version metadata and bumped data-worker wrangler dependencies.
- Updated audit worker dependency/version entries (including Puppeteer-related package metadata).
- Included React and React DOM dependency bump updates in the same release window.

### Release and Compatibility Metadata Updates

- Applied compatibility date refresh updates during the release window.
- Captured the v5.5.1 version bump alignment commit as part of this patch cycle.

## Release Statistics

- **Baseline**: `release-notes/RELEASE_NOTES_v5.5.0.md`
- **Commit Range**: `98568879..28e8157e`
- **Commits Included**: 26 (non-merge commits since 04/08/2026)
- **Build Status**: Succeeded (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed with known worker configuration warnings and 0 errors (`npm run lint`)

## Closing Note

v5.5.1 delivers stabilization and UX quality improvements immediately following v5.5.0, with emphasis on clearer time presentation, notes workflow polish, and worker/dependency maintenance.
