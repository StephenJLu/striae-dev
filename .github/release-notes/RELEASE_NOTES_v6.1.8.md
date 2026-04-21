# Striae Release Notes - v6.1.8

**Release Date**: April 20, 2026
**Period**: April 20, 2026 through April 20, 2026
**Total Commits**: 9 (non-merge after the v6.1.7 bump)

## Patch Release - Worker Cleanup, Test Suite Expansion, and Maintenance

## Summary

v6.1.8 is a patch release focused on worker code cleanup, consolidation of worker source files, expansion of the unit test suite across app forensics and worker data layers, removal of community links from documentation, and general maintenance including gitignore, lint, and file cleanup.

## Detailed Changes

### Worker CORS Cleanup and Source File Consolidation

- Removed CORS configuration from the audit, data, image, pdf, and user worker source files, simplifying worker entry points.
- Renamed `.example.ts` worker files to canonical `.ts` source files across all workers, making them the authoritative source rather than templates.
- Refactored user worker route handling to reduce CORS overhead and clean up route registration.
- Removed the CORS scaffolding step from deploy configuration scripts.

### Unit Test Suite Expansion

- Added app-level unit tests covering forensics operations: confirmation signing, export encryption, manifest signing, and audit export signing.
- Added app-level unit test for confirmation summary data operations.
- Added worker-level unit tests for data worker utilities: encryption utils, signature utils, and signing payload utils.
- Updated `tsconfig.json` to include the new test directories.

### Community Links Removal

- Removed community links from `.github/README.md` and `README.md`.

### Maintenance

- Updated `.gitignore` to reflect the removed E2E test infrastructure and output file patterns.
- Removed empty `out.txt` and `output.txt` output files that were leftover from development.
- Fixed lint issues in `eslint.config.js`, worker test files, and `README.md`.

## Release Statistics

- **Baseline**: `.github/release-notes/RELEASE_NOTES_v6.1.7.md`
- **Commits Included**: 9 (non-merge commits after `bump v6.1.7` on 04/20/2026)
- **Build Status**: Passed (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed with expected warnings in generated `worker-configuration.d.ts` files (`npm run lint`)

## Closing Note

v6.1.8 delivers targeted cleanup across the worker layer by removing CORS boilerplate and consolidating source files, expands automated test coverage for forensics and worker data utilities, and removes stale community references from documentation.
