# Striae Release Notes - v7.0.0

**Release Date**: April 21, 2026
**Period**: April 21, 2026 through April 21, 2026
**Total Commits**: 9 (non-merge after the v6.1.8 bump)

## Major Release - Worker Infrastructure Remodeling with Cloudflare Service Bindings

## Summary

v7.0.0 is a major release delivering a foundational restructuring of the worker proxy infrastructure. All five workers (audit, data, image, pdf, user) have been migrated from HTTP-based domain proxying to Cloudflare Service Bindings, eliminating worker domain environment variables and the associated URL normalization logic. Stale custom auth key bindings have been removed from all workers, and the image management layer has been cleaned up to remove a now-unnecessary fallback path introduced during an earlier signed URL migration. Dependency updates and deploy config refinements accompany the infrastructure changes.

## Detailed Changes

### Worker Infrastructure: Service Bindings Migration

- Replaced HTTP-based worker proxying (via `AUDIT_WORKER_DOMAIN`, `DATA_WORKER_DOMAIN`, `IMAGE_WORKER_DOMAIN`, `PDF_WORKER_DOMAIN`, and `USER_WORKER_DOMAIN` environment variables) with Cloudflare Service Bindings across all five Pages proxy functions (`functions/api/audit/`, `functions/api/data/`, `functions/api/image/`, `functions/api/pdf/`, `functions/api/user/`).
- Removed `normalizeWorkerBaseUrl` helper functions and URL construction logic from all proxy functions; worker calls now use `env.AUDIT_WORKER.fetch(...)`, `env.DATA_WORKER.fetch(...)`, etc.
- Removed the top-level `worker-configuration.d.ts` (7,500+ lines of generated bindings) from the repository; worker configuration is now managed via wrangler type generation.
- Removed `env-utils.sh` (domain environment variable helpers) from deploy config scripts and updated `prompt.sh` and `validation.sh` accordingly.
- Removed `deploy-pages-secrets.sh` worker domain secret handling steps.
- Updated `wrangler.toml.example` and all worker `wrangler.jsonc.example` files to reflect service binding configuration.
- Removed the `WORKER_DOMAINS` block from `.env.example`.
- Added `.gitignore` entry for generated `worker-configuration.d.ts` files.

### Custom Auth Key Removal

- Removed stale custom auth key (`CUSTOM_AUTH_KEY_SECRET`) bindings from all worker types (data, image, pdf, user) that had been carried over from an earlier authentication scheme.
- Cleaned up all per-worker `worker-configuration.d.ts` generated files (13,000+ lines each) that referenced the stale key binding.
- Removed `customAuthKey` from data worker config, image worker auth handlers, and user worker auth; updated corresponding types.

### Image Management Cleanup

- Removed the direct blob retrieval fallback from `image-manage.ts` that was introduced during the signed URL migration. Image access now exclusively uses signed URLs, removing the `fetchImageApi` migration path and simplifying the audit log entry to always record `urlType: 'signed'`.
- Removed the return of `blob` and `url` (blob object URL) from the `getImageUrl` response path; only the signed URL is returned.

### Deploy Config: Worker Name Registration

- Added worker name registration step to `scripts/deploy-config/modules/scaffolding.sh` to properly configure worker names during service binding setup.

### Dependency Updates

- Bumped Firebase SDK and ESLint in the app layer.
- Bumped app dependencies and updated Cloudflare compatibility dates across all workers and the Pages function layer.
- Bumped worker package versions across all five workers.
- Updated `tsconfig.json` for compatibility with updated dependency versions.

## Release Statistics

- **Baseline**: `.github/release-notes/RELEASE_NOTES_v6.1.8.md`
- **Commits Included**: 9 (non-merge commits after `bump v6.1.8` on 04/20/2026)
- **Build Status**: Passed (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed with expected warnings in generated `worker-configuration.d.ts` files (`npm run lint`)

## Closing Note

v7.0.0 marks a significant infrastructure milestone by replacing all HTTP-based worker proxying with Cloudflare Service Bindings across the entire worker layer. This eliminates worker domain environment variables, URL normalization helpers, and thousands of lines of generated type stubs from version control. Combined with the removal of stale auth key bindings and the completion of the signed URL migration for image access, the worker infrastructure is now substantially cleaner and more maintainable going forward.
