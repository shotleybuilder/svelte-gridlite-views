---
name: gridlite-views-crud
description: "View lifecycle: save, load, update, delete, rename, duplicate, default views, storage stats, modified state tracking. Use when implementing view management logic."
user-invocable: true
---

# Gridlite Views CRUD & Lifecycle

## View Lifecycle

```
Save → Load → Modify table → Update (or Save New) → Delete
```

Each action auto-updates the live query-backed stores. No manual `refresh()` needed.

## Save a New View

```typescript
const view = await viewStore.actions.save({
  name: 'High-value cases',
  description: 'Cases with fines over 25k',
  config: {
    filters: [{ id: 'f1', field: 'fine_amount', operator: 'greater_than', value: 25000 }],
    filterLogic: 'and',
    sorting: [{ column: 'date', direction: 'desc' }],
    grouping: [],
    columnVisibility: { id: true, type: true, date: true, fine_amount: true },
    columnOrder: ['type', 'date', 'fine_amount', 'organization'],
    columnWidths: { organization: 250 },
    pageSize: 25
  }
});
// view.id = crypto.randomUUID()
// view.createdAt, updatedAt, lastUsed = now
// view.usageCount = 0, view.isDefault = false
// savedViews store auto-updates
```

## Load a View

```typescript
const view = await viewStore.actions.load(viewId);
if (view) {
  // view.usageCount incremented
  // view.lastUsed updated
  // activeViewId set to view.id
  // activeViewModified set to false
  applyConfigToTable(view.config);
}
```

## Track Modifications

When the user changes filters, sorting, or columns after loading a view:

```typescript
// Call whenever the table state changes
viewStore.actions.markModified();
// $activeViewModified is now true
```

## Update an Existing View

```typescript
await viewStore.actions.update(viewId, {
  config: captureCurrentConfig()
});
// activeViewModified automatically set to false
```

You can update individual fields:

```typescript
await viewStore.actions.update(viewId, { description: 'Updated description' });
await viewStore.actions.update(viewId, { name: 'Renamed View' });
```

## Delete a View

```typescript
await viewStore.actions.delete(viewId);
// If this was the active view, activeViewId and activeViewModified are cleared
// Column state cascades automatically (ON DELETE CASCADE)
```

## Rename a View

```typescript
await viewStore.actions.rename(viewId, 'New Name');
```

## Duplicate a View

The duplicate pattern uses `nameExists` to generate a unique name:

```typescript
let duplicateName = `${view.name} (Copy)`;
let counter = 2;
while (await viewStore.actions.nameExists(duplicateName)) {
  duplicateName = `${view.name} (Copy ${counter})`;
  counter++;
}

await viewStore.actions.save({
  name: duplicateName,
  description: view.description,
  config: view.config,
  originalQuery: view.originalQuery
});
```

## Default View

Set a view as the default for this grid:

```typescript
await viewStore.actions.setDefaultView(viewId);
// Clears any existing default, sets is_default = true
```

Load the default view on mount:

```typescript
onMount(async () => {
  viewStore = initViewStore(db, 'my-grid');
  await viewStore.actions.waitForReady();

  const defaultView = await viewStore.actions.loadDefaultView();
  if (defaultView) {
    applyConfigToTable(defaultView.config);
  }
});
```

## Storage Stats

```typescript
const stats = await viewStore.actions.getStorageStats();
// { count: 12, limit: 50, percentFull: 24 }

if (stats.count >= stats.limit) {
  alert('View limit reached. Delete unused views.');
}
```

## Clear Active View

```typescript
viewStore.actions.clearActive();
// activeViewId = null, activeViewModified = false
```

## Name Uniqueness Check

```typescript
const exists = await viewStore.actions.nameExists('My View');

// When renaming, exclude the current view from the check:
const exists = await viewStore.actions.nameExists('New Name', currentViewId);
```

## SavedView Object Shape

```typescript
interface SavedView {
  id: string;              // UUID
  gridId: string;          // Grid this view belongs to
  name: string;
  description?: string;
  config: ViewConfig;      // Filters, sorting, columns, etc.
  originalQuery?: string;  // Optional NL query reference
  isDefault: boolean;
  usageCount: number;
  lastUsed: string;        // ISO timestamp
  createdAt: string;       // ISO timestamp
  updatedAt: string;       // ISO timestamp
}
```
