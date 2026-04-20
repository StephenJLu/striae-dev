# Striae Release Notes - v6.1.6

**Release Date**: April 19, 2026
**Period**: April 19, 2026 through April 19, 2026
**Total Commits**: 6 (non-merge after the v6.1.5 bump)

## Patch Release - Sidebar Navigation Update, Vite Native Path Resolution, and Tooling Maintenance

## Summary

v6.1.6 is a patch release that updates the sidebar About & Support footer to surface a direct Manage Membership link, migrates the Vite configuration to use native tsconfig path resolution in place of the `vite-tsconfig-paths` plugin, and rolls in the expected post-v6.1.5 maintenance covering dependency bumps, compatibility-date updates, and Dependabot configuration cleanup.

## Detailed Changes

### Sidebar Navigation Update

- Replaced the "Striae Community" link in the About & Support sidebar footer with a direct "Manage Membership" link pointing to the account management portal.
- This gives users a quicker path to self-service membership and billing management from within the application.

### Vite Native Path Resolution

- Migrated Vite configuration from the third-party `vite-tsconfig-paths` plugin to Vite's built-in `resolve.tsconfigPaths` option.
- Removed the `vite-tsconfig-paths` dependency from the project.

### Tooling and Release Maintenance

- Bumped project dependencies to latest compatible versions.
- Updated compatibility dates across all worker and app example Wrangler configurations.
- Updated Dependabot YAML configuration to reflect current package management structure.

## Release Statistics

- **Baseline**: `.github/release-notes/RELEASE_NOTES_v6.1.5.md`
- **Commits Included**: 6 (non-merge commits after `bump v6.1.5` on 04/18/2026)
- **Build Status**: Passed (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed with expected warnings in generated `worker-configuration.d.ts` files (`npm run lint`)

## Closing Note

v6.1.6 surfaces the Manage Membership link directly in the application sidebar, adopts Vite's native tsconfig path resolution, and packages the expected post-v6.1.5 tooling and compatibility maintenance into a focused patch release.
