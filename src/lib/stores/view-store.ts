/**
 * View Store Factory
 *
 * Creates a grid-scoped bundle of Svelte stores and CRUD actions
 * backed by PGLite live queries. Each grid gets its own independent
 * store instance via initViewStore().
 */

import { writable, derived, get } from 'svelte/store'
import type { Readable, Writable } from 'svelte/store'
import type { PGliteWithLive } from '@electric-sql/pglite/live'
import type { SavedView, SavedViewInput, ViewRow, ViewStoreBundle, ViewActions } from '../types.js'
import { rowToView } from '../db/views.js'
import * as viewDb from '../db/views.js'
import { runViewMigrations } from '../db/migrations.js'

const VIEW_LIMIT = 50

/**
 * Initialize the view management system for a specific grid.
 * Consumer calls this once per grid instance with their PGLite instance.
 *
 * Returns a store bundle scoped to the given gridId.
 */
export function initViewStore(db: PGliteWithLive, gridId: string): ViewStoreBundle {
	if (typeof window === 'undefined') {
		throw new Error('svelte-gridlite-views requires a browser environment')
	}

	// ─── Stores ───────────────────────────────────────────────────

	const savedViews = writable<SavedView[]>([])
	const recentViews = writable<SavedView[]>([])
	const activeViewId = writable<string | null>(null)
	const activeViewModified = writable<boolean>(false)
	const ready = writable<boolean>(false)

	const activeView: Readable<SavedView | null> = derived(
		[savedViews, activeViewId],
		([$views, $id]) => ($id ? $views.find((v) => v.id === $id) ?? null : null)
	)

	// ─── Live query subscriptions ─────────────────────────────────

	let allViewsUnsubscribe: (() => void) | null = null
	let recentViewsUnsubscribe: (() => void) | null = null

	async function setupLiveQueries(): Promise<void> {
		// All views for this grid
		const allViewsResult = await db.live.query<ViewRow>(
			`SELECT * FROM _gridlite_views WHERE grid_id = $1 ORDER BY name`,
			[gridId],
			(results) => {
				savedViews.set(results.rows.map(rowToView))
			}
		)
		allViewsUnsubscribe = allViewsResult.unsubscribe
		// Set initial data
		savedViews.set(allViewsResult.initialResults.rows.map(rowToView))

		// Recent views (last 7 days, top 5)
		const recentViewsResult = await db.live.query<ViewRow>(
			`SELECT * FROM _gridlite_views
			 WHERE grid_id = $1 AND last_used > NOW() - INTERVAL '7 days'
			 ORDER BY last_used DESC LIMIT 5`,
			[gridId],
			(results) => {
				recentViews.set(results.rows.map(rowToView))
			}
		)
		recentViewsUnsubscribe = recentViewsResult.unsubscribe
		recentViews.set(recentViewsResult.initialResults.rows.map(rowToView))
	}

	// ─── Initialization ───────────────────────────────────────────

	const initPromise = (async () => {
		try {
			await runViewMigrations(db)
			await setupLiveQueries()
			ready.set(true)
			console.log('[svelte-gridlite-views] Store ready for grid:', gridId)
		} catch (err) {
			console.error('[svelte-gridlite-views] Initialization failed:', err)
			ready.set(true) // Still mark ready so UI doesn't hang
		}
	})()

	// ─── Actions ──────────────────────────────────────────────────

	const actions: ViewActions = {
		async save(input: SavedViewInput): Promise<SavedView> {
			const view = await viewDb.saveView(db, gridId, input)
			console.log('[svelte-gridlite-views] Saved view:', view.name, view.id)
			return view
		},

		async load(id: string): Promise<SavedView | undefined> {
			await viewDb.touchViewUsage(db, id)
			const view = await viewDb.loadView(db, id)

			if (view) {
				activeViewId.set(id)
				activeViewModified.set(false)
				console.log('[svelte-gridlite-views] Loaded view:', view.name)
			} else {
				console.warn('[svelte-gridlite-views] View not found:', id)
			}

			return view
		},

		async update(id: string, updates): Promise<void> {
			await viewDb.updateView(db, id, updates)
			activeViewModified.set(false)
			console.log('[svelte-gridlite-views] Updated view:', id)
		},

		async delete(id: string): Promise<void> {
			await viewDb.deleteView(db, id)

			if (get(activeViewId) === id) {
				activeViewId.set(null)
				activeViewModified.set(false)
			}

			console.log('[svelte-gridlite-views] Deleted view:', id)
		},

		async rename(id: string, newName: string): Promise<void> {
			await viewDb.updateView(db, id, { name: newName })
			console.log('[svelte-gridlite-views] Renamed view:', id, '→', newName)
		},

		markModified(): void {
			activeViewModified.set(true)
		},

		clearActive(): void {
			activeViewId.set(null)
			activeViewModified.set(false)
		},

		async nameExists(name: string, excludeId?: string): Promise<boolean> {
			return viewDb.nameExists(db, gridId, name, excludeId)
		},

		async getStorageStats(): Promise<{ count: number; limit: number; percentFull: number }> {
			const count = await viewDb.getViewCount(db, gridId)
			return {
				count,
				limit: VIEW_LIMIT,
				percentFull: Math.round((count / VIEW_LIMIT) * 100)
			}
		},

		async setDefaultView(id: string): Promise<void> {
			await viewDb.setDefaultView(db, gridId, id)
			console.log('[svelte-gridlite-views] Set default view:', id)
		},

		async loadDefaultView(): Promise<SavedView | undefined> {
			const view = await viewDb.loadDefaultView(db, gridId)
			if (view) {
				activeViewId.set(view.id)
				activeViewModified.set(false)
			}
			return view
		},

		async waitForReady(): Promise<void> {
			if (get(ready)) return
			return new Promise((resolve) => {
				const unsubscribe = ready.subscribe((isReady) => {
					if (isReady) {
						unsubscribe()
						resolve()
					}
				})
			})
		}
	}

	// ─── Cleanup ──────────────────────────────────────────────────

	async function destroy(): Promise<void> {
		allViewsUnsubscribe?.()
		recentViewsUnsubscribe?.()
		console.log('[svelte-gridlite-views] Store destroyed for grid:', gridId)
	}

	return {
		savedViews,
		recentViews,
		activeViewId,
		activeViewModified,
		activeView,
		ready,
		actions,
		destroy
	}
}
