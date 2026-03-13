/**
 * Saved View Types for PGLite-backed Table Configuration Persistence
 *
 * Enables users to save table configurations (filters, sort, columns, etc.)
 * as named "views" scoped to a specific grid, stored in PGLite.
 */

import type { PGliteWithLive } from "@electric-sql/pglite/live";
import type { Readable, Writable } from "svelte/store";

// ─── Filter & Sort ────────────────────────────────────────────────

export interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: unknown;
}

export type FilterLogic = "and" | "or";

export interface SortConfig {
  column: string;
  direction: "asc" | "desc";
}

export interface GroupConfig {
  column: string;
  aggregations?: AggregationConfig[];
}

export interface AggregationConfig {
  column: string;
  function: "sum" | "avg" | "count" | "min" | "max";
}

// ─── View Config ──────────────────────────────────────────────────

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

// ─── Saved View ───────────────────────────────────────────────────

export interface SavedView {
  id: string;
  gridId: string;
  name: string;
  description?: string;
  config: ViewConfig;
  originalQuery?: string;
  isDefault: boolean;
  usageCount: number;
  lastUsed: string; // ISO timestamp
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export type SavedViewInput = Pick<SavedView, "name" | "config"> &
  Partial<Pick<SavedView, "description" | "originalQuery">>;

// ─── Database Row (snake_case from PGLite) ────────────────────────

export interface ViewRow {
  id: string;
  grid_id: string;
  name: string;
  description: string | null;
  filters: string; // JSONB as string
  filter_logic: string;
  sorting: string; // JSONB as string
  grouping: string; // JSONB as string
  column_visibility: string; // JSONB as string
  column_order: string; // JSONB as string
  column_widths: string; // JSONB as string
  page_size: number | null;
  original_query: string | null;
  is_default: boolean;
  usage_count: number;
  last_used: string;
  created_at: string;
  updated_at: string;
}

// ─── View Group (for sidebar) ─────────────────────────────────────

export interface ViewGroup {
  id: string;
  name: string;
  icon?: string;
  isCollapsed?: boolean;
  order?: number;
}

// ─── View Store Bundle ────────────────────────────────────────────

export interface ViewActions {
  save(input: SavedViewInput): Promise<SavedView>;
  load(id: string): Promise<SavedView | undefined>;
  update(
    id: string,
    updates: Partial<
      Pick<SavedView, "name" | "description" | "config" | "originalQuery">
    >,
  ): Promise<void>;
  delete(id: string): Promise<void>;
  rename(id: string, newName: string): Promise<void>;
  markModified(): void;
  clearActive(): void;
  nameExists(name: string, excludeId?: string): Promise<boolean>;
  getStorageStats(): Promise<{
    count: number;
    limit: number;
    percentFull: number;
  }>;
  setDefaultView(id: string): Promise<void>;
  loadDefaultView(): Promise<SavedView | undefined>;
  waitForReady(): Promise<void>;
}

export interface ViewStoreBundle {
  savedViews: Readable<SavedView[]>;
  recentViews: Readable<SavedView[]>;
  activeViewId: Writable<string | null>;
  activeViewModified: Writable<boolean>;
  activeView: Readable<SavedView | null>;
  ready: Readable<boolean>;
  actions: ViewActions;
  destroy: () => Promise<void>;
}
