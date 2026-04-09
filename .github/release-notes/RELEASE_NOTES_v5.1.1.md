# Striae Release Notes - v5.1.1

**Release Date**: March 24, 2026
**Period**: March 24 - March 24, 2026
**Total Commits**: 15 (non-merge since the v5.1.0 release-notes baseline)

## Patch Release - Signed URL Generation and Serving

## Summary

v5.1.1 is a focused patch addressing signed URL generation and serving behavior, with follow-up improvements to deployment configuration, secrets management, and image handling reliability. This release includes environment configuration updates, deploy-config alignment, and validation hardening to ensure secure and consistent URL signing across worker and runtime surfaces.

## Detailed Changes

### Signed URL Generation and Serving

- Fixed signed URL checks and generation logic to ensure consistent validation across image serving surfaces.
- Improved signed URL verification behavior for both fetch and serving pathways.
- Hardened environment and configuration alignment for URL signing keys and validation.

### Deploy Configuration and Secrets Management

- Updated deploy configuration to reflect current secrets requirements and validation patterns.
- Refined environment templates and example configurations for clarity.
- Enhanced secrets validation and prompting during deployment setup.

### Image Handling and Revocation

- Fixed image revoke handling to properly cascade revocation behavior across dependent resources.
- Improved image access control and validation flows.

### Code Review and Maintenance

- Addressed multiple targeted code review feedback items across runtime and worker surfaces.
- Cleaned up test infrastructure and utility alignment.

## Release Statistics


## Closing Note
**Build Status**: Succeeded (`npm run build`)
**Typecheck Status**: Passed (`npm run typecheck`)
**Lint Status**: Passed with 14 known worker configuration warnings and 0 errors (`npm run lint`)
