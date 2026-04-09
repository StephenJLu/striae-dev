# Striae Release Notes - v5.2.0

**Release Date**: March 25, 2026
**Period**: March 24 - March 25, 2026
**Total Commits**: 23 (non-merge since the v5.1.1 release-notes baseline)

## Minor Release - Runtime Cleanup, Config Validation Hardening, and Worker Alignment

## Summary

v5.2.0 focuses on post-v5.1.1 hardening and cleanup across runtime and deployment surfaces. This release removes deprecated signed-URL configuration holdovers, tightens deploy-config placeholder validation behavior, expands key registry automation for rotation-safe encryption workflows, aligns worker/runtime compatibility metadata, and includes targeted image-auth and user-worker updates that simplify and stabilize current operational paths.

## Detailed Changes

### Runtime and Configuration Cleanup

- Removed deprecated `requireSignedURLs` configuration usage from active runtime paths.
- Removed remaining Cloudflare-specific legacy holdovers that were no longer part of the current architecture.
- Removed obsolete backfill-function remnants after migration completion.

### Deployment Validation and Environment Safety

- Refined deploy-config placeholder regex behavior to reduce false-positive and drift-prone placeholder detection.
- Included release-window code review refinements for deployment and validation pathways.

### Key Registry Automation and Rotation Safety

- Added deploy-config automation that maintains encryption key registries as nested JSON (`activeKeyId` + `keys`) instead of flat key maps.
- Added synchronized active key ID environment variables for export encryption, data-at-rest encryption, and user KV encryption registry contracts.
- Normalized worker example/runtime surfaces to consume registry-based key resolution paths for rotation-compatible decrypt behavior.

### Worker and Compatibility Alignment

- Updated image-worker generated type surfaces to match current contract expectations.
- Updated compatibility-date metadata for aligned runtime targeting across worker deployments.
- Applied user-worker KV EAR follow-up adjustments from the same release window.

## Release Statistics

- **Baseline**: `release-notes/RELEASE_NOTES_v5.1.1.md`
- **Commit Range**: `bd74dbb8fa93984ac8bd9dc2afab4ccc60983f6b..6d19168b015d6442412a4623e41ac60a17c8834d`
- **Commits Included**: 23 (non-merge commits since the v5.1.1 release-notes baseline commit)
- **Build Status**: Succeeded (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed with 14 known worker configuration warnings and 0 errors (`npm run lint`)

## Closing Note

v5.2.0 continues Striae's secure and maintainable release cadence by consolidating completed migration cleanup work while improving configuration safety checks, key-rotation readiness, and worker/runtime contract consistency.
