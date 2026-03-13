---
name: gridlite-views-recipes
description: "Common integration patterns: svelte-gridlite-kit integration, multiple grids, default view auto-load, migration from svelte-table-views-tanstack, low-level SQL access."
user-invocable: true
---

# Gridlite Views Recipes

## Integration with svelte-gridlite-kit

Both libraries share a single PGLite instance. Map GridLite's `onStateChange` to a ViewConfig for saving:

```svelte
<script lang="ts">
  import { GridLite } from '@shotleybuilder/svelte-gridlite-kit';
  import { initViewStore, ViewSelector, SaveViewModal } from '@shotleybuilder/svelte-gridlite-views';
  import type { ViewConfig, SavedView } from '@shotleybuilder/svelte-gridlite-views';

  let viewStore = initViewStore(db, 'employees-grid');
  let showSaveModal = false;
  let capturedConfig: ViewConfig | null = null;

  // Map GridLite state to ViewConfig
  function captureConfig(gridState: any): ViewConfig {
    return {
      filters: gridState.filters ?? [],
      filterLogic: gridState.filterLogic ?? 'and',
      sorting: gridState.sorting ?? [],
      grouping: gridState.grouping ?? [],
      columnVisibility: gridState.columnVisibility ?? {},
      columnOrder: gridState.columnOrder ?? [],
      columnWidths: gridState.columnSizing ?? {},
      pageSize: gridState.pagination?.pageSize
    };
  }

  function handleViewSelected(e: CustomEvent<{ view: SavedView }>) {
    const cfg = e.detail.view.config;
    grid.setFilters(cfg.filters, cfg.filterLogic);
    grid.setSorting(cfg.sorting);
    grid.setGrouping(cfg.grouping);
  }

  let grid: GridLite;
</script>

<ViewSelector {viewStore} on:viewSelected={handleViewSelected} />

<GridLite
  bind:this={grid}
  {db}
  table="employees"
  onStateChange={(state) => viewStore.actions.markModified()}
  features={{ filtering: true, sorting: true, grouping: true }}
/>
```

## Multiple Grids with Independent View Stores

Each grid gets its own store scoped by `gridId`:

```typescript
const employeeViews = initViewStore(db, 'employees');
const productViews = initViewStore(db, 'products');

// Views are completely independent — no cross-contamination
// Each has its own savedViews, activeViewId, etc.
```

Clean up both on destroy:

```typescript
onDestroy(() => {
  employeeViews.destroy();
  productViews.destroy();
});
```

## Default View Auto-Load on Mount

```typescript
onMount(async () => {
  const db = new PGlite({ extensions: { live } });
  viewStore = initViewStore(db as any, 'my-grid');
  await viewStore.actions.waitForReady();

  // Auto-load default view if one exists
  const defaultView = await viewStore.actions.loadDefaultView();
  if (defaultView) {
    applyConfigToTable(defaultView.config);
    console.log('Loaded default view:', defaultView.name);
  }
});
```

## Persistent Database (IndexedDB)

Views survive page refreshes when using a persistent PGLite instance:

```typescript
// Ephemeral (in-memory, views lost on refresh)
const db = new PGlite({ extensions: { live } });

// Persistent (IndexedDB, views survive refresh)
const db = new PGlite('idb://my-app', { extensions: { live } });
```

## Migration from svelte-table-views-tanstack

Read existing views from localStorage and insert into PGLite:

```typescript
import { initViewStore } from '@shotleybuilder/svelte-gridlite-views';

async function migrateViews(db: PGliteWithLive, gridId: string) {
  const store = initViewStore(db, gridId);
  await store.actions.waitForReady();

  // Read old views from localStorage
  const raw = localStorage.getItem('svelte-table-views-saved-views');
  if (!raw) return;

  const oldViews = JSON.parse(raw);
  for (const old of oldViews) {
    await store.actions.save({
      name: old.name,
      description: old.description,
      config: {
        filters: old.config.filters ?? [],
        filterLogic: 'and',
        sorting: old.config.sort ? [{ column: old.config.sort.columnId, direction: old.config.sort.direction }] : [],
        grouping: old.config.grouping?.map((g: string) => ({ column: g })) ?? [],
        columnVisibility: Object.fromEntries(old.config.columns.map((c: string) => [c, true])),
        columnOrder: old.config.columnOrder ?? [],
        columnWidths: old.config.columnWidths ?? {},
        pageSize: old.config.pageSize
      }
    });
  }

  // Clean up old storage
  localStorage.removeItem('svelte-table-views-saved-views');
}
```

### Key API changes

| svelte-table-views-tanstack | svelte-gridlite-views |
|---|---|
| `import { viewActions } from '...'` | `viewStore.actions` (from prop) |
| `import { savedViews } from '...'` | `viewStore.savedViews` (from prop) |
| `viewActions.save(input)` | `viewStore.actions.save(input)` |
| Global stores | Grid-scoped `ViewStoreBundle` |
| `TableConfig` type | `ViewConfig` type |
| `config.sort: SortConfig \| null` | `config.sorting: SortConfig[]` |
| `config.columns: string[]` | `config.columnVisibility: Record<string, boolean>` |
| `savedViewsReady` store | `viewStore.ready` store |

## Low-Level SQL Access

For advanced use cases, use the database functions directly:

```typescript
import { saveView, loadViews, deleteView } from '@shotleybuilder/svelte-gridlite-views';

// Direct SQL operations (bypasses store reactivity)
const views = await loadViews(db, 'my-grid');
await deleteView(db, viewId);
```

Note: Direct SQL calls won't trigger the live query callbacks. Use `viewStore.actions` for reactive updates.

## Cleanup Pattern

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';

  let viewStore: ViewStoreBundle | null = null;

  onMount(async () => {
    viewStore = initViewStore(db, 'my-grid');
    await viewStore.actions.waitForReady();
  });

  onDestroy(() => {
    viewStore?.destroy(); // Unsubscribes live queries
  });
</script>
```
