# Striae Release Notes - v5.4.5

**Release Date**: April 3, 2026
**Period**: April 2, 2026 through April 3, 2026
**Total Commits**: 2 (non-merge since the v5.4.4 baseline)

## Patch Release - TOTP Script Follow-Ups

## Summary

v5.4.5 is a focused patch release that captures post-v5.4.4 hardening updates to the TOTP MFA enablement script. This release incorporates targeted script adjustments and review-driven cleanup to improve reliability while keeping the broader authentication flow unchanged.

## Detailed Changes

### TOTP Enablement Script Refinement

- Applied follow-up adjustments to `scripts/enable-totp-mfa.mjs` for TOTP-adjacent handling.
- Incorporated additional code-review refinements in the same script.
- Preserved existing release behavior while tightening script-level correctness and maintainability.

## Release Statistics

- **Baseline**: `release-notes/RELEASE_NOTES_v5.4.4.md`
- **Commit Range**: `1544168b..7939bcde`
- **Commits Included**: 2 (non-merge commits since the v5.4.4 baseline commit)
- **Build Status**: Succeeded (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed with known worker configuration warnings and 0 errors (`npm run lint`)

## Closing Note

v5.4.5 is a maintenance patch that keeps momentum after v5.4.4 by tightening TOTP script behavior and capturing review follow-ups without introducing broader workflow changes.
