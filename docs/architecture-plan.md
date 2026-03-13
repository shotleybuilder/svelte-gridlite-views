# svelte-gridlite-views - Architecture Plan

## Origin

Fork from `svelte-table-views-tanstack` (v0.1.7) to build a purpose-built view persistence library for PGLite as the storage engine. Designed as the companion library to `@shotleybuilder/svelte-gridlite-kit`.

## Why Fork (Not Extend)

- TanStack DB and PGLite are fundamentally different storage paradigms — TanStack DB uses JavaScript collections with localStorage serialization; PGLite uses SQL tables with IndexedDB persistence
- svelte-gridlite-kit already has a PGLite instance running — sharing it for view storage avoids a second persistence layer and keeps all config in one database
- PGLite enables features impossible with TanStack DB: SQL queries over views (recent, by grid, full-text search on names), JSONB indexing, transactional saves, and relational integrity between views and column state
- The lazy dynamic import pattern for TanStack DB (`await import('@tanstack/db')`) becomes unnecessary — PGLite is already initialized by the parent grid component
- View metadata queries (recent views, usage stats, storage limits) become simple SQL instead of JavaScript array operations
- svelte-table-views-tanstack remains valuable for apps using TanStack DB/TanStack Table

## Key Design Decisions

- **No TanStack DB dependency.** PGLite is the sole persistence layer.
- **Consumer provides the PGLite instance.** The library does NOT create its own database — it receives the `PGliteWithLive` instance from svelte-gridlite-kit (or any PGLite app). This avoids multiple database instances and enables shared transactions.
- **SQL schema via migrations.** Views and column state stored in `_gridlite_views` and `_gridlite_column_state` tables, managed by an idempotent migration runner.
- **Live queries drive reactivity.** PGLite `live.query()` replaces the manual `refreshViews()` pattern. When a view is saved/deleted/updated, the live query callback fires automatically and the Svelte store updates.
- **Svelte stores remain the reactive layer for UI.** Components subscribe to stores; stores are backed by live queries.
- **JSONB for complex config.** Filters, sorting, grouping, column visibility, and column order stored as JSONB columns — queryable and indexable.
- **Grid-scoped views.** Each view belongs to a `grid_id`, enabling multiple independent grids in the same app to have separate view sets.
- **Extended metadata.** Adds `last_used`, `usage_count`, `created_at`, `updated_at` columns (vs. the original's timestamp-only metadata stored in the JS object).

## Relationship to svelte-gridlite-kit

```
┌─────────────────────────────────────────────────────┐
│  Consumer App (SvelteKit)                           │
│                                                     │
│  ┌─────────────────┐    ┌────────────────────────┐  │
│  │ svelte-gridlite │    │  svelte-gridlite-views │  │
│  │      -kit       │    │                        │  │
│  │                 │    │  ViewSelector.svelte    │  │
│  │  GridLite.svelte│    │  SaveViewModal.svelte   │  │
│  │  FilterBar      │    │  viewActions (CRUD)     │  │
│  │  SortBar        │    │  savedViews store       │  │
│  │  GroupBar       │    │  activeView store       │  │
│  │  ColumnMenu     │    │                        │  │
│  └────────┬────────┘    └───────────┬────────────┘  │
│           │                         │               │
│           │    ┌────────────┐       │               │
│           └───►│  PGLite    │◄──────┘               │
│                │  instance  │                       │
│                │ (idb://)   │                       │
│                └────────────┘                       │
│                  shared db                          │
└─────────────────────────────────────────────────────┘
```

- svelte-gridlite-kit creates the PGLite instance and passes it to svelte-gridlite-views
- Both libraries operate on the same database — views reference grids by `grid_id`
- svelte-gridlite-kit already defines `_gridlite_views` and `_gridlite_column_state` tables in its migrations — svelte-gridlite-views will reuse those tables or extend them

## What Carries Over from svelte-table-views-tanstack

- **UI Components**: ViewSelector.svelte, SaveViewModal.svelte (rendering layer, Tailwind styles)
- **Store pattern**: `savedViews`, `recentViews`, `activeViewId`, `activeViewModified`, `activeView` stores
- **viewActions API surface**: `save()`, `load()`, `update()`, `delete()`, `rename()`, `markModified()`, `clearActive()`, `nameExists()`, `getStorageStats()`, `waitForReady()`
- **Component events**: `viewSelected`, `deleteView`, `save` CustomEvents
- **Validation rules**: 50 view limit, 100 char name, 500 char description
- **Keyboard navigation**: Arrow keys, Enter, Escape in ViewSelector
- **Search/filter**: In-dropdown search over view names

## What Gets Rewritten

| Area | TanStack DB (current) | PGLite (new) |
|------|----------------------|--------------|
| **Initialization** | `createCollection(localStorageCollectionOptions(...))` with lazy dynamic import | Consumer passes `PGliteWithLive` instance; library runs migrations |
| **Collection/Table** | Single JS collection with `storageKey` | SQL tables: `_gridlite_views`, `_gridlite_column_state` |
| **Create** | `collection.insert(view)` | `INSERT INTO _gridlite_views ... ON CONFLICT DO UPDATE` |
| **Read one** | `collection.get(id)` | `SELECT * FROM _gridlite_views WHERE id = $1` |
| **Read all** | `collection.toArray` | `SELECT * FROM _gridlite_views WHERE grid_id = $1 ORDER BY name` |
| **Update** | `collection.update(id, draft => { ... })` | `UPDATE _gridlite_views SET ... WHERE id = $1` |
| **Delete** | `collection.delete(id)` | `DELETE FROM _gridlite_views WHERE id = $1` (+ cascade column_state) |
| **Refresh** | `refreshViews()` reads `collection.toArray`, sets Svelte store | Live query callback auto-updates store; or manual `SELECT` + `store.set()` |
| **Ready state** | `collection.preload()` + `savedViewsReady` store | Migrations complete = ready; no async collection bootstrapping |
| **Recent views** | Derived store with JS filter/sort | `SELECT ... WHERE last_used > NOW() - INTERVAL '7 days' ORDER BY last_used DESC LIMIT 5` |
| **Name exists** | `views.some(v => v.name === name)` | `SELECT 1 FROM _gridlite_views WHERE name = $1 AND grid_id = $2 LIMIT 1` |
| **Storage stats** | `views.length` from JS array | `SELECT COUNT(*) FROM _gridlite_views WHERE grid_id = $1` |
| **SSR safety** | `typeof window !== 'undefined'` guards + dynamic import | `typeof window !== 'undefined'` guards (PGLite is browser-only) |
| **Persistence** | localStorage via TanStack DB's `localStorageCollectionOptions` | IndexedDB via PGLite's `idb://` dataDir |

## New Capabilities (Not in svelte-table-views-tanstack)

- **Grid-scoped views**: Views belong to a specific `grid_id`, enabling multiple tables per app
- **Default view per grid**: `is_default` flag with `setDefaultView()` / `loadDefaultView()`
- **Column state persistence**: Separate `_gridlite_column_state` table for granular column visibility/width/position per view
- **SQL-queryable metadata**: Full-text search on view names, complex ordering, date range queries
- **Shared database**: One PGLite instance for both data and config — no second storage layer
- **Transactional operations**: Multi-step operations (e.g., delete view + cascade column state) can use `db.transaction()`

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

### Initialization Pattern

```typescript
// In the consuming app (e.g., +page.svelte)
import { PGlite } from '@electric-sql/pglite';
import { live } from '@electric-sql/pglite/live';
import { GridLite } from '@shotleybuilder/svelte-gridlite-kit';
import { initViewStore, ViewSelector, SaveViewModal } from '@shotleybuilder/svelte-gridlite-views';

let db: PGliteWithLive;

onMount(async () => {
  db = new PGlite({ dataDir: 'idb://my-app', extensions: { live } });
  await runMigrations(db);  // from svelte-gridlite-kit

  // Initialize the view store for this grid
  const viewStore = initViewStore(db, 'my-grid-id');
});
```

### Store Architecture

```typescript
/**
 * Initialize the view management system for a specific grid.
 * Consumer calls this once per grid instance with their PGLite instance.
 *
 * Returns a store bundle scoped to the given gridId.
 */
export function initViewStore(db: PGliteWithLive, gridId: string): ViewStoreBundle;

interface ViewStoreBundle {
  // Reactive stores
  savedViews: Readable<SavedView[]>;      // All views for this grid (live query backed)
  recentViews: Readable<SavedView[]>;     // Last 7 days, top 5
  activeViewId: Writable<string | null>;
  activeViewModified: Writable<boolean>;
  activeView: Readable<SavedView | null>;
  ready: Readable<boolean>;

  // CRUD actions
  actions: ViewActions;

  // Cleanup
  destroy: () => Promise<void>;
}
```

### CRUD Operations (SQL)

```typescript
// ─── Save ─────────────────────────────────────────────────────────
async save(input: SavedViewInput): Promise<SavedView> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.query(
    `INSERT INTO _gridlite_views
      (id, grid_id, name, description, filters, filter_logic, sorting,
       grouping, column_visibility, column_order, usage_count, last_used,
       created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11, $11, $11)`,
    [id, gridId, input.name, input.description ?? null,
     JSON.stringify(input.config.filters),
     input.config.filterLogic ?? 'and',
     JSON.stringify(input.config.sorting ?? []),
     JSON.stringify(input.config.grouping ?? []),
     JSON.stringify(input.config.columnVisibility ?? {}),
     JSON.stringify(input.config.columnOrder ?? []),
     now]
  );
  // Live query auto-updates savedViews store
}

// ─── Load ─────────────────────────────────────────────────────────
async load(id: string): Promise<SavedView | undefined> {
  await db.query(
    `UPDATE _gridlite_views
     SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [id]
  );
  activeViewId.set(id);
  activeViewModified.set(false);
  // Live query auto-updates; return the view from store
}

// ─── Delete ───────────────────────────────────────────────────────
async delete(id: string): Promise<void> {
  await db.query(`DELETE FROM _gridlite_column_state WHERE view_id = $1`, [id]);
  await db.query(`DELETE FROM _gridlite_views WHERE id = $1`, [id]);
  if (get(activeViewId) === id) {
    activeViewId.set(null);
    activeViewModified.set(false);
  }
}

// ─── Recent Views (SQL, not JS) ───────────────────────────────────
// Instead of a derived store doing JS filter/sort, use a second live query:
const recentViewsQuery = createLiveQueryStore<ViewRow>(db,
  `SELECT * FROM _gridlite_views
   WHERE grid_id = $1 AND last_used > NOW() - INTERVAL '7 days'
   ORDER BY last_used DESC LIMIT 5`,
  [gridId]
);
```

## Type Definitions

```typescript
export interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: unknown;
}

export type FilterLogic = 'and' | 'or';

export interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

export interface GroupConfig {
  column: string;
  aggregations?: AggregationConfig[];
}

export interface ViewConfig {
  filters: FilterCondition[];
  filterLogic: FilterLogic;
  sorting: SortConfig[];
  grouping: GroupConfig[];
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  columnWidths: Record<string, number>;
  pageSize?: number;
}

export interface SavedView {
  id: string;
  gridId: string;
  name: string;
  description?: string;
  config: ViewConfig;
  originalQuery?: string;
  isDefault: boolean;
  usageCount: number;
  lastUsed: string;       // ISO timestamp (Postgres TIMESTAMP)
  createdAt: string;
  updatedAt: string;
}

export type SavedViewInput = Pick<SavedView, 'name' | 'config'> &
  Partial<Pick<SavedView, 'description' | 'originalQuery'>>;
```

## Schema (SQL DDL)

The migration extends svelte-gridlite-kit's existing schema with additional columns needed for view management:

```sql
-- Migration v2: Extend _gridlite_views for full view management
-- (v1 is in svelte-gridlite-kit's migrations.ts)

ALTER TABLE _gridlite_views
  ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS original_query TEXT,
  ADD COLUMN IF NOT EXISTS column_widths JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS page_size INTEGER;

CREATE INDEX IF NOT EXISTS idx_gridlite_views_last_used
  ON _gridlite_views (last_used DESC);

CREATE INDEX IF NOT EXISTS idx_gridlite_views_name_search
  ON _gridlite_views USING gin (to_tsvector('english', name));
```

If used standalone (without svelte-gridlite-kit), the library will run the full migration set including the base table creation.

## Directory Structure

```
svelte-gridlite-views/
├── src/lib/
│   ├── index.ts                    # Public API exports
│   ├── types.ts                    # TypeScript interfaces
│   ├── db/
│   │   ├── migrations.ts           # Schema DDL + migration runner
│   │   └── views.ts                # Raw SQL CRUD functions
│   ├── stores/
│   │   └── view-store.ts           # initViewStore(), Svelte stores, viewActions
│   └── components/
│       ├── ViewSelector.svelte     # Carried from svelte-table-views-tanstack
│       └── SaveViewModal.svelte    # Carried from svelte-table-views-tanstack
├── src/routes/                     # Demo app (not published)
├── package.json
├── CLAUDE.md
└── tests/
```

## Public API

```typescript
// Components
export { default as ViewSelector } from './components/ViewSelector.svelte';
export { default as SaveViewModal } from './components/SaveViewModal.svelte';

// Store Factory
export { initViewStore } from './stores/view-store.js';
export type { ViewStoreBundle, ViewActions } from './stores/view-store.js';

// Database
export { runViewMigrations } from './db/migrations.js';
export { saveView, loadView, loadViews, deleteView, loadDefaultView, setDefaultView } from './db/views.js';

// Types
export type {
  SavedView, SavedViewInput, ViewConfig,
  FilterCondition, FilterLogic, SortConfig, GroupConfig
} from './types.js';
```

## Component Changes

### ViewSelector.svelte

Minimal changes required:
- Accept `viewStore: ViewStoreBundle` as a prop instead of importing global stores
- Replace `$savedViews` with `$viewStore.savedViews`
- Replace `$recentViews` with `$viewStore.recentViews`
- Replace `viewActions.xxx()` with `viewStore.actions.xxx()`
- Remove global store imports

### SaveViewModal.svelte

Minimal changes required:
- Accept `viewStore: ViewStoreBundle` as a prop
- Replace `viewActions` calls with `viewStore.actions`

### Why prop-based instead of global stores?

svelte-table-views-tanstack uses module-level global stores — fine when one table exists per app. With PGLite + grid-scoped views, multiple grids need independent view stores. Passing the store bundle as a prop enables this.

## Peer Dependencies

```json
{
  "peerDependencies": {
    "svelte": "^4.0.0 || ^5.0.0",
    "@electric-sql/pglite": ">=0.2.0"
  }
}
```

Replaces `@tanstack/db: ^0.5.0` with `@electric-sql/pglite`.

## SSR Safety

PGLite is browser-only (WASM). The same guard pattern applies:

```typescript
export function initViewStore(db: PGliteWithLive, gridId: string): ViewStoreBundle {
  if (typeof window === 'undefined') {
    throw new Error('svelte-gridlite-views requires a browser environment');
  }
  // ...
}
```

Consuming pages should set `export const ssr = false;` or use `{#if browser}` guards.

## Testing Strategy

PGLite runs in-memory for tests — no mocking needed:

```typescript
import { PGlite } from '@electric-sql/pglite';
import { live } from '@electric-sql/pglite/live';

describe('view CRUD', () => {
  let db: PGliteWithLive;

  beforeEach(async () => {
    db = new PGlite({ extensions: { live } }) as PGliteWithLive;
    await runViewMigrations(db);
  });

  afterEach(async () => {
    await db.close();
  });

  it('saves and loads a view', async () => {
    const store = initViewStore(db, 'test-grid');
    await store.actions.save({ name: 'Test View', config: { ... } });
    const result = await db.query('SELECT * FROM _gridlite_views');
    expect(result.rows).toHaveLength(1);
  });
});
```

## Migration Path from svelte-table-views-tanstack

For apps switching from svelte-table-views-tanstack to svelte-gridlite-views:

1. **Data migration**: Read existing views from localStorage (key: `svelte-table-views-saved-views`), insert into PGLite `_gridlite_views` table
2. **API migration**: Replace `viewActions.xxx()` with `viewStore.actions.xxx()`
3. **Store migration**: Replace global store imports with prop-based `viewStore` bundle
4. **Dependency swap**: Remove `@tanstack/db`, add `@electric-sql/pglite`

## svelte-table-views-tanstack Continues Independently

- Stable at v0.1.7 for TanStack DB / TanStack Table use cases
- No deprecation needed
- Ideal for apps already in the TanStack ecosystem
