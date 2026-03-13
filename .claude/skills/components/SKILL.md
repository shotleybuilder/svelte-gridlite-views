---
name: gridlite-views-components
description: "ViewSelector and SaveViewModal component reference: props, events, keyboard shortcuts, Update vs Save New pattern. Use when integrating view UI components."
user-invocable: true
---

# Gridlite Views Components

## ViewSelector

Dropdown for browsing, selecting, renaming, duplicating, and deleting saved views.

### Props

| Prop | Type | Description |
|---|---|---|
| `viewStore` | `ViewStoreBundle` | Required. Store bundle from `initViewStore()` |

### Events

| Event | Detail | Description |
|---|---|---|
| `viewSelected` | `{ view: SavedView }` | Fired when user selects a view |
| `deleteView` | `{ id: string }` | Fired after a view is deleted |

### Usage

```svelte
<ViewSelector
  {viewStore}
  on:viewSelected={(e) => applyConfig(e.detail.view.config)}
  on:deleteView={(e) => console.log('Deleted:', e.detail.id)}
/>
```

### Features

- **Search**: Type-ahead filter over view names
- **Recent views**: Top 5 views used in last 7 days
- **All views**: Alphabetically sorted, with filter/usage count
- **Keyboard navigation**: Arrow Up/Down, Enter to select, Escape to close
- **Inline rename**: Click pencil icon, Enter to confirm, Escape to cancel
- **Duplicate**: Creates "(Copy)" with unique name
- **Delete**: Confirmation dialog before deletion
- **Active view indicator**: Highlighted with indigo background
- **Modified indicator**: Asterisk shown when active view has unsaved changes

### Trigger Button Display

- No active view: Shows "Saved Views"
- Active view: Shows view name in bold
- Modified: Shows asterisk (*) next to name

---

## SaveViewModal

Modal dialog for saving a new view with name, description, and config summary.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `viewStore` | `ViewStoreBundle` | required | Store bundle from `initViewStore()` |
| `open` | `boolean` | `false` | Controls modal visibility (bindable) |
| `config` | `ViewConfig` | required | The view configuration to save |
| `originalQuery` | `string \| undefined` | `undefined` | Optional NL query for reference |

### Events

| Event | Detail | Description |
|---|---|---|
| `save` | `{ id: string; name: string }` | Fired after successful save |

### Usage

```svelte
<script>
  let showSaveModal = false;
  let capturedConfig: ViewConfig | null = null;

  function openSaveModal() {
    capturedConfig = captureCurrentConfig();
    showSaveModal = true;
  }
</script>

<button on:click={openSaveModal}>Save View</button>

{#if showSaveModal && capturedConfig}
  <SaveViewModal
    {viewStore}
    bind:open={showSaveModal}
    config={capturedConfig}
    on:save={(e) => console.log('Saved:', e.detail.name)}
  />
{/if}
```

### Validation

- Name is required, max 100 characters
- Description is optional, max 500 characters
- Duplicate name check (per grid)
- Storage limit check (50 views)

### Keyboard Shortcuts

- `Escape` — Cancel and close
- `Ctrl+Enter` — Save

### Config Summary

The modal displays what's being saved: active filter count, sort rules, visible column count, column widths and page size.

---

## Update vs Save New Pattern

When a user modifies an active view, show a split button:

```svelte
<script>
  $: activeViewId = viewStore.activeViewId;
  $: activeViewModified = viewStore.activeViewModified;
</script>

{#if $activeViewId && $activeViewModified}
  <!-- Split button: Update existing | Save as new -->
  <button on:click={handleUpdateView}>Update View</button>
  <button on:click={handleSaveNew}>Save New</button>
{:else}
  <button on:click={handleSaveNew}>Save View</button>
{/if}
```

```typescript
async function handleUpdateView() {
  const id = get(viewStore.activeViewId);
  if (!id) return;
  await viewStore.actions.update(id, { config: captureCurrentConfig() });
}

function handleSaveNew() {
  capturedConfig = captureCurrentConfig();
  showSaveModal = true;
}
```

---

## ViewSidebar

Persistent always-visible panel for browsing and managing saved views. Alternative to ViewSelector — same `viewStore` prop, same `viewSelected` event. Use one or both.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `viewStore` | `ViewStoreBundle` | required | Store bundle from `initViewStore()` |
| `groups` | `ViewGroup[]` | `[]` | Optional grouping for views |
| `storageKey` | `string` | `'view-sidebar-state'` | localStorage key for sidebar UI state |
| `isDocked` | `boolean` | `true` | Show/hide the sidebar |
| `width` | `number` | `260` | Sidebar width in pixels |
| `showSearch` | `boolean` | `true` | Toggle search input |
| `showPinned` | `boolean` | `true` | Toggle pinned views section |
| `searchPlaceholder` | `string` | `'Search views...'` | Search input placeholder |

### Events

| Event | Detail | Description |
|---|---|---|
| `viewSelected` | `{ view: SavedView }` | Fired when user selects a view (matches ViewSelector) |
| `deleteView` | `{ id: string }` | Fired after a view is deleted (matches ViewSelector) |
| `pin` | `{ view: SavedView, isPinned: boolean }` | Fired when view is pinned/unpinned |
| `groupToggle` | `{ group: ViewGroup, isCollapsed: boolean }` | Fired when group is collapsed/expanded |

### Usage

```svelte
<script>
  import { ViewSidebar } from '@shotleybuilder/svelte-gridlite-views';
  import type { ViewGroup } from '@shotleybuilder/svelte-gridlite-views';

  const groups: ViewGroup[] = [];  // flat list, or define groups
  let showSidebar = true;
</script>

<div style="display: flex; height: 100vh;">
  <ViewSidebar
    {viewStore}
    {groups}
    isDocked={showSidebar}
    on:viewSelected={(e) => applyConfig(e.detail.view.config)}
  />
  <main style="flex: 1;">
    <!-- table content -->
  </main>
</div>
```

### ViewGroup Type

```typescript
interface ViewGroup {
  id: string;
  name: string;
  icon?: string;
  isCollapsed?: boolean;
  order?: number;
}
```

### Features

- **Search**: Filter views by name and description
- **Pinned views**: Pin frequently used views to the top (persisted to localStorage)
- **Collapsible groups**: Organize views into named groups with counts
- **Inline rename**: Click pencil icon, Enter to confirm, Escape to cancel
- **Set default**: Star icon to mark a view as default
- **Delete**: Trash icon with confirmation dialog
- **Active view highlighting**: Selected view shown in blue
- **Modified indicator**: Asterisk (*) when active view has unsaved changes
- **Storage stats**: Shows X/50 views in header
- **CSS custom properties**: Full theming support (--sidebar-bg, --sidebar-border, etc.)

### CSS Custom Properties

```css
--sidebar-bg, --sidebar-border, --sidebar-font,
--input-border, --input-bg, --focus-color, --focus-ring,
--text-primary, --text-secondary, --text-muted,
--hover-bg, --selected-bg, --selected-text,
--pin-color, --badge-bg, --badge-text, --modified-color,
--delete-color, --confirm-color,
--scrollbar-thumb, --scrollbar-thumb-hover
```

---

## ViewConfig Type

What gets saved with each view:

```typescript
interface ViewConfig {
  filters: FilterCondition[];
  filterLogic: 'and' | 'or';
  sorting: SortConfig[];
  grouping: GroupConfig[];
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  columnWidths: Record<string, number>;
  pageSize?: number;
}
```
