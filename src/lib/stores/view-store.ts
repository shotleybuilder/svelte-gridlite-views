/**
 * View Store Factory
 *
 * Creates a grid-scoped bundle of Svelte stores and CRUD actions
 * backed by PGLite live queries. Each grid gets its own independent
 * store instance via initViewStore().
 */

import { writable, derived, get } from "svelte/store";
import type { Readable, Writable } from "svelte/store";
import type { PGliteWithLive } from "@electric-sql/pglite/live";
import type {
  SavedView,
  SavedViewInput,
  ViewRow,
  ViewStoreBundle,
  ViewActions,
  ViewGroup,
  ViewGroupRow,
  ViewGroupInput,
  GroupActions,
} from "../types.js";
import { rowToView } from "../db/views.js";
import * as viewDb from "../db/views.js";
import { rowToGroup } from "../db/groups.js";
import * as groupDb from "../db/groups.js";
import { runViewMigrations } from "../db/migrations.js";

const VIEW_LIMIT = 50;
const GROUP_LIMIT = 20;

/**
 * Initialize the view management system for a specific grid.
 * Consumer calls this once per grid instance with their PGLite instance.
 *
 * Returns a store bundle scoped to the given gridId.
 */
export function initViewStore(
  db: PGliteWithLive,
  gridId: string,
): ViewStoreBundle {
  if (typeof window === "undefined") {
    throw new Error("svelte-gridlite-views requires a browser environment");
  }

  // ─── Stores ───────────────────────────────────────────────────

  const savedViews = writable<SavedView[]>([]);
  const recentViews = writable<SavedView[]>([]);
  const savedGroups = writable<ViewGroup[]>([]);
  const activeViewId = writable<string | null>(null);
  const activeViewModified = writable<boolean>(false);
  const ready = writable<boolean>(false);

  const activeView: Readable<SavedView | null> = derived(
    [savedViews, activeViewId],
    ([$views, $id]) =>
      $id ? ($views.find((v) => v.id === $id) ?? null) : null,
  );

  // ─── Live query subscriptions ─────────────────────────────────

  let allViewsUnsubscribe: (() => void) | null = null;
  let recentViewsUnsubscribe: (() => void) | null = null;
  let groupsUnsubscribe: (() => void) | null = null;

  async function setupLiveQueries(): Promise<void> {
    // All views for this grid
    const allViewsResult = await db.live.query<ViewRow>(
      `SELECT * FROM _gridlite_views WHERE grid_id = $1 ORDER BY name`,
      [gridId],
      (results) => {
        savedViews.set(results.rows.map(rowToView));
      },
    );
    allViewsUnsubscribe = allViewsResult.unsubscribe;
    // Set initial data
    savedViews.set(allViewsResult.initialResults.rows.map(rowToView));

    // Recent views (last 7 days, top 5)
    const recentViewsResult = await db.live.query<ViewRow>(
      `SELECT * FROM _gridlite_views
			 WHERE grid_id = $1 AND last_used > NOW() - INTERVAL '7 days'
			 ORDER BY last_used DESC LIMIT 5`,
      [gridId],
      (results) => {
        recentViews.set(results.rows.map(rowToView));
      },
    );
    recentViewsUnsubscribe = recentViewsResult.unsubscribe;
    recentViews.set(recentViewsResult.initialResults.rows.map(rowToView));

    // All groups for this grid, ordered by sort_order
    const groupsResult = await db.live.query<ViewGroupRow>(
      `SELECT * FROM _gridlite_view_groups WHERE grid_id = $1 ORDER BY sort_order`,
      [gridId],
      (results) => {
        savedGroups.set(results.rows.map(rowToGroup));
      },
    );
    groupsUnsubscribe = groupsResult.unsubscribe;
    savedGroups.set(groupsResult.initialResults.rows.map(rowToGroup));
  }

  // ─── Initialization ───────────────────────────────────────────

  const initPromise = (async () => {
    try {
      await runViewMigrations(db);
      await setupLiveQueries();
      ready.set(true);
      console.log("[svelte-gridlite-views] Store ready for grid:", gridId);
    } catch (err) {
      console.error("[svelte-gridlite-views] Initialization failed:", err);
      ready.set(true); // Still mark ready so UI doesn't hang
    }
  })();

  // ─── Actions ──────────────────────────────────────────────────

  const actions: ViewActions = {
    async save(input: SavedViewInput): Promise<SavedView> {
      const view = await viewDb.saveView(db, gridId, input);
      console.log("[svelte-gridlite-views] Saved view:", view.name, view.id);
      return view;
    },

    async load(id: string): Promise<SavedView | undefined> {
      await viewDb.touchViewUsage(db, id);
      const view = await viewDb.loadView(db, id);

      if (view) {
        activeViewId.set(id);
        activeViewModified.set(false);
        console.log("[svelte-gridlite-views] Loaded view:", view.name);
      } else {
        console.warn("[svelte-gridlite-views] View not found:", id);
      }

      return view;
    },

    async update(id: string, updates): Promise<void> {
      await viewDb.updateView(db, id, updates);
      activeViewModified.set(false);
      console.log("[svelte-gridlite-views] Updated view:", id);
    },

    async delete(id: string): Promise<void> {
      await viewDb.deleteView(db, id);

      if (get(activeViewId) === id) {
        activeViewId.set(null);
        activeViewModified.set(false);
      }

      console.log("[svelte-gridlite-views] Deleted view:", id);
    },

    async rename(id: string, newName: string): Promise<void> {
      await viewDb.updateView(db, id, { name: newName });
      console.log("[svelte-gridlite-views] Renamed view:", id, "→", newName);
    },

    markModified(): void {
      activeViewModified.set(true);
    },

    clearActive(): void {
      activeViewId.set(null);
      activeViewModified.set(false);
    },

    async nameExists(name: string, excludeId?: string): Promise<boolean> {
      return viewDb.nameExists(db, gridId, name, excludeId);
    },

    async getStorageStats(): Promise<{
      count: number;
      limit: number;
      percentFull: number;
    }> {
      const count = await viewDb.getViewCount(db, gridId);
      return {
        count,
        limit: VIEW_LIMIT,
        percentFull: Math.round((count / VIEW_LIMIT) * 100),
      };
    },

    async setDefaultView(id: string): Promise<void> {
      await viewDb.setDefaultView(db, gridId, id);
      console.log("[svelte-gridlite-views] Set default view:", id);
    },

    async loadDefaultView(): Promise<SavedView | undefined> {
      const view = await viewDb.loadDefaultView(db, gridId);
      if (view) {
        activeViewId.set(view.id);
        activeViewModified.set(false);
      }
      return view;
    },

    async waitForReady(): Promise<void> {
      if (get(ready)) return;
      return new Promise((resolve) => {
        const unsubscribe = ready.subscribe((isReady) => {
          if (isReady) {
            unsubscribe();
            resolve();
          }
        });
      });
    },
  };

  // ─── Group Actions ───────────────────────────────────────────

  const groupActions: GroupActions = {
    async createGroup(input: ViewGroupInput): Promise<ViewGroup> {
      const count = await groupDb.getGroupCount(db, gridId);
      if (count >= GROUP_LIMIT) {
        throw new Error(`Group limit reached (${GROUP_LIMIT} groups per grid)`);
      }
      if (!input.name.trim()) {
        throw new Error("Group name is required");
      }
      if (input.name.length > 100) {
        throw new Error("Group name must be 100 characters or less");
      }
      const group = await groupDb.createGroup(db, gridId, input);
      console.log(
        "[svelte-gridlite-views] Created group:",
        group.name,
        group.id,
      );
      return group;
    },

    async renameGroup(id: string, newName: string): Promise<void> {
      if (!newName.trim()) throw new Error("Group name is required");
      if (newName.length > 100)
        throw new Error("Group name must be 100 characters or less");
      await groupDb.renameGroup(db, id, newName);
      console.log("[svelte-gridlite-views] Renamed group:", id, "→", newName);
    },

    async updateGroupIcon(id: string, icon: string | null): Promise<void> {
      await groupDb.updateGroupIcon(db, id, icon);
    },

    async deleteGroup(id: string): Promise<void> {
      // FK ON DELETE SET NULL handles ungrouping views
      await groupDb.deleteGroup(db, id);
      console.log("[svelte-gridlite-views] Deleted group:", id);
    },

    async reorderGroups(orderedIds: string[]): Promise<void> {
      await groupDb.reorderGroups(db, orderedIds);
      console.log("[svelte-gridlite-views] Reordered groups");
    },

    async moveViewToGroup(
      viewId: string,
      groupId: string | null,
    ): Promise<void> {
      await groupDb.moveViewToGroup(db, viewId, groupId);
      console.log(
        "[svelte-gridlite-views] Moved view",
        viewId,
        "to group",
        groupId ?? "(ungrouped)",
      );
    },

    async groupNameExists(name: string, excludeId?: string): Promise<boolean> {
      return groupDb.groupNameExists(db, gridId, name, excludeId);
    },
  };

  // ─── Cleanup ──────────────────────────────────────────────────

  async function destroy(): Promise<void> {
    allViewsUnsubscribe?.();
    recentViewsUnsubscribe?.();
    groupsUnsubscribe?.();
    console.log("[svelte-gridlite-views] Store destroyed for grid:", gridId);
  }

  return {
    savedViews,
    recentViews,
    savedGroups,
    activeViewId,
    activeViewModified,
    activeView,
    ready,
    actions,
    groupActions,
    destroy,
  };
}
