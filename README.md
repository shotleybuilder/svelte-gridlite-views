# svelte-gridlite-views

Save and restore table view configurations (filters, sorting, columns) with PGLite persistence. Built for Svelte 5 apps using [svelte-gridlite-kit](https://github.com/shotleybuilder/svelte-gridlite-kit). Features live queries, IndexedDB storage via PGLite, and grid-scoped view management.

## Status

**Beta.** Published to npm as `@shotleybuilder/svelte-gridlite-views`.

## Installation

```bash
npm install @shotleybuilder/svelte-gridlite-views @electric-sql/pglite
```

## Quick Start

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { PGlite } from '@electric-sql/pglite';
  import { live } from '@electric-sql/pglite/live';
  import { initViewStore, ViewSelector, SaveViewModal } from '@shotleybuilder/svelte-gridlite-views';
  import type { ViewStoreBundle, ViewConfig } from '@shotleybuilder/svelte-gridlite-views';

  let viewStore: ViewStoreBundle | null = null;
  let ready = false;
  let showSaveModal = false;
  let capturedConfig: ViewConfig | null = null;

  onMount(async () => {
    const db = new PGlite({ extensions: { live } });
    viewStore = initViewStore(db, 'my-grid-id');
    await viewStore.actions.waitForReady();
    ready = true;
  });

  onDestroy(() => viewStore?.destroy());
</script>

{#if ready && viewStore}
  <ViewSelector {viewStore} on:viewSelected={(e) => applyConfig(e.detail.view.config)} />
  <button on:click={() => { capturedConfig = captureConfig(); showSaveModal = true; }}>Save View</button>

  {#if showSaveModal && capturedConfig}
    <SaveViewModal {viewStore} bind:open={showSaveModal} config={capturedConfig} />
  {/if}
{/if}
```

> **SvelteKit note:** PGLite requires browser APIs (WebAssembly, IndexedDB). Disable SSR for pages that use it:
>
> ```typescript
> // +layout.ts or +page.ts
> export const ssr = false;
> ```
>
> Also add to your `vite.config.ts`:
>
> ```typescript
> optimizeDeps: {
>   exclude: ['@electric-sql/pglite']
> }
> ```

## Guides

Structured reference docs for every feature, designed to be both human-readable and AI-agent-friendly:

- **[Quick Start](.claude/skills/quick-start/SKILL.md)** — Install, PGLite init, initViewStore, ViewSelector + SaveViewModal
- **[Store API](.claude/skills/store-api/SKILL.md)** — Complete ViewStoreBundle reference: stores, actions, types
- **[Components](.claude/skills/components/SKILL.md)** — ViewSelector and SaveViewModal props, events, patterns
- **[View CRUD](.claude/skills/view-crud/SKILL.md)** — Save, load, update, delete, rename, default views
- **[Recipes](.claude/skills/recipes/SKILL.md)** — Integration with svelte-gridlite-kit, multiple grids, migration

## For AI Agents

This library includes structured skill files in `.claude/skills/` optimised for Claude Code and other AI coding assistants. Each skill file covers one topic with:

- Quick copy-paste examples
- Complete prop/type references
- Common patterns and troubleshooting

**To use in a consuming project:** Copy the relevant `.claude/skills/<topic>/SKILL.md` files into your project, or point your AI agent at this repository's `.claude/skills/` directory. See `CLAUDE.md` for additional architectural context and integration guidance.

## API Reference

### Components

| Component | Props | Events |
|---|---|---|
| `ViewSelector` | `viewStore: ViewStoreBundle` | `viewSelected`, `deleteView` |
| `ViewSidebar` | `viewStore`, `groups`, `isDocked`, `width`, `showSearch`, `showPinned` | `viewSelected`, `deleteView`, `pin`, `groupToggle` |
| `SaveViewModal` | `viewStore`, `open`, `config`, `originalQuery?` | `save` |

`ViewSelector` (dropdown) and `ViewSidebar` (persistent panel) are interchangeable — same `viewStore` prop, same `viewSelected` event.

### Store Factory

```typescript
initViewStore(db: PGliteWithLive, gridId: string): ViewStoreBundle
```

Returns grid-scoped reactive stores + CRUD actions. See [Store API guide](.claude/skills/store-api/SKILL.md).

### Database Functions

Low-level SQL functions for advanced use cases:

```typescript
runViewMigrations(db)          // Idempotent schema setup
saveView(db, gridId, input)    // INSERT
loadView(db, id)               // SELECT by ID
loadViews(db, gridId)          // SELECT all for grid
deleteView(db, id)             // DELETE with cascade
setDefaultView(db, gridId, id) // Set is_default flag
loadDefaultView(db, gridId)    // Load default view
```

### Types

```typescript
SavedView, SavedViewInput, ViewConfig, ViewStoreBundle, ViewActions,
FilterCondition, FilterLogic, SortConfig, GroupConfig, AggregationConfig, ViewRow, ViewGroup
```

## Architecture

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

### Key Design Decisions

- **No TanStack DB dependency.** PGLite is the sole persistence layer.
- **Consumer provides PGLite instance.** Avoids multiple databases. Shares the instance with svelte-gridlite-kit.
- **Grid-scoped views.** Each view belongs to a `grid_id`, enabling multiple independent grids.
- **Prop-based stores.** `initViewStore()` returns a `ViewStoreBundle` per grid, not global stores. Components receive it as a prop.
- **Live queries drive reactivity.** When a view is saved/deleted/updated, stores auto-update.
- **JSONB for complex config.** Filters, sorting, grouping, column state stored as JSONB — queryable and indexable.

### Relationship to svelte-gridlite-kit

Both libraries share a single PGLite instance. svelte-gridlite-kit provides the data grid; svelte-gridlite-views provides view persistence. Neither depends on the other at the package level, but they're designed to work together.

## Origin

Fork from [`svelte-table-views-tanstack`](https://github.com/shotleybuilder/svelte-table-views-tanstack) (v0.1.7), replacing TanStack DB with PGLite as the persistence layer. svelte-table-views-tanstack remains valuable for apps using TanStack DB/TanStack Table.

See [Architecture Plan](docs/architecture-plan.md) for the full rationale.

## Development

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (demo app)
npm run build        # Build library
npm run package      # Package for npm (svelte-package + publint)
npm run check        # Type checking
npm test             # Run tests
```

## License

MIT
