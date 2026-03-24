# Striae Release Notes - v4.3.4

**Release Date**: March 23, 2026
**Period**: March 23 - March 23, 2026
**Total Commits**: 10 (non-merge since v4.3.3 release)

## Patch Release - Audit Trail Rename Provenance and Audit Module Cleanup

## Summary

v4.3.4 is a targeted patch release focused on audit trail clarity and maintainability. This release strengthens case-rename provenance by logging both sides of rename operations (source and destination perspectives), adds explicit rename-origin metadata for downstream filtering/reporting, and performs a full dead-surface cleanup of audit service/builders/types exports without changing active runtime behavior.

## Detailed Changes

### Case Rename Audit Provenance Expansion

- Updated rename success logging to capture the original case context as a rename operation from old case number to new case number.
- Added a second success audit entry for the destination case to capture case creation-through-rename from the original case number.
- Ensured rename operations now leave a complete two-sided audit narrative for chain-of-custody style review.

### Explicit Rename-Origin Metadata

- Extended case creation audit payload support with optional rename-source metadata.
- Added `createdByRename` flag in case audit details to explicitly identify creation events that originated from rename operations.
- Preserved existing case creation behavior for non-rename flows while enabling clean downstream filtering for rename-derived creations.

### Audit Service and Export Surface Cleanup (No Functional Change)

- Removed unused audit service methods with no repository call sites.
- Reduced unused exported surface in audit modules by internalizing helper symbols and interfaces that were only used within their defining files.
- Simplified audit barrel exports to publish only singleton service instances currently consumed by the app.
- Kept live event/builder paths and runtime behavior intact while reducing maintenance overhead and API noise.
- **Internal type cleanup:** Several audit detail interfaces (`AuditDetails`, `CaseAuditDetails`, and related variants) are now module-private. These were internal implementation types not intended for external use. `npm run typecheck` confirms no call sites rely on them. No public-facing behavior is affected.
- **Service class encapsulation:** `AuditService` and `AuditExportService` class constructors are no longer exported from `app/services/audit`. Only the singleton instances are exposed. Consumers should use the provided singletons rather than instantiating their own copies. No internal consumers relied on direct class imports.

### Audit/Route Alignment and Follow-up Cleanup

- Included related audit entry detail updates for annotation/confirmation pathways and archive-case audit entry refinements.

### Dependency and Release-Window Maintenance

- Updated React Router package surfaces in the release window (`react-router` and `@react-router/cloudflare` 7.13.2 alignment and related route dependency bump follow-up).
- Resolved duplicate import cleanup captured during the same patch cycle.
- Included release-notes maintenance committed in this release window.

## Release Statistics

- **Commit Range**: `v4.3.3..v4.3.4`
- **Commits Included**: 10 (non-merge commits in the range)
- **Build Status**: Succeeded (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed with warnings - 0 errors, 12 known/ignored worker configuration warnings (`npm run lint`)

## Closing Note

v4.3.4 improves forensic audit readability for rename workflows while delivering a conservative internal cleanup of audit module surface area. The release is intended to improve traceability and long-term maintainability without changing expected user-facing behavior outside enhanced rename provenance visibility.
