# Striae Release Notes - v6.1.4

**Release Date**: April 17, 2026
**Period**: April 16, 2026 through April 17, 2026
**Total Commits**: 8 (non-merge since 04/16/2026)

## Patch Release - Case Loading Efficiency and Security Maintenance

## Summary

v6.1.4 is a patch release that delivers case-loading state efficiency improvements across the sidebar, all-cases modal, and files modal, bumps protobufjs to address a security vulnerability, and bundles compatibility-date refreshes and code-review follow-up maintenance from the post-v6.1.3 window.

## Detailed Changes

### Case Loading State Efficiency

- Refactored case loading state management in the main case route (`striae.tsx`), case sidebar, sidebar container, and sidebar to reduce redundant fetches and improve loading state coordination.
- Extended `permissions.ts` with additional loading-state guards to prevent premature permission evaluations during case transitions.
- Improved confirmation-summary operations and summary-core to align with updated loading state flows.
- Added case-already-loaded short-circuit logic to avoid unnecessary re-fetches when the target case is already in state.

### Cases and Files Modal Efficiency

- Refactored `all-cases-modal.tsx` to reduce unnecessary re-renders and improve responsiveness when switching cases from the modal.
- Updated `files-modal.tsx` with improved loading-state handling to prevent redundant data operations.

### Security Maintenance

- Bumped the `protobufjs` package to `^7.5.5` in `package.json` to resolve a known vulnerability in transitive dependency chains.

### Compatibility Date and Config Maintenance

- Updated compatibility dates across all workers (`audit`, `data`, `image`, `pdf`, `user`) and the app `wrangler.toml.example` to keep deployment metadata current.
- Included code-review follow-up commits and `package.json` housekeeping.

## Release Statistics

- **Baseline**: `.github/release-notes/RELEASE_NOTES_v6.1.3.md`
- **Commits Included**: 8 (non-merge commits since 04/16/2026)
- **Build Status**: Passed (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed with expected warnings in generated `worker-configuration.d.ts` files (`npm run lint`)

## Closing Note

v6.1.4 improves the responsiveness and efficiency of case-loading state transitions throughout the sidebar and modal surfaces, patches a protobufjs transitive vulnerability, and carries forward the expected post-v6.1.3 compatibility and maintenance work.
