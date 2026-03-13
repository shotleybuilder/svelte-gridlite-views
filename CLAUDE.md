# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**svelte-gridlite-views** is a Svelte 5 library for saving and restoring table view configurations (filters, sorting, columns) with PGLite persistence. It is the companion library to `@shotleybuilder/svelte-gridlite-kit`.

This is a **SvelteKit package library**, not a standalone app. The package is published to npm and consumed by other Svelte applications.

Forked from `svelte-table-views-tanstack` (v0.1.7), replacing TanStack DB with PGLite as the persistence layer.

## Development Commands

### Build and Package
```bash
npm run build              # Build dev server + package library
npm run package            # Package library for distribution
```

### Testing and Quality
```bash
npm test                   # Run Vitest tests
npm run check              # Type-check with svelte-check
npm run check:watch        # Type-check in watch mode
```

### Development
```bash
npm run dev                # Start Vite dev server (for demo/testing)
npm run preview            # Preview production build
```

## Architecture

### Core Data Flow

```
UI Components (Svelte)
    ↕ (events/props)
Svelte Stores (reactive layer)
    ↕ (live query callbacks)
PGLite Live Queries
    ↕ (SQL)
PGLite Tables (_gridlite_views, _gridlite_column_state)
    ↕ (persistence)
IndexedDB (idb://)
```

### Key Files

- **`src/lib/stores/view-store.ts`** - Core: `initViewStore()` factory returning grid-scoped store bundle with reactive stores + CRUD actions
- **`src/lib/db/views.ts`** - Raw SQL CRUD functions for _gridlite_views table
- **`src/lib/db/migrations.ts`** - Schema DDL + idempotent migration runner
- **`src/lib/components/ViewSelector.svelte`** - Dropdown for selecting/renaming/deleting views
- **`src/lib/components/SaveViewModal.svelte`** - Modal for saving new views
- **`src/lib/types.ts`** - All TypeScript interfaces
- **`src/lib/index.ts`** - Public API exports

### Key Design Differences from svelte-table-views-tanstack

1. **Prop-based stores** (not global): Each grid gets its own `ViewStoreBundle` via `initViewStore(db, gridId)`. Components receive the bundle as a `viewStore` prop.
2. **PGLite persistence** (not TanStack DB): SQL tables with JSONB columns, live queries for reactivity.
3. **Grid-scoped views**: Views belong to a `grid_id`, enabling multiple grids per app.
4. **Consumer provides PGLite instance**: The library does NOT create its own database.

### Store Architecture

`initViewStore(db, gridId)` returns a `ViewStoreBundle`:
- **`savedViews`** - Readable store of all views for this grid (live query backed)
- **`recentViews`** - Readable store of recent views (last 7 days, top 5)
- **`activeViewId`** - Writable store tracking selected view
- **`activeViewModified`** - Writable store tracking unsaved changes
- **`activeView`** - Derived store (activeViewId + savedViews)
- **`ready`** - Readable boolean, true after migrations complete
- **`actions`** - CRUD methods: save, load, update, delete, rename, markModified, clearActive, nameExists, getStorageStats, setDefaultView, loadDefaultView, waitForReady
- **`destroy()`** - Cleanup live query subscriptions

### Component Pattern

Components accept `viewStore: ViewStoreBundle` as a prop:
```svelte
<ViewSelector {viewStore} on:viewSelected={handler} />
<SaveViewModal {viewStore} bind:open={showModal} config={currentConfig} on:save={handler} />
```

### SQL Tables

- **`_gridlite_views`** - View definitions with JSONB config columns
- **`_gridlite_column_state`** - Per-view column state (cascading delete)

### Validation Rules

- 50 view limit per grid
- 100 char max for view names
- 500 char max for descriptions

## Peer Dependencies

- `svelte: ^4.0.0 || ^5.0.0`
- `@electric-sql/pglite: >=0.2.0`

## SSR Safety

PGLite is browser-only (WASM). `initViewStore()` throws if called on the server. Consuming pages should use `export const ssr = false` or `{#if browser}` guards.

## Claude Code Skills

| Skill | Path | What it covers |
|-------|------|----------------|
| Quick Start | `.claude/skills/quick-start/SKILL.md` | Install, SvelteKit config, PGLite init, minimal integration, common mistakes |
| Store API | `.claude/skills/store-api/SKILL.md` | `initViewStore()` signature, all 6 stores with types, all 11 actions with signatures |
| Components | `.claude/skills/components/SKILL.md` | ViewSelector & SaveViewModal props/events, Update vs Save New pattern, ViewConfig type |
| View CRUD | `.claude/skills/view-crud/SKILL.md` | Full lifecycle (save → load → modify → update → delete), default views, storage stats |
| Recipes | `.claude/skills/recipes/SKILL.md` | sgk integration, multiple grids, default view auto-load, migration from svelte-table-views-tanstack |

## Reference Demos

| Route | What it demonstrates |
|-------|---------------------|
| `src/routes/demo/+page.svelte` | Full integration: PGLite init, view store, ViewSelector, SaveViewModal, filter presets, column visibility, storage stats, default views, cleanup |

## Common Integration Patterns

### 1. Initialize PGLite + View Store
```ts
import { PGlite } from '@electric-sql/pglite';
import { live } from '@electric-sql/pglite/live';
import { initViewStore } from '@shotleybuilder/svelte-gridlite-views';

const db = await PGlite.create({ extensions: { live } });
const viewStore = initViewStore(db, 'my-grid');
await viewStore.actions.waitForReady();
```

### 2. Save Current Config as a View
```ts
const config = { filters: [...], sorting: [...], columnVisibility: {...} };
await viewStore.actions.save('My View', config, 'Optional description');
```

### 3. Load a View and Apply Config
```svelte
<ViewSelector {viewStore} on:viewSelected={(e) => applyConfig(e.detail.config)} />
```

### 4. Update vs Save New (Split Button)
```ts
if ($activeViewId && $activeViewModified) {
  await viewStore.actions.update($activeViewId, newConfig);
} else {
  showSaveModal = true;
}
```

### 5. Cleanup on Destroy
```ts
import { onDestroy } from 'svelte';
onDestroy(() => viewStore.destroy());
```

## Demo Application

`src/routes/` contains a demo SvelteKit app for testing during development. NOT part of the published package. The demo creates an in-memory PGLite instance and initializes the view store on mount.
