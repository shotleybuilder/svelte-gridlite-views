/**
 * PGLite Schema Migrations for svelte-gridlite-views
 *
 * Creates and extends the _gridlite_views and _gridlite_column_state tables.
 * Designed to be idempotent — safe to run multiple times.
 *
 * If used alongside svelte-gridlite-kit (which creates the base tables),
 * these migrations add the extra columns needed for view management.
 * If used standalone, they create the full schema from scratch.
 */

import type { PGliteWithLive } from "@electric-sql/pglite/live";

/**
 * Run all view-related migrations.
 * Safe to call multiple times — uses IF NOT EXISTS throughout.
 */
export async function runViewMigrations(db: PGliteWithLive): Promise<void> {
  // Base table creation (idempotent — skipped if svelte-gridlite-kit already created it)
  await db.query(`
		CREATE TABLE IF NOT EXISTS _gridlite_views (
			id TEXT PRIMARY KEY,
			grid_id TEXT NOT NULL,
			name TEXT NOT NULL,
			description TEXT,
			filters JSONB DEFAULT '[]',
			filter_logic TEXT DEFAULT 'and',
			sorting JSONB DEFAULT '[]',
			grouping JSONB DEFAULT '[]',
			column_visibility JSONB DEFAULT '{}',
			column_order JSONB DEFAULT '[]',
			column_widths JSONB DEFAULT '{}',
			page_size INTEGER,
			original_query TEXT,
			is_default BOOLEAN DEFAULT FALSE,
			usage_count INTEGER DEFAULT 0,
			last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`);

  // View groups table for sidebar group management
  await db.query(`
		CREATE TABLE IF NOT EXISTS _gridlite_view_groups (
			id TEXT PRIMARY KEY,
			grid_id TEXT NOT NULL,
			name TEXT NOT NULL,
			icon TEXT,
			sort_order INTEGER DEFAULT 0,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(grid_id, name)
		)
	`);

  // Column state table for granular column persistence per view
  await db.query(`
		CREATE TABLE IF NOT EXISTS _gridlite_column_state (
			id TEXT PRIMARY KEY,
			view_id TEXT NOT NULL REFERENCES _gridlite_views(id) ON DELETE CASCADE,
			column_id TEXT NOT NULL,
			visible BOOLEAN DEFAULT TRUE,
			width INTEGER,
			position INTEGER,
			UNIQUE(view_id, column_id)
		)
	`);

  // Indexes
  await db.query(`
		CREATE INDEX IF NOT EXISTS idx_gridlite_views_grid_id
			ON _gridlite_views (grid_id)
	`);

  await db.query(`
		CREATE INDEX IF NOT EXISTS idx_gridlite_views_last_used
			ON _gridlite_views (last_used DESC)
	`);

  await db.query(`
		CREATE INDEX IF NOT EXISTS idx_gridlite_views_grid_name
			ON _gridlite_views (grid_id, name)
	`);

  await db.query(`
		CREATE INDEX IF NOT EXISTS idx_gridlite_column_state_view_id
			ON _gridlite_column_state (view_id)
	`);

  await db.query(`
		CREATE INDEX IF NOT EXISTS idx_gridlite_view_groups_grid_id
			ON _gridlite_view_groups (grid_id)
	`);

  // Extend tables if created by svelte-gridlite-kit (which may not have all columns)
  // Each ADD COLUMN is wrapped in a DO block to handle "column already exists" gracefully
  const extensionColumns = [
    { column: "usage_count", type: "INTEGER DEFAULT 0" },
    { column: "last_used", type: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP" },
    { column: "original_query", type: "TEXT" },
    { column: "column_widths", type: "JSONB DEFAULT '{}'" },
    { column: "page_size", type: "INTEGER" },
    { column: "is_default", type: "BOOLEAN DEFAULT FALSE" },
    { column: "group_id", type: "TEXT" },
  ];

  for (const { column, type } of extensionColumns) {
    await db.query(`
			DO $$
			BEGIN
				ALTER TABLE _gridlite_views ADD COLUMN ${column} ${type};
			EXCEPTION
				WHEN duplicate_column THEN NULL;
			END $$
		`);
  }

  // Add foreign key from views.group_id -> view_groups.id (SET NULL on delete)
  await db.query(`
		DO $$
		BEGIN
			ALTER TABLE _gridlite_views
				ADD CONSTRAINT fk_gridlite_views_group_id
				FOREIGN KEY (group_id) REFERENCES _gridlite_view_groups(id)
				ON DELETE SET NULL;
		EXCEPTION
			WHEN duplicate_object THEN NULL;
		END $$
	`);

  await db.query(`
		CREATE INDEX IF NOT EXISTS idx_gridlite_views_group_id
			ON _gridlite_views (group_id)
	`);

  console.log("[svelte-gridlite-views] Migrations complete");
}
