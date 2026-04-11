# Striae Release Notes - v6.0.0

**Release Date**: April 11, 2026
**Period**: April 10, 2026 through April 11, 2026
**Total Commits**: 15 (non-merge since 04/10/2026)

## Major Release - Cryptographic Contract Cutover and Archive Workflow Refinements

## Summary

v6.0.0 introduces a cryptographic contract cutover from RSA PKCS#1 v1.5 signatures to RSA-PSS signatures across manifest, confirmation export, and bundled audit export workflows. This release also includes archive import/export UX and flow refinements, plus deployment and package-script maintenance commits from the release window beginning 04/10/2026.

## Detailed Changes

### Forensic Signature Algorithm Cutover (Breaking)

- Migrated signing and verification flows from `RSASSA-PKCS1-v1_5-SHA-256` to `RSASSA-PSS-SHA-256` with RSA-PSS salt length `32`.
- Updated signing contract versions (`manifestVersion: 3.0`, confirmation `signatureVersion: 3.0`, audit export `signatureVersion: 2.0`) to explicitly represent the cryptographic change.
- This is a hard cutover: pre-cutover PKCS#1-signed artifacts are expected to fail verification/import under the new contract.

### Archive Workflow Refinements

- Refactored archive bundle export into shared helpers to reduce route-level duplication and improve maintainability.
- Consolidated archive import alerts and refined archive import messaging for clearer user feedback during archive operations.

### Deployment, Packaging, and Release Window Maintenance

- Included package/deploy script updates and deployment reliability fixes during the same release window.
- Carried forward registration gateway and compatibility/environment/package-list maintenance commits included since 04/10/2026.
- Included release-window code review follow-up commits.

## Release Statistics

- **Baseline**: `release-notes/RELEASE_NOTES_v5.5.2.md`
- **Commit Range**: `a6fe9207..3b35a467`
- **Commits Included**: 15 (non-merge commits since 04/10/2026)
- **Build Status**: Passed (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed with expected warnings in generated `worker-configuration.d.ts` files (`npm run lint`)

## Closing Note

v6.0.0 marks a security-focused major release with intentional signature-contract breaking changes while continuing archive workflow refinement and deployment/package maintenance in the same development window.
