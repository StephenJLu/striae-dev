# Striae Release Notes - v5.4.2

**Release Date**: March 31, 2026
**Period**: March 31, 2026 (same-day patch following v5.4.1)
**Total Commits**: 9 (non-merge since the v5.4.1 baseline)

## Patch Release - Original Case Owner UID in Confirmation Signing, Badge/ID Read-Only in Confirmation Modal, and Wrangler Type Refresh

## Summary

v5.4.2 is a same-day patch following v5.4.1. It threads the original case owner UID through confirmationexport, import, and signing flows so that confirmation packages can be validated against the intended recipient at import time. The confirmation modal now displays Badge/ID as a read-only value instead of an editable input, and wrangler-generated worker types have been refreshed.

## Detailed Changes

### Original Case Owner UID in Confirmation Signing Flow

- Extended the confirmation export flow (`confirm-export.ts`) to embed `originalCaseOwnerUid` in the exported confirmation metadata, sourced from the stored case data populated during the initial case import.
- Updated `storage-operations.ts` to persist `originalCaseOwnerUid` from the exporter's UID into R2 case data at import time, establishing the provenance chain.
- Updated `orchestrator.ts` to carry `originalExportedByUid` into read-only case metadata during case-for-review imports.
- Added `originalCaseOwnerUid` to the confirmation signing payload in both the client-side (`confirmation-signature.ts`) and data-worker (`signing-payload-utils.ts`) implementations, ensuring the field is covered by the cryptographic signature.
- Added validation in both payload validators to reject `originalCaseOwnerUid` if present but empty or non-string.
- Added an import-time guard in `confirmation-import.ts` that rejects confirmation packages where the embedded `originalCaseOwnerUid` does not match the importing user's UID, preventing cross-user confirmation imports.
- Extended `CaseDataWithConfirmations`, `ReadOnlyCaseMetadata`, and `ConfirmationImportData` types to include the new UID fields.

### Badge/ID Read-Only in Confirmation Modal

- Converted the Badge/ID field in the confirmation modal (`confirmation.tsx`) from an editable text input to a read-only display, removing the associated required-field validation. Badge/ID is now sourced from the user's profile and displayed as informational context rather than a per-confirmation entry point.

### Wrangler Type Refresh

- Refreshed `worker-configuration.d.ts` with updated wrangler-generated type definitions.

## Release Statistics

- **Baseline**: `release-notes/RELEASE_NOTES_v5.4.1.md`
- **Commit Range**: `4935bba4..48ab8fce`
- **Commits Included**: 9 (non-merge commits since the v5.4.1 baseline commit)
- **Build Status**: Succeeded (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed with known worker configuration warnings and 0 errors (`npm run lint`)

## Closing Note

v5.4.2 strengthens the confirmation exchange workflow by binding confirmation packages to their intended recipient through a signed original case owner UID, closing a gap where confirmation packages could theoretically be imported by unintended users. The Badge/ID field change simplifies the confirmation modal by using the profile-sourced value directly.
