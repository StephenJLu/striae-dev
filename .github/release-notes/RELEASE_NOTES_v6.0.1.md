# Striae Release Notes - v6.0.1

**Release Date**: April 12, 2026
**Period**: April 11, 2026 through April 12, 2026
**Total Commits**: 11 (non-merge since 04/11/2026)

## Patch Release - Archive UX Follow-Ups and Release Window Maintenance

## Summary

v6.0.1 packages post-v6.0.0 release-window follow-up work spanning archive import UX refinements, support/community surface updates, and maintenance commits for registration/Primer Shear config, compatibility-date refreshes, and release/version housekeeping.

## Detailed Changes

### Archive Import UX Follow-Ups

- Continued archive workflow refinement by consolidating archive import alerts and further tightening archive import messaging clarity.
- Carried forward modular archive export helper refactor work in the same release window to reduce route-level duplication.

### Public Surface and Configuration Follow-Ups

- Added Striae community links to About and Support surfaces.
- Refactored registration email and Primer Shear email configuration handling for cleaner deployment/runtime alignment.

### Maintenance and Release Window Housekeeping

- Refreshed compatibility dates during the patch window.
- Included release housekeeping commits (`bump v6.0.1`, code review follow-ups) in the same non-merge commit set.

## Release Statistics

- **Baseline**: `.github/release-notes/RELEASE_NOTES_v6.0.0.md`
- **Commit Range**: `dda97eb0..2ef0198b`
- **Commits Included**: 11 (non-merge commits since 04/11/2026)
- **Build Status**: Passed (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed with expected warnings in generated `worker-configuration.d.ts` files (`npm run lint`)

## Closing Note

v6.0.1 is a stabilization patch release focused on post-major-release UX/configuration follow-ups while maintaining deployment/runtime compatibility hygiene in the same delivery window.
