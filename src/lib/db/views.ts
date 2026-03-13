/**
 * Raw SQL CRUD functions for _gridlite_views
 *
 * These operate directly on PGLite. The store layer (view-store.ts) wraps
 * these with reactive Svelte store updates.
 */

import type { PGliteWithLive } from '@electric-sql/pglite/live'
import type { SavedView, SavedViewInput, ViewRow } from '../types.js'

// ─── Row ↔ Domain mapping ─────────────────────────────────────────

export function rowToView(row: ViewRow): SavedView {
	return {
		id: row.id,
		gridId: row.grid_id,
		name: row.name,
		description: row.description ?? undefined,
		config: {
			filters: typeof row.filters === 'string' ? JSON.parse(row.filters) : row.filters,
			filterLogic: (row.filter_logic as 'and' | 'or') ?? 'and',
			sorting: typeof row.sorting === 'string' ? JSON.parse(row.sorting) : row.sorting,
			grouping: typeof row.grouping === 'string' ? JSON.parse(row.grouping) : row.grouping,
			columnVisibility: typeof row.column_visibility === 'string' ? JSON.parse(row.column_visibility) : row.column_visibility,
			columnOrder: typeof row.column_order === 'string' ? JSON.parse(row.column_order) : row.column_order,
			columnWidths: typeof row.column_widths === 'string' ? JSON.parse(row.column_widths) : row.column_widths,
			pageSize: row.page_size ?? undefined
		},
		originalQuery: row.original_query ?? undefined,
		isDefault: row.is_default ?? false,
		usageCount: row.usage_count ?? 0,
		lastUsed: row.last_used,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	}
}

// ─── CRUD ─────────────────────────────────────────────────────────

export async function saveView(
	db: PGliteWithLive,
	gridId: string,
	input: SavedViewInput
): Promise<SavedView> {
	const id = crypto.randomUUID()
	const now = new Date().toISOString()

	await db.query(
		`INSERT INTO _gridlite_views
			(id, grid_id, name, description, filters, filter_logic, sorting,
			 grouping, column_visibility, column_order, column_widths, page_size,
			 original_query, is_default, usage_count, last_used, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, FALSE, 0, $14, $14, $14)`,
		[
			id,
			gridId,
			input.name,
			input.description ?? null,
			JSON.stringify(input.config.filters),
			input.config.filterLogic ?? 'and',
			JSON.stringify(input.config.sorting ?? []),
			JSON.stringify(input.config.grouping ?? []),
			JSON.stringify(input.config.columnVisibility ?? {}),
			JSON.stringify(input.config.columnOrder ?? []),
			JSON.stringify(input.config.columnWidths ?? {}),
			input.config.pageSize ?? null,
			input.originalQuery ?? null,
			now
		]
	)

	const result = await db.query<ViewRow>(
		`SELECT * FROM _gridlite_views WHERE id = $1`,
		[id]
	)

	return rowToView(result.rows[0])
}

export async function loadView(
	db: PGliteWithLive,
	id: string
): Promise<SavedView | undefined> {
	const result = await db.query<ViewRow>(
		`SELECT * FROM _gridlite_views WHERE id = $1`,
		[id]
	)

	if (result.rows.length === 0) return undefined
	return rowToView(result.rows[0])
}

export async function loadViews(
	db: PGliteWithLive,
	gridId: string
): Promise<SavedView[]> {
	const result = await db.query<ViewRow>(
		`SELECT * FROM _gridlite_views WHERE grid_id = $1 ORDER BY name`,
		[gridId]
	)

	return result.rows.map(rowToView)
}

export async function updateView(
	db: PGliteWithLive,
	id: string,
	updates: Partial<Pick<SavedView, 'name' | 'description' | 'config' | 'originalQuery'>>
): Promise<void> {
	const setClauses: string[] = []
	const params: unknown[] = []
	let paramIndex = 1

	if (updates.name !== undefined) {
		setClauses.push(`name = $${paramIndex++}`)
		params.push(updates.name)
	}
	if (updates.description !== undefined) {
		setClauses.push(`description = $${paramIndex++}`)
		params.push(updates.description)
	}
	if (updates.originalQuery !== undefined) {
		setClauses.push(`original_query = $${paramIndex++}`)
		params.push(updates.originalQuery)
	}
	if (updates.config !== undefined) {
		setClauses.push(`filters = $${paramIndex++}`)
		params.push(JSON.stringify(updates.config.filters))
		setClauses.push(`filter_logic = $${paramIndex++}`)
		params.push(updates.config.filterLogic ?? 'and')
		setClauses.push(`sorting = $${paramIndex++}`)
		params.push(JSON.stringify(updates.config.sorting ?? []))
		setClauses.push(`grouping = $${paramIndex++}`)
		params.push(JSON.stringify(updates.config.grouping ?? []))
		setClauses.push(`column_visibility = $${paramIndex++}`)
		params.push(JSON.stringify(updates.config.columnVisibility ?? {}))
		setClauses.push(`column_order = $${paramIndex++}`)
		params.push(JSON.stringify(updates.config.columnOrder ?? []))
		setClauses.push(`column_widths = $${paramIndex++}`)
		params.push(JSON.stringify(updates.config.columnWidths ?? {}))
		setClauses.push(`page_size = $${paramIndex++}`)
		params.push(updates.config.pageSize ?? null)
	}

	if (setClauses.length === 0) return

	setClauses.push(`updated_at = CURRENT_TIMESTAMP`)
	params.push(id)

	await db.query(
		`UPDATE _gridlite_views SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
		params
	)
}

export async function deleteView(
	db: PGliteWithLive,
	id: string
): Promise<void> {
	// Column state cascades via ON DELETE CASCADE
	await db.query(`DELETE FROM _gridlite_views WHERE id = $1`, [id])
}

export async function touchViewUsage(
	db: PGliteWithLive,
	id: string
): Promise<void> {
	await db.query(
		`UPDATE _gridlite_views
		 SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
		 WHERE id = $1`,
		[id]
	)
}

export async function setDefaultView(
	db: PGliteWithLive,
	gridId: string,
	viewId: string
): Promise<void> {
	// Clear existing default for this grid, then set the new one
	await db.query(
		`UPDATE _gridlite_views SET is_default = FALSE WHERE grid_id = $1 AND is_default = TRUE`,
		[gridId]
	)
	await db.query(
		`UPDATE _gridlite_views SET is_default = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
		[viewId]
	)
}

export async function loadDefaultView(
	db: PGliteWithLive,
	gridId: string
): Promise<SavedView | undefined> {
	const result = await db.query<ViewRow>(
		`SELECT * FROM _gridlite_views WHERE grid_id = $1 AND is_default = TRUE LIMIT 1`,
		[gridId]
	)

	if (result.rows.length === 0) return undefined
	return rowToView(result.rows[0])
}

export async function nameExists(
	db: PGliteWithLive,
	gridId: string,
	name: string,
	excludeId?: string
): Promise<boolean> {
	const result = excludeId
		? await db.query(
				`SELECT 1 FROM _gridlite_views WHERE grid_id = $1 AND name = $2 AND id != $3 LIMIT 1`,
				[gridId, name, excludeId]
			)
		: await db.query(
				`SELECT 1 FROM _gridlite_views WHERE grid_id = $1 AND name = $2 LIMIT 1`,
				[gridId, name]
			)

	return result.rows.length > 0
}

export async function getViewCount(
	db: PGliteWithLive,
	gridId: string
): Promise<number> {
	const result = await db.query<{ count: string }>(
		`SELECT COUNT(*)::text as count FROM _gridlite_views WHERE grid_id = $1`,
		[gridId]
	)

	return parseInt(result.rows[0].count, 10)
}
