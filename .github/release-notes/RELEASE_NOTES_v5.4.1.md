# Striae Release Notes - v5.4.1

**Release Date**: March 31, 2026
**Period**: March 31, 2026 (same-day patch following v5.4.0)
**Total Commits**: 3 (non-merge since the v5.4.0 baseline)

## Patch Release - TOTP Admin Unenroll Script, MFA Support Guidance, and npm Files Allowlist Fix

## Summary

v5.4.1 is a same-day patch following the v5.4.0 minor release. It adds a Firebase Admin SDK script for administrative TOTP MFA unenrollment, adds a support contact message to the TOTP verification surface for users who have lost access to their authenticator app, and refines the npm package files allowlist to simplify worker inclusion patterns while correctly excluding build artifacts.

## Detailed Changes

### TOTP Admin Unenroll Script

- Added `scripts/unenroll-totp-mfa.mjs` — a Firebase Admin SDK script that allows administrators to unenroll a user's TOTP MFA factor by UID, enabling account recovery when a user has lost access to their authenticator app.
- Added the `unenroll-totp-mfa` npm script (`npm run unenroll-totp-mfa -- <uid>`) to `package.json` for convenient invocation.
- Applied a follow-up fix to the unenroll script for improved error handling and factor enumeration.

### MFA Verification Support Guidance

- Added a support contact message to the TOTP verification prompt in `mfa-verification.tsx`, directing users who have lost access to their authenticator app to the Striae support page for account recovery assistance.

### npm Package Files Allowlist Refinement

- Simplified the npm files allowlist by including the full `workers/` directory with targeted exclusion patterns (`.wrangler`, `package-lock.json`, `worker-configuration.d.ts`, `wrangler.jsonc`) instead of enumerating individual inclusion globs.
- Scoped the root `worker-configuration.d.ts` exclusion to the project root to avoid unintended matches.

## Release Statistics

- **Baseline**: `release-notes/RELEASE_NOTES_v5.4.0.md`
- **Commit Range**: `985c7b4c..f4414ce0`
- **Commits Included**: 3 (non-merge commits since the v5.4.0 baseline commit)
- **Build Status**: Succeeded (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed with known worker configuration warnings and 0 errors (`npm run lint`)

## Closing Note

v5.4.1 completes the TOTP MFA rollout from v5.4.0 by providing an administrative recovery path for locked-out users and adding user-facing support guidance at the verification prompt. The npm files allowlist refinement simplifies package distribution patterns for workers.
