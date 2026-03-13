/**
 * @package @shotleybuilder/svelte-gridlite-views
 * @description Save and restore table view configurations with PGLite persistence
 * @author Jason (Shotley Builder)
 * @license MIT
 */

// Components
export { default as SaveViewModal } from "./components/SaveViewModal.svelte";
export { default as ViewSelector } from "./components/ViewSelector.svelte";
export { default as ViewSidebar } from "./components/ViewSidebar.svelte";

// Store Factory
export { initViewStore } from "./stores/view-store.js";

// Database
export { runViewMigrations } from "./db/migrations.js";
export {
  saveView,
  loadView,
  loadViews,
  deleteView,
  loadDefaultView,
  setDefaultView,
} from "./db/views.js";
export {
  createGroup,
  renameGroup,
  deleteGroup,
  reorderGroups,
  moveViewToGroup,
} from "./db/groups.js";

// Types
export type {
  SavedView,
  SavedViewInput,
  ViewConfig,
  ViewStoreBundle,
  ViewActions,
  FilterCondition,
  FilterLogic,
  SortConfig,
  GroupConfig,
  AggregationConfig,
  ViewRow,
  ViewGroup,
  ViewGroupRow,
  ViewGroupInput,
  GroupActions,
} from "./types.js";
