# Striae Release Notes - v7.1.0

**Release Date**: April 25, 2026
**Period**: April 23, 2026 through April 25, 2026
**Total Commits**: 17 (non-merge after the v7.0.1 bump)

## Minor Release - Lists Worker and Registration Allowlist Overhaul

## Summary

v7.1.0 introduces a dedicated Cloudflare Worker (`lists-worker`) to replace static config-file-based email list management for member and Primer Shear registration allowlists. The lists worker exposes a KV-backed, auth-gated API for reading and managing email entries, and is integrated into the Pages registration flow via a service binding and a shared client helper. This release also resolves a UUID package vulnerability, cleans up dead email deployment scripts and Durable Object scaffolding, and applies post-integration registration check fixes.

## Detailed Changes

### Lists Worker

- Added a new `workers/lists-worker/` Cloudflare Worker that serves as the authoritative backend for email allowlist management.
- The worker stores and retrieves comma-delimited email lists from a KV namespace (`STRIAE_LISTS`), keyed by list type (`allow` for members, `primershear` for Primer Shear).
- Supports `GET` (read full list), `POST` (add entry), and `DELETE` (remove entry) operations, all gated by a `LISTS_ADMIN_SECRET` Bearer token with constant-time comparison to mitigate timing side-channels.
- Added `workers/lists-worker/wrangler.jsonc.example` and `workers/lists-worker/package.json` for worker scaffolding.
- Removed an early Durable Objects-based variant (`lists-do.ts`) in favor of a simpler KV-only implementation.

### Registration Allowlist Integration

- Added `functions/api/_shared/lists-client.ts` — a shared client helper that reads email lists from the lists-worker via service binding, returning a typed `ListResult` (ok/error) to allow callers to apply fail-open or fail-closed logic appropriate to their security context.
- Refactored `functions/api/_shared/registration-allowlist.ts` to use the lists-client instead of static config file reads.
- Updated `functions/api/user/[[path]].ts` to integrate the new lists-worker service binding into the registration check path.
- Fixed registration allowlist logic and a registration check path bug introduced during the integration.
- Removed static `app/config-example/members.emails` and `app/config-example/primershear.emails` config-example files, superseded by KV-backed storage.

### Dead Script and Config Cleanup

- Removed `scripts/deploy-members-emails.sh` and `scripts/deploy-primershear-emails.sh` — email list deployment scripts that are no longer needed with the lists-worker KV approach.
- Removed related script references from `package.json` and updated `scripts/deploy-all.sh` and `scripts/deploy-worker-secrets.sh` accordingly.
- Updated `scripts/deploy-config/` modules (`prompt.sh`, `scaffolding.sh`, `validation.sh`) to support lists-worker registration during deploy config setup.

### Security Fix - UUID Vulnerability

- Applied an npm override to resolve a known vulnerability in the `uuid` package pulled in by `firebase-admin`.
- Scoped the override precisely to the `firebase-admin` dependency chain to avoid unintended side effects elsewhere.

### Maintenance

- Bumped Vite across the app.
- Applied general dependency bumps and Cloudflare compatibility date refreshes across the app and workers.
- Updated `.gitignore` for the lists worker artifact directory.
- Applied deploy refresh and miscellaneous code review follow-ups.

## Release Statistics

- **Baseline**: `.github/release-notes/RELEASE_NOTES_v7.0.1.md`
- **Commits Included**: 17 (non-merge commits after `v7.0.1` on 04/22/2026)
- **Build Status**: Passed (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed (`npm run lint`)

## Closing Note

v7.1.0 completes the migration of email allowlist management from static config files to a dedicated, KV-backed lists worker. The registration flow is now fully dynamic and operator-managed without requiring a redeploy to update lists. The UUID security fix and general maintenance polish round out the release.
