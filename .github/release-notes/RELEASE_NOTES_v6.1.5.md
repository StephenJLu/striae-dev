# Striae Release Notes - v6.1.5

**Release Date**: April 18, 2026
**Period**: April 17, 2026 through April 18, 2026
**Total Commits**: 8 (non-merge after the v6.1.4 bump)

## Patch Release - Auth Surface Cleanup, Indexing Controls, and Tooling Maintenance

## Summary

v6.1.5 is a patch release that finalizes the active login route assets, tightens non-indexing and response-header behavior for the app surface, and rolls in post-v6.1.4 maintenance covering lint configuration, package refreshes, wrangler type regeneration, and compatibility-date updates.

## Detailed Changes

### Auth Surface Cleanup

- Removed the remaining auth route template flow in favor of the active production login route and stylesheet.
- Updated login and MFA-related components to align reCAPTCHA verifier handling with the current route structure and reduce unnecessary lifecycle churn.
- Simplified deploy scaffolding so auth route template copying is no longer part of setup automation.

### Indexing and Header Controls

- Added explicit `noindex, nofollow` controls at both the document-meta level and the response-header level to keep the app surface out of search indexing.
- Updated public header configuration to expand long-lived caching coverage for additional static asset types.
- Added `public/robots.txt` to reinforce the non-indexing posture.

### Tooling and Release Maintenance

- Updated lint configuration as part of the post-release cleanup window.
- Refreshed packages and regenerated Wrangler-derived worker types to keep local type surfaces aligned.
- Updated compatibility dates across worker example configurations and the app example Wrangler configuration.
- Included code-review follow-up commits completed after the v6.1.4 bump.

## Release Statistics

- **Baseline**: `.github/release-notes/RELEASE_NOTES_v6.1.4.md`
- **Commits Included**: 8 (non-merge commits after `bump v6.1.4` on 04/17/2026)
- **Build Status**: Passed (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed with expected warnings in generated `worker-configuration.d.ts` files (`npm run lint`)

## Closing Note

v6.1.5 cleans up the active authentication surface, adds stronger app-level non-indexing controls, and packages the expected post-v6.1.4 tooling and compatibility maintenance into a focused patch release.
