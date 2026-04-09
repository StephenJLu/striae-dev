# Striae Release Notes - v5.1.0

**Release Date**: March 24, 2026
**Period**: March 24 - March 24, 2026
**Total Commits**: 28 (non-merge since the v5.0.0 release-notes baseline)

## Minor Release - Data-at-Rest Encryption Rollout and Import/Runtime Hardening

## Summary

v5.1.0 expands the encryption rollout from package transport into runtime and storage pathways by introducing data-at-rest and worker-level encryption follow-up changes, including migration/backfill tooling and deploy configuration updates for new secret wiring. This release also hardens archive/import blocking behavior and operator messaging, improves test coverage and worker/runtime alignment, and includes targeted reliability fixes in PDF image fetch behavior.

## Detailed Changes

### Data-at-Rest Encryption and Migration Tooling

- Added data-at-rest encryption rollout work across worker surfaces with follow-up implementation for audit and image storage paths.
- Added encryption backfill tooling and development iterations to support migration of existing data.
- Updated example environment/config values to align with new encryption and migration requirements.

### Import Guardrails and UX Hardening

- Refined archive import gates and fixed related import blocking edge cases.
- Simplified and hardened import-block messaging to make enforcement outcomes clearer for operators.
- Included multiple focused import follow-up fixes from the same release window.

### Deploy/Secret Configuration Alignment

- Wired deploy configuration to new secrets required by encryption/storage updates.
- Aligned deploy-config behavior and removed duplicate image token configuration to reduce drift.
- Refreshed generated worker type surfaces for compatibility with current worker/runtime contracts.

### Reliability, Testing, and Maintenance

- Added/updated root-level and image-worker test coverage during the release window.
- Fixed PDF image GET handling for more reliable report-image retrieval behavior.
- Included dependency maintenance updates from the same commit window.

## Release Statistics

- **Baseline**: `release-notes/RELEASE_NOTES_v5.0.0.md`
- **Commit Range**: `0aa7977f1d83f04c937249c185f5f22bec9d0edc..513e121c`
- **Commits Included**: 28 (non-merge commits since the v5.0.0 release-notes baseline commit)
- **Build Status**: Succeeded (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed with 14 known worker configuration warnings and 0 errors (`npm run lint`)

## Closing Note

v5.1.0 continues Striae's secure-by-default trajectory by extending encryption into operational storage workflows while tightening import guardrails and preserving release-window reliability through focused tests and runtime fixes.
