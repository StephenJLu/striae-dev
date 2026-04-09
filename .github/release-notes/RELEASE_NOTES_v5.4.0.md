# Striae Release Notes - v5.4.0

**Release Date**: March 31, 2026
**Period**: March 29–31, 2026
**Total Commits**: 25 (non-merge since the v5.3.2 baseline)

## Minor Release - TOTP MFA, Component Reorganization, and CSS Consolidation

## Summary

v5.4.0 introduces TOTP (time-based one-time password) multi-factor authentication alongside dedicated enrollment, verification, and profile management surfaces. The release also undertakes a structural component reorganization—migrating import and case-modal components from the sidebar tree into the navbar tree—and follows up with a broad CSS consolidation pass that collapses per-modal individual stylesheets into shared CSS modules. Dependency and compatibility date maintenance rounds out the cycle.

## Detailed Changes

### TOTP MFA

- Added `mfa-totp-enrollment.tsx` — a new enrollment component guiding users through TOTP authenticator app setup, including QR code display and verification code entry.
- Added `mfa-enrolled-factors.tsx` — a component listing all currently enrolled MFA factors with individual revocation support.
- Added `mfa-totp-section.tsx` — a profile-level management surface for TOTP enrollment state, covering enroll, unenroll, and re-enroll flows with confirmation prompts.
- Extended `mfa-enrollment.tsx` and `mfa-verification.tsx` to accommodate TOTP alongside the existing phone-based flow.
- Extended `mfa.ts` auth utility with TOTP-specific enrollment and verification helpers.
- Updated `manage-profile.tsx` to surface the new TOTP management section.
- Added `mfa-phone-update.tsx` refinements for phone MFA profile management consistency.
- Extended `auth.module.css` and `user.module.css` with enrollment and management UI styles.
- Expanded Firebase error code coverage in `errors.ts` to account for TOTP-related error states.

### Component Reorganization

- Migrated case-import components and hooks from `app/components/sidebar/case-import/` to `app/components/navbar/case-import/` to align with the active navbar-driven import entry point.
- Moved `all-cases-modal` from the cases component directory into `app/components/navbar/case-modals/`, consolidating all case-level modals under the navbar surface.
- Moved class-details sub-components (`class-details-fields`, `class-details-modal`, `class-details-sections`, `class-details-shared`, `use-class-details-state`) from the flat notes directory into a dedicated `class-details/` subdirectory for better organization.
- Note: a `mv files modal to navbar` change was introduced and then reverted in this cycle; the files modal will be addressed in a future release.

### CSS Consolidation

- Collapsed individual per-modal CSS module files for archive, delete, export, rename, and open case modals into a single shared `case-modal-shared.module.css`, reducing stylesheet fragmentation across the case-modals surface.
- Consolidated auth, files, notes, toolbar, and user component CSS module files to reduce duplication and align styling patterns across feature areas.

### Dependency and Tooling Maintenance

- Bumped Wrangler from 4.77.0 to 4.79.0 in the wrangler-ecosystem package group.
- Applied dependency updates across app `package.json` and all worker `package-lock.json` files.
- Refreshed Cloudflare compatibility dates across worker and Pages configurations.
- Applied npm package list updates and overrides.

## Release Statistics

- **Baseline**: `release-notes/RELEASE_NOTES_v5.3.2.md`
- **Commit Range**: `a90dfb9c..7f96cf51`
- **Commits Included**: 25 (non-merge commits since the v5.3.2 baseline commit)
- **Build Status**: Succeeded (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed with 12 known worker configuration warnings and 0 errors (`npm run lint`)

## Closing Note

v5.4.0 delivers TOTP MFA as the headline feature, providing users with a more secure and widely compatible second authentication factor option. The component reorganization and CSS consolidation work in this cycle improve structural consistency and reduce stylesheet sprawl across the navbar and case-modal surfaces.
