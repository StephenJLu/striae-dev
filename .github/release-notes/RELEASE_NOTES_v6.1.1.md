# Striae Release Notes - v6.1.1

**Release Date**: April 15, 2026
**Period**: April 14, 2026 through April 15, 2026
**Total Commits**: 10 (non-merge since 04/14/2026)

## Patch Release - Notes Permission Centralization and Release-Window Maintenance

## Summary

v6.1.1 is a patch release focused on centralizing notes editing permission enforcement, reducing annotation-model duplication through shared literals, and carrying forward dependency, Wrangler, compatibility-date, and review-driven maintenance completed since April 14, 2026.

## Detailed Changes

### Notes Editing Permission Enforcement

- Centralized notes editing permission checks and refactored related notes-editing paths so write-access enforcement is handled more consistently.
- Included follow-up code review adjustments in the same area to stabilize the refactor.

### Annotation Model Cleanup

- Added shared annotation literals to reduce duplicated annotation constants and align annotation-related handling across the app.

### Dependency and Tooling Maintenance

- Applied dependency maintenance updates during the release window.
- Bumped Wrangler and refreshed compatibility dates to keep deployment/runtime metadata current.
- Included the release-version housekeeping commit for v6.1.1.

## Release Statistics

- **Baseline**: `.github/release-notes/RELEASE_NOTES_v6.1.0.md`
- **Commit Range**: `32e4ee31..b782723e`
- **Commits Included**: 10 (non-merge commits since 04/14/2026)
- **Build Status**: Passed (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed with expected warnings in generated `worker-configuration.d.ts` files (`npm run lint`)

## Closing Note

v6.1.1 tightens notes-permission enforcement and annotation literal consistency while packaging the expected dependency and tooling maintenance from the post-v6.1.0 stabilization window.
