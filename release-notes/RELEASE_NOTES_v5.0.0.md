# Striae Release Notes - v5.0.0

**Release Date**: March 24, 2026
**Period**: March 23 - March 24, 2026
**Total Commits**: 14 (non-merge since the v4.3.4 release-notes baseline)

## Major Release - Encrypted Export/Import Foundation and Forensic Workflow Hardening

## Summary

v5.0.0 introduces encrypted export and import workflows across case packages, confirmation packages, and archive packages while preserving signed forensic validation requirements. This release adds encryption-manifest-driven decryption during import, enforces mandatory encryption on protected package paths, moves confirmation workflows to encrypted ZIP packages only with no legacy plaintext JSON import/export path, removes legacy standalone public-key verification utility UI surface, and includes release-window hardening updates across archive/read-only guardrails, import preview behavior, and deploy configuration automation.

## Detailed Changes

### Export Encryption Across Forensic Package Types

- Added package encryption implementation for case exports using shared encryption utilities and package-level metadata.
- Added confirmation export encryption support with encrypted confirmation ZIP package output only, failing closed when encryption keys are not configured.
- Applied encryption to archive package outputs including bundled audit artifacts in archive workflows.
- Added encryption metadata packaging through `ENCRYPTION_MANIFEST.json` to support deterministic import-time decryption.

### Import-Time Decryption and Validation Flow Updates

- Added encrypted export preview handling so encrypted packages can be recognized and processed safely during import workflows.
- Added encrypted confirmation import handling with decryption before hash/signature validation, and removed legacy plaintext confirmation JSON/ZIP import acceptance.
- Refined import/decryption overflow handling and related stability fixes for large encrypted payload paths.
- Preserved fail-closed trust behavior by running normal signed/hash validation after decrypted content extraction.

### Security and Workflow Surface Hardening

- Removed the standalone public signing key verification utility UI component and related legacy surface.
- Added mandatory encryption enforcement on protected export paths where configured encryption keys are required.
- Tightened archive/read-only case management gating and archive import guard checks.
- Continued cleanup/refinement in case preview and confirmation import read paths.

### Deploy and Configuration Automation Alignment

- Updated deploy-config/deploy scripts in this release window to improve encryption/signing key setup alignment and environment handling.
- Included release-window documentation and maintenance updates tied to the encryption rollout.

## Release Statistics

- **Baseline**: `release-notes/RELEASE_NOTES_v4.3.4.md`
- **Commits Included**: 14 (non-merge commits since the v4.3.4 release-notes baseline commit)
- **Build Status**: Succeeded (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed with 12 known worker configuration warnings and 0 errors (`npm run lint`)

## Closing Note

v5.0.0 establishes encrypted package confidentiality as a first-class workflow while retaining Striae's signed forensic integrity model. The release is focused on secure transport/import of forensic packages, stronger operational guardrails, and deployment-path consistency for encryption-enabled environments.
