/**
 * Raw SQL CRUD functions for _gridlite_view_groups
 *
 * These operate directly on PGLite. The store layer (view-store.ts) wraps
 * these with reactive Svelte store updates.
 */

import type { PGliteWithLive } from '@electric-sql/pglite/live'
import type { ViewGroup, ViewGroupRow, ViewGroupInput } from '../types.js'

// ─── Row ↔ Domain mapping ─────────────────────────────────────────

export function rowToGroup(row: ViewGroupRow): ViewGroup {
	return {
		id: row.id,
		gridId: row.grid_id,
		name: row.name,
		icon: row.icon ?? undefined,
		sortOrder: row.sort_order,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	}
}

// ─── CRUD ─────────────────────────────────────────────────────────

export async function createGroup(
	db: PGliteWithLive,
	gridId: string,
	input: ViewGroupInput
): Promise<ViewGroup> {
	const id = crypto.randomUUID()
	const now = new Date().toISOString()

	// Get next sort_order for this grid
	const orderResult = await db.query<{ max_order: number | null }>(
		`SELECT MAX(sort_order) as max_order FROM _gridlite_view_groups WHERE grid_id = $1`,
		[gridId]
	)
	const nextOrder = (orderResult.rows[0]?.max_order ?? -1) + 1

	await db.query(
		`INSERT INTO _gridlite_view_groups (id, grid_id, name, icon, sort_order, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $6)`,
		[id, gridId, input.name, input.icon ?? null, nextOrder, now]
	)

	const result = await db.query<ViewGroupRow>(
		`SELECT * FROM _gridlite_view_groups WHERE id = $1`,
		[id]
	)

	return rowToGroup(result.rows[0])
}

export async function renameGroup(
	db: PGliteWithLive,
	id: string,
	newName: string
): Promise<void> {
	await db.query(
		`UPDATE _gridlite_view_groups SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
		[newName, id]
	)
}

export async function updateGroupIcon(
	db: PGliteWithLive,
	id: string,
	icon: string | null
): Promise<void> {
	await db.query(
		`UPDATE _gridlite_view_groups SET icon = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
		[icon, id]
	)
}

export async function deleteGroup(
	db: PGliteWithLive,
	id: string
): Promise<void> {
	// FK ON DELETE SET NULL handles ungrouping views automatically
	await db.query(`DELETE FROM _gridlite_view_groups WHERE id = $1`, [id])
}

export async function reorderGroups(
	db: PGliteWithLive,
	orderedIds: string[]
): Promise<void> {
	for (let i = 0; i < orderedIds.length; i++) {
		await db.query(
			`UPDATE _gridlite_view_groups SET sort_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
			[i, orderedIds[i]]
		)
	}
}

export async function moveViewToGroup(
	db: PGliteWithLive,
	viewId: string,
	groupId: string | null
): Promise<void> {
	await db.query(
		`UPDATE _gridlite_views SET group_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
		[groupId, viewId]
	)
}

export async function groupNameExists(
	db: PGliteWithLive,
	gridId: string,
	name: string,
	excludeId?: string
): Promise<boolean> {
	const result = excludeId
		? await db.query(
				`SELECT 1 FROM _gridlite_view_groups WHERE grid_id = $1 AND name = $2 AND id != $3 LIMIT 1`,
				[gridId, name, excludeId]
			)
		: await db.query(
				`SELECT 1 FROM _gridlite_view_groups WHERE grid_id = $1 AND name = $2 LIMIT 1`,
				[gridId, name]
			)

	return result.rows.length > 0
}

export async function getGroupCount(
	db: PGliteWithLive,
	gridId: string
): Promise<number> {
	const result = await db.query<{ count: string }>(
		`SELECT COUNT(*)::text as count FROM _gridlite_view_groups WHERE grid_id = $1`,
		[gridId]
	)
	return parseInt(result.rows[0].count, 10)
}
