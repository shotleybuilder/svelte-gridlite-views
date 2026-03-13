# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2025-03-13

### Added

- `initViewStore(db, gridId)` factory returning grid-scoped `ViewStoreBundle` with 6 reactive stores and 11 CRUD actions
- `ViewSelector` component — dropdown for selecting, renaming, duplicating, and deleting saved views
- `SaveViewModal` component — modal for saving new views with name, description, and config summary
- PGLite persistence layer with `_gridlite_views` and `_gridlite_column_state` SQL tables
- Live query-backed stores (`savedViews`, `recentViews`) for automatic reactivity
- Idempotent migration runner (`runViewMigrations`)
- Low-level SQL functions: `saveView`, `loadView`, `loadViews`, `updateView`, `deleteView`, `touchViewUsage`, `setDefaultView`, `loadDefaultView`, `nameExists`, `getViewCount`
- Default view support (`setDefaultView` / `loadDefaultView`)
- Storage stats and 50-view limit per grid
- Full TypeScript types: `ViewConfig`, `SavedView`, `ViewStoreBundle`, `ViewActions`, `FilterCondition`, `SortConfig`, `GroupConfig`, `AggregationConfig`
- Demo app (`src/routes/demo/`) with filter presets, column visibility toggles, storage stats, and default view auto-load
- Development scripts (`scripts/development/start.sh`, `stop.sh`)
- Claude Code skills (quick-start, store-api, components, view-crud, recipes)
- Claude Code commands (create-github-issue, session-start, session-end)

### Notes

- Forked from [svelte-table-views-tanstack](https://github.com/shotleybuilder/svelte-table-views-tanstack) v0.1.7
- Replaces TanStack DB with PGLite as the persistence layer
- Stores are prop-based (not global) — each grid gets its own `ViewStoreBundle`
- Consumer provides the PGLite instance; the library does not create its own database

[0.0.1]: https://github.com/shotleybuilder/svelte-gridlite-views/releases/tag/v0.0.1
