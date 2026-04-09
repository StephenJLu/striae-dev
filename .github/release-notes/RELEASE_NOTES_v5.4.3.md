# Striae Release Notes - v5.4.3

**Release Date**: April 2, 2026
**Period**: March 31, 2026 through April 2, 2026
**Total Commits**: 10 (non-merge since the v5.4.2 baseline)

## Patch Release - Desktop-Only Mobile Warning, Demo Limit Guardrail Follow-Ups, and Audit Export/API Cleanup

## Summary

v5.4.3 packages the post-v5.4.2 stabilization work completed between March 31 and April 2. It adds a session-dismissible mobile/tablet warning overlay at the app root, refines demo-account limit wiring and messaging, removes obsolete audit export code paths, narrows the audit worker to GET/POST-only routes, and refreshes Wrangler plus compatibility metadata.

## Detailed Changes

### Desktop-Only Mobile Warning and Demo Limit Follow-Ups

- Added a new `MobileWarning` overlay at the app root that warns users Striae is intended for desktop browsers and allows session-scoped dismissal via `sessionStorage`.
- Implemented keyboard-focus and Escape-key dismissal handling for the warning dialog, plus backdrop click dismissal, to keep the blocking notice accessible and easy to clear.
- Refined demo-account limit handling in `permissions.ts` so demo case/file blockers use the current config-backed thresholds consistently.
- Updated `app/config-example/config.json` to keep the demo limit configuration keys aligned with the runtime permission checks.
- Included code-review follow-ups touching case export/import validation helpers so the release window's guardrail behavior stays consistent across affected workflows.

### Audit Export and Audit Worker Cleanup

- Removed obsolete client-side audit export modules and related unused types/exports, reducing dead code across the audit viewer and audit service surface.
- Tightened supporting audit export verification and signing utility references as part of that cleanup.
- Removed DELETE endpoint handling from the audit worker routes and example worker file; the audit worker now explicitly supports GET and POST only.

### Tooling and Configuration Maintenance

- Bumped Wrangler to `^4.80.0` across the root package and worker packages, with corresponding lockfile refreshes.
- Updated Pages and worker example compatibility-date metadata to keep deployment examples current.

## Release Statistics

- **Baseline**: `release-notes/RELEASE_NOTES_v5.4.2.md`
- **Commit Range**: `fbdb0368..2ffe1c17`
- **Commits Included**: 10 (non-merge commits since the v5.4.2 baseline commit)
- **Build Status**: Succeeded (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed with known worker configuration warnings and 0 errors (`npm run lint`)

## Closing Note

v5.4.3 is a targeted stabilization patch. It improves user guidance on unsupported mobile form factors, keeps demo-account enforcement aligned with configuration, removes stale audit export code, and narrows the audit worker API surface while rolling forward the usual tooling maintenance.
