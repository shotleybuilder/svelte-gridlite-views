---
name: gridlite-views-store-api
description: "Complete ViewStoreBundle reference: initViewStore factory, all reactive stores, all CRUD actions with types and examples. Use when you need the full API surface."
user-invocable: true
---

# Gridlite Views Store API

## initViewStore

```typescript
import { initViewStore } from '@shotleybuilder/svelte-gridlite-views';

const viewStore = initViewStore(db, 'my-grid-id');
```

| Param | Type | Description |
|---|---|---|
| `db` | `PGliteWithLive` | PGLite instance with live extension |
| `gridId` | `string` | Unique identifier for this grid |

Returns a `ViewStoreBundle`. Throws if called on server (SSR).

Runs migrations automatically on first call. Multiple grids get independent stores.

## Reactive Stores

| Store | Type | Description |
|---|---|---|
| `savedViews` | `Readable<SavedView[]>` | All views for this grid, live query backed, sorted by name |
| `recentViews` | `Readable<SavedView[]>` | Views used in last 7 days, top 5, sorted by lastUsed desc |
| `activeViewId` | `Writable<string \| null>` | Currently selected view ID |
| `activeViewModified` | `Writable<boolean>` | Whether active view has unsaved changes |
| `activeView` | `Readable<SavedView \| null>` | Derived: full view object for activeViewId |
| `ready` | `Readable<boolean>` | True after migrations + live queries are set up |

```svelte
<script>
  const { savedViews, activeViewId, activeViewModified, activeView, ready } = viewStore;
</script>

{#if $ready}
  <p>{$savedViews.length} saved views</p>
  {#if $activeView}
    <p>Active: {$activeView.name} {$activeViewModified ? '(modified)' : ''}</p>
  {/if}
{/if}
```

## Actions

### save(input: SavedViewInput): Promise\<SavedView>

Create a new view. Returns the saved view with generated ID and timestamps.

```typescript
const view = await viewStore.actions.save({
  name: 'Engineering Team',
  description: 'Filtered to engineering department',
  config: currentConfig
});
// view.id is now set, savedViews store auto-updates via live query
```

### load(id: string): Promise\<SavedView | undefined>

Load a view: increments usageCount, updates lastUsed, sets activeViewId, clears activeViewModified.

```typescript
const view = await viewStore.actions.load(viewId);
if (view) {
  applyConfig(view.config); // Apply to your table
}
```

### update(id, updates): Promise\<void>

Update an existing view's name, description, config, or originalQuery. Clears activeViewModified.

```typescript
await viewStore.actions.update(viewId, {
  config: captureCurrentConfig()
});
```

### delete(id: string): Promise\<void>

Delete a view. Clears activeViewId if it was the deleted view. Column state cascades automatically.

```typescript
await viewStore.actions.delete(viewId);
```

### rename(id: string, newName: string): Promise\<void>

Rename a view.

```typescript
await viewStore.actions.rename(viewId, 'New Name');
```

### markModified(): void

Mark the active view as having unsaved changes. Call this when the user changes filters/sorting/columns.

```typescript
viewStore.actions.markModified();
```

### clearActive(): void

Clear the active view selection and modified state.

```typescript
viewStore.actions.clearActive();
```

### nameExists(name, excludeId?): Promise\<boolean>

Check if a view name already exists for this grid. Used for validation.

```typescript
const exists = await viewStore.actions.nameExists('My View');
const existsExcludingSelf = await viewStore.actions.nameExists('My View', currentViewId);
```

### getStorageStats(): Promise\<{ count, limit, percentFull }>

Get storage usage. Limit is 50 views per grid.

```typescript
const stats = await viewStore.actions.getStorageStats();
// { count: 12, limit: 50, percentFull: 24 }
```

### setDefaultView(id: string): Promise\<void>

Set a view as the default for this grid. Clears any existing default.

```typescript
await viewStore.actions.setDefaultView(viewId);
```

### loadDefaultView(): Promise\<SavedView | undefined>

Load the default view for this grid (if one is set). Sets activeViewId.

```typescript
const defaultView = await viewStore.actions.loadDefaultView();
if (defaultView) {
  applyConfig(defaultView.config);
}
```

### waitForReady(): Promise\<void>

Wait for migrations and live queries to complete. Resolves immediately if already ready.

```typescript
await viewStore.actions.waitForReady();
```

## Cleanup

```typescript
import { onDestroy } from 'svelte';

onDestroy(() => {
  viewStore.destroy(); // Unsubscribes live queries
});
```

## Validation Rules

- **View limit**: 50 per grid
- **Name max**: 100 characters
- **Description max**: 500 characters
- **Name uniqueness**: Enforced per grid_id
