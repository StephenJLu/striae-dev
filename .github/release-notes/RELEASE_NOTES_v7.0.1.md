# Striae Release Notes - v7.0.1

**Release Date**: April 22, 2026
**Period**: April 22, 2026 through April 22, 2026
**Total Commits**: 3 (non-merge after the v7.0.0 bump)

## Patch Release - Canvas Notes and Worker Response Consistency

## Summary

v7.0.1 is a focused patch release following the v7.0.0 service bindings migration. It adds left/right notes display to the canvas annotation view, aligns worker response logic across the image and user workers for consistency, and applies follow-up code review fixes to the user worker.

## Detailed Changes

### Canvas L/R Notes Display

- Added left/right notes rendering to the canvas component, allowing examiners to view per-side annotation notes directly within the comparison canvas view.
- Updated `canvas.tsx` to surface left and right note values from the canvas props and render them in the overlay.
- Added supporting styles to `canvas.module.css` for the notes display.
- Bumped Cloudflare compatibility dates across all worker `wrangler.jsonc.example` files and `wrangler.toml.example`.

### Worker Response Logic Alignment

- Standardized response handling patterns across the image worker and user worker for consistency following the v7.0.0 service bindings migration.
- Refactored router and handler response construction in the image worker (`delete-image.ts`, `mint-signed-url.ts`, `serve-image.ts`, `upload-image.ts`, `image-worker.ts`, `router.ts`, `types.ts`) to use a consistent response shape.
- Aligned response and error types and route handling in the user worker (`user-routes.ts`, `user-worker.ts`, `types.ts`).

### Code Review Follow-Up

- Applied minor code review fixes to the user worker including type refinements in `types.ts`, a corrected handler reference in `user-routes.ts`, and removal of stale logic from `user-worker.ts`.

## Release Statistics

- **Baseline**: `.github/release-notes/RELEASE_NOTES_v7.0.0.md`
- **Commits Included**: 3 (non-merge commits after `v7.0.0` on 04/21/2026)
- **Build Status**: Passed (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed (`npm run lint`)

## Closing Note

v7.0.1 completes the first round of follow-up polish after the v7.0.0 infrastructure overhaul. The canvas annotation view now surfaces left/right notes inline, and both the image and user workers have been brought to a consistent response contract. The worker layer is stable and ready for feature development.
