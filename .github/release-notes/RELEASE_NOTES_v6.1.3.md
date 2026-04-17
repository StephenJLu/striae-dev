# Striae Release Notes - v6.1.3

**Release Date**: April 16, 2026
**Period**: April 15, 2026 through April 16, 2026
**Total Commits**: 16 (non-merge since 04/15/2026)

## Patch Release - Confirmation-Status Fix and Release-Window Maintenance

## Summary

v6.1.3 is a patch release that fixes confirmation-status cleanup for read-only case deletions and carries forward dependency, Wrangler, compatibility-date, and review-driven maintenance completed since April 15, 2026.

## Detailed Changes

### Confirmation-Status Cleanup Fix

- Fixed confirmation-status cleanup behavior for read-only case deletion scenarios to prevent stale status artifacts when read-only cases are removed.

### Dependency and Tooling Maintenance

- Bumped `isbot` and `eslint-plugin-react-hooks` to current releases during the release window.
- Bumped Wrangler across the app and all workers and refreshed compatibility dates to keep deployment/runtime metadata current.
- Included code-review follow-up commits and release-version housekeeping commits for v6.1.3.

## Release Statistics

- **Baseline**: `.github/release-notes/RELEASE_NOTES_v6.1.2.md`
- **Commits Included**: 16 (non-merge commits since 04/15/2026)
- **Build Status**: Passed (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed with expected warnings in generated `worker-configuration.d.ts` files (`npm run lint`)

## Closing Note

v6.1.3 closes a read-only case deletion edge case in confirmation-status cleanup while bundling the expected dependency and tooling maintenance from the post-v6.1.2 stabilization window.
