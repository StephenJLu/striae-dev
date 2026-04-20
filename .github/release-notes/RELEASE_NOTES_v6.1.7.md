# Striae Release Notes - v6.1.7

**Release Date**: April 20, 2026
**Period**: April 20, 2026 through April 20, 2026
**Total Commits**: 5 (non-merge after the v6.1.6 bump)

## Patch Release - Case Management Fixes, Data Cache Hardening, and Auth Cleanup

## Summary

v6.1.7 is a patch release that fixes a regression preventing deletion of the currently loaded case from the all-cases modal, hardens the data cache refresh flow, corrects cache reset behaviour on case deletions, resolves a case creation and rename permissions bug, and removes unused demo company logic and the `recoverEmail` email action handler that was never implemented.

## Detailed Changes

### Case Deletion Fix (All Cases Modal)

- Fixed a regression that blocked deletion of the currently loaded case when triggered from the all-cases modal.
- Users can now delete any case from the modal regardless of which case is currently open.

### Data Cache Refresh Hardening

- Hardened the data cache refresh logic to handle edge cases that could leave stale data in the cache after refresh operations.

### Case Listing Cache Reset on Deletion

- Fixed an issue where the case listing cache was not correctly reset after a case deletion, which could cause stale entries to persist in the list.

### Case Creation and Rename Permissions Bug

- Resolved a bug where permission checks for case creation and rename operations could incorrectly block valid users from performing these actions.

### Auth and Demo Logic Cleanup

- Removed unused demo company logic that was no longer applicable.
- Removed the `recoverEmail` email action handler, which was never permitted or implemented.
- This cleanup reduces dead code paths and potential confusion in the authentication flow.

## Release Statistics

- **Baseline**: `.github/release-notes/RELEASE_NOTES_v6.1.6.md`
- **Commits Included**: 5 (non-merge commits after `bump v6.1.6` on 04/19/2026)
- **Build Status**: Passed (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed with expected warnings in generated `worker-configuration.d.ts` files (`npm run lint`)

## Closing Note

v6.1.7 delivers a focused set of case management and cache reliability fixes, corrects a permissions regression affecting case creation and rename, and cleans up dead authentication code paths that were never intended for use in production.
