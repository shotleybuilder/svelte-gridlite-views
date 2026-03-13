# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-03-13

### Added

- **Persisted group management** — groups are now first-class entities stored in PGLite (`_gridlite_view_groups` table)
- `group_id` column on `_gridlite_views` with FK constraint (`ON DELETE SET NULL` — deleting a group ungroups views, never deletes them)
- `savedGroups` reactive store on `ViewStoreBundle` (live query backed, ordered by `sort_order`)
- `groupActions` on `ViewStoreBundle`: `createGroup`, `renameGroup`, `updateGroupIcon`, `deleteGroup`, `reorderGroups`, `moveViewToGroup`, `groupNameExists`
- `groupId` field on `SavedView` (nullable — ungrouped is valid)
- New types: `ViewGroupRow`, `ViewGroupInput`, `GroupActions`
- New SQL CRUD module: `src/lib/db/groups.ts`
- ViewSidebar: inline group creation (+ button in header), group rename/delete on hover, drag-and-drop views between groups, drag-and-drop group reordering
- ViewSidebar: new events — `groupCreated`, `groupDeleted`, `groupRenamed`, `viewMoved`
- ViewSidebar: drop target highlighting with CSS custom properties (`--drop-target-bg`, `--drop-target-border`)
- Demo app seeds 3 sample groups on first load
- Exported group DB functions: `createGroup`, `renameGroup`, `deleteGroup`, `reorderGroups`, `moveViewToGroup`

### Changed

- `ViewGroup` interface enriched with `gridId`, `sortOrder`, `createdAt`, `updatedAt` (was minimal `id`/`name`/`icon`/`order`)
- ViewSidebar `groups` prop is now a fallback — store-driven groups (`savedGroups`) take precedence when present
- ViewSidebar `viewsByGroup` now uses actual `view.groupId` (was a stub routing all views to ungrouped)
- ViewSidebar group headers changed from `<button>` to `<div role="button">` to allow nested action buttons without a11y violations
- `ViewRow` type now includes `group_id: string | null`

### Fixed

- Nested button a11y warnings in ViewSidebar group headers
- Missing ARIA roles on drag-and-drop containers
- **`_gridlite_column_state` schema conflict** (#3) — removed table creation from views migrations; this table is owned by `svelte-gridlite-kit` and the incompatible schemas caused `column "grid_id" does not exist` errors when both packages were used together

## [0.1.0] - 2026-03-13

### Added

- `ViewSidebar` component — persistent sidebar panel for browsing and managing saved views, as an alternative to the `ViewSelector` dropdown
- `ViewGroup` type for organizing views into collapsible groups in the sidebar
- Sidebar features: search, pinned views, inline rename, set default, delete, storage stats, CSS custom properties theming
- Demo app updated with sidebar + toggle button alongside ViewSelector

## [0.0.1] - 2025-03-13

### Added

- `initViewStore(db, gridId)` factory returning grid-scoped `ViewStoreBundle` with 6 reactive stores and 11 CRUD actions
- `ViewSelector` component — dropdown for selecting, renaming, duplicating, and deleting saved views
- `SaveViewModal` component — modal for saving new views with name, description, and config summary
- PGLite persistence layer with `_gridlite_views` SQL table
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

[0.2.0]: https://github.com/shotleybuilder/svelte-gridlite-views/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/shotleybuilder/svelte-gridlite-views/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/shotleybuilder/svelte-gridlite-views/releases/tag/v0.0.1
