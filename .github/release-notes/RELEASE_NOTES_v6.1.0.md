# Striae Release Notes - v6.1.0

**Release Date**: April 14, 2026
**Period**: April 12, 2026 through April 14, 2026
**Total Commits**: 18 (non-merge since 04/12/2026)

## Minor Release - Item Model Refactor and Split Item Data/Reporting

## Summary

v6.1.0 delivers a broad data-model and UX transition from class-centric terminology to item-centric terminology, introduces split left/right item datasets with corresponding notes/reporting updates, and includes release-window stabilization work across dependencies and archive re-export packaging.

## Detailed Changes

### Item Model and Terminology Refactor

- Performed a global type/domain rename from class to item to align terminology across data model, UI text, and interactions.
- Updated item type/subclass display behavior in canvas and related UI surfaces.
- Moved subclass controls and adjusted supporting UI copy for clearer item workflow behavior.

### Split Item Data, Notes, and Reporting

- Added split left/right item datasets and propagated split-data support through summary core/display layers.
- Added split additional-notes handling and updated item notes displays to support the new data shape.
- Updated item icon/tool handling and PDF reporting formats to reflect split item model/report output requirements.

### File Management and Release-Window Stabilization

- Refined file management filtering behavior to better match the new item data pathways.
- Included release-window maintenance commits (`bump deps`, `code review`) and a targeted fix for archive re-export packaging.

## Release Statistics

- **Baseline**: `.github/release-notes/RELEASE_NOTES_v6.0.1.md`
- **Commit Range**: `6e55324a..825109be`
- **Commits Included**: 18 (non-merge commits since 04/12/2026)
- **Build Status**: Passed (`npm run build`)
- **Typecheck Status**: Passed (`npm run typecheck`)
- **Lint Status**: Passed with expected warnings in generated `worker-configuration.d.ts` files (`npm run lint`)

## Closing Note

v6.1.0 is a feature-focused minor release that establishes split item data/reporting foundations and completes the class-to-item terminology transition while carrying forward targeted reliability and packaging fixes in the same release window.
