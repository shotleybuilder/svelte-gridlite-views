---
name: gridlite-views-quick-start
description: "Minimal setup for svelte-gridlite-views: install, PGLite init, initViewStore, ViewSelector + SaveViewModal usage, SvelteKit config. Use when integrating saved views into a project."
user-invocable: true
---

# Gridlite Views Quick Start

## Install

```bash
npm install @shotleybuilder/svelte-gridlite-views @electric-sql/pglite
```

## SvelteKit Config

Disable SSR for pages using PGLite:

```typescript
// src/routes/+layout.ts (or +page.ts)
export const ssr = false;
```

Add to `vite.config.ts`:

```typescript
export default defineConfig({
  optimizeDeps: {
    exclude: ['@electric-sql/pglite']
  }
});
```

## Minimal Integration

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { PGlite } from '@electric-sql/pglite';
  import { live } from '@electric-sql/pglite/live';
  import {
    initViewStore,
    ViewSelector,
    SaveViewModal
  } from '@shotleybuilder/svelte-gridlite-views';
  import type { ViewStoreBundle, ViewConfig, SavedView } from '@shotleybuilder/svelte-gridlite-views';

  let viewStore: ViewStoreBundle | null = null;
  let ready = false;
  let showSaveModal = false;
  let capturedConfig: ViewConfig | null = null;

  onMount(async () => {
    // 1. Create or reuse a PGLite instance with live extension
    const db = new PGlite({ extensions: { live } });

    // 2. Initialize the view store for this grid
    viewStore = initViewStore(db as any, 'my-grid-id');
    await viewStore.actions.waitForReady();
    ready = true;
  });

  onDestroy(() => {
    viewStore?.destroy();
  });

  // 3. Capture current table state as a ViewConfig
  function captureCurrentConfig(): ViewConfig {
    return {
      filters: [],
      filterLogic: 'and',
      sorting: [],
      grouping: [],
      columnVisibility: {},
      columnOrder: ['name', 'email', 'status'],
      columnWidths: {},
      pageSize: 25
    };
  }

  function handleSaveView() {
    capturedConfig = captureCurrentConfig();
    showSaveModal = true;
  }

  function handleViewSelected(event: CustomEvent<{ view: SavedView }>) {
    const view = event.detail.view;
    // Apply view.config to your table state
    console.log('Loaded view:', view.name, view.config);
  }
</script>

{#if ready && viewStore}
  <ViewSelector {viewStore} on:viewSelected={handleViewSelected} />
  <button on:click={handleSaveView}>Save View</button>

  {#if showSaveModal && capturedConfig}
    <SaveViewModal
      {viewStore}
      bind:open={showSaveModal}
      config={capturedConfig}
      on:save={(e) => console.log('Saved:', e.detail.name)}
    />
  {/if}
{/if}
```

## With svelte-gridlite-kit (Shared PGLite)

```svelte
<script lang="ts">
  // The PGLite instance from svelte-gridlite-kit is reused —
  // no second database, no second persistence layer.
  import { GridLite } from '@shotleybuilder/svelte-gridlite-kit';
  import { initViewStore, ViewSelector } from '@shotleybuilder/svelte-gridlite-views';

  // Both libraries share the same db instance
  viewStore = initViewStore(db, 'my-grid-id');
</script>
```

## Common Mistakes

1. **Forgetting `ssr = false`** — PGLite needs browser APIs (WASM, IndexedDB)
2. **Missing `optimizeDeps.exclude`** — Vite tries to pre-bundle PGLite and fails
3. **Not waiting for `waitForReady()`** — Views aren't loaded until migrations complete
4. **Forgetting the `live` extension** — initViewStore requires `PGliteWithLive`
5. **Not calling `destroy()`** — Live query subscriptions leak if not cleaned up
