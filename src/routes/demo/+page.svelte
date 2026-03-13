<!--
  Saved Views Demo — svelte-gridlite-views
  ==========================================
  This page demonstrates every library feature in a single interactive demo:
  - ViewSelector dropdown with search, rename, duplicate, delete
  - SaveViewModal with validation and config summary
  - Update vs Save New split button pattern
  - Default view auto-load on mount
  - Storage stats display
  - Multiple filter/sort configurations to save as views

  For focused integration patterns, see .claude/skills/:
    quick-start/    — Install, PGLite init, minimal integration
    store-api/      — Complete ViewStoreBundle reference
    components/     — ViewSelector and SaveViewModal props/events
    view-crud/      — Save, load, update, delete lifecycle
    recipes/        — Integration with svelte-gridlite-kit
-->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte'
	import { ViewSelector, SaveViewModal, initViewStore } from '$lib/index.js'
	import type { ViewConfig, SavedView, ViewStoreBundle } from '$lib/types.js'

	// --- Sample Data ---
	// Enforcement cases dataset with mixed column types for realistic filter/sort demos
	const data = [
		{ id: 1, type: 'Case', date: '2024-03-15', organization: 'ABC Manufacturing Ltd', description: 'Health & Safety violation', fine_amount: 25000, status: 'Closed' },
		{ id: 2, type: 'Notice', date: '2024-03-10', organization: 'XYZ Construction', description: 'Improvement notice issued', fine_amount: 0, status: 'Active' },
		{ id: 3, type: 'Case', date: '2024-02-28', organization: 'Global Logistics Inc', description: 'Environmental breach', fine_amount: 50000, status: 'Closed' },
		{ id: 4, type: 'Notice', date: '2024-02-20', organization: 'Tech Solutions Ltd', description: 'Prohibition notice', fine_amount: 0, status: 'Active' },
		{ id: 5, type: 'Case', date: '2024-01-15', organization: 'Food Services Group', description: 'Food safety violation', fine_amount: 10000, status: 'Closed' },
		{ id: 6, type: 'Case', date: '2024-03-01', organization: 'Metro Transport Co', description: 'Safety equipment failure', fine_amount: 35000, status: 'Under Review' },
		{ id: 7, type: 'Notice', date: '2024-01-28', organization: 'Harbour Logistics', description: 'Fire safety improvement', fine_amount: 0, status: 'Active' },
		{ id: 8, type: 'Case', date: '2023-12-10', organization: 'Northern Steel Works', description: 'Emissions violation', fine_amount: 75000, status: 'Closed' },
		{ id: 9, type: 'Notice', date: '2024-02-05', organization: 'City Hospital Trust', description: 'Waste disposal notice', fine_amount: 0, status: 'Closed' },
		{ id: 10, type: 'Case', date: '2024-03-08', organization: 'Coastal Energy Ltd', description: 'Pipeline safety breach', fine_amount: 120000, status: 'Active' },
		{ id: 11, type: 'Notice', date: '2024-01-20', organization: 'Riverside Farms', description: 'Chemical storage notice', fine_amount: 0, status: 'Under Review' },
		{ id: 12, type: 'Case', date: '2023-11-15', organization: 'Summit Construction', description: 'Scaffolding collapse', fine_amount: 45000, status: 'Closed' },
	]

	const availableColumns = ['id', 'type', 'date', 'organization', 'description', 'fine_amount', 'status']

	// --- Table State ---
	// These represent the current table configuration that gets saved/restored as views
	let filters: Array<{ id: string; field: string; operator: string; value: unknown }> = []
	let sorting: Array<{ column: string; direction: 'asc' | 'desc' }> = []
	let columns = [...availableColumns]
	let columnOrder = [...availableColumns]

	// --- View Store ---
	// Initialized on mount with PGLite. Each grid gets its own scoped store.
	let viewStore: ViewStoreBundle | null = null
	let dbReady = false
	let storageStats: { count: number; limit: number; percentFull: number } | null = null

	// --- Save Modal State ---
	let showSaveModal = false
	let capturedConfig: ViewConfig | null = null

	onMount(async () => {
		// Dynamic import — PGLite is browser-only WASM
		const { PGlite } = await import('@electric-sql/pglite')
		const { live } = await import('@electric-sql/pglite/live')

		const db = new PGlite({ extensions: { live } })

		// Initialize view store scoped to 'demo-grid'
		viewStore = initViewStore(db as any, 'demo-grid')
		await viewStore.actions.waitForReady()
		dbReady = true

		// Auto-load default view if one exists
		const defaultView = await viewStore.actions.loadDefaultView()
		if (defaultView) {
			applyViewConfig(defaultView)
		}

		// Load initial storage stats
		storageStats = await viewStore.actions.getStorageStats()
	})

	onDestroy(() => {
		viewStore?.destroy()
	})

	// --- ViewConfig capture/apply ---
	// Captures the current table state as a ViewConfig for saving
	function captureCurrentConfig(): ViewConfig {
		const visibility: Record<string, boolean> = {}
		for (const col of availableColumns) {
			visibility[col] = columns.includes(col)
		}

		return {
			filters,
			filterLogic: 'and',
			sorting,
			grouping: [],
			columnVisibility: visibility,
			columnOrder,
			columnWidths: {},
			pageSize: 25
		}
	}

	// Applies a saved view's config to the table state
	function applyViewConfig(view: SavedView) {
		filters = view.config.filters
		sorting = view.config.sorting

		// Restore column order, validating against available columns
		columnOrder = view.config.columnOrder.length > 0
			? view.config.columnOrder.filter(col => availableColumns.includes(col))
			: [...availableColumns]

		// Restore column visibility
		if (Object.keys(view.config.columnVisibility).length > 0) {
			columns = availableColumns.filter(col => view.config.columnVisibility[col] !== false)
		} else {
			columns = columnOrder
		}
	}

	// --- Event Handlers ---

	function handleSaveView() {
		capturedConfig = captureCurrentConfig()
		showSaveModal = true
	}

	async function handleUpdateView() {
		if (!viewStore) return
		let id: string | null = null
		const unsub = viewStore.activeViewId.subscribe(v => id = v)
		unsub()
		if (!id) return

		await viewStore.actions.update(id, { config: captureCurrentConfig() })
		storageStats = await viewStore.actions.getStorageStats()
	}

	async function handleViewSelected(event: CustomEvent<{ view: SavedView }>) {
		applyViewConfig(event.detail.view)
	}

	async function handleViewSaved(event: CustomEvent<{ id: string; name: string }>) {
		if (viewStore) {
			storageStats = await viewStore.actions.getStorageStats()
		}
	}

	function handleClearActive() {
		viewStore?.actions.clearActive()
		filters = []
		sorting = []
		columns = [...availableColumns]
		columnOrder = [...availableColumns]
	}

	// --- Filter Presets ---
	// Quick buttons to apply common filter combinations

	function filterActiveCases() {
		filters = [{ id: crypto.randomUUID(), field: 'status', operator: 'equals', value: 'Active' }]
		viewStore?.actions.markModified()
	}

	function filterHighValue() {
		filters = [{ id: crypto.randomUUID(), field: 'fine_amount', operator: 'greater_than', value: 25000 }]
		viewStore?.actions.markModified()
	}

	function filterCasesOnly() {
		filters = [{ id: crypto.randomUUID(), field: 'type', operator: 'equals', value: 'Case' }]
		viewStore?.actions.markModified()
	}

	function clearFilters() {
		filters = []
		viewStore?.actions.markModified()
	}

	// --- Sort ---

	function toggleSort(columnId: string) {
		const existing = sorting.find(s => s.column === columnId)
		if (existing) {
			if (existing.direction === 'asc') {
				sorting = sorting.map(s => s.column === columnId ? { ...s, direction: 'desc' as const } : s)
			} else {
				sorting = sorting.filter(s => s.column !== columnId)
			}
		} else {
			sorting = [...sorting, { column: columnId, direction: 'asc' }]
		}
		viewStore?.actions.markModified()
	}

	// --- Column Visibility ---

	function toggleColumn(col: string) {
		if (columns.includes(col)) {
			columns = columns.filter(c => c !== col)
		} else {
			// Re-add in original order
			columns = availableColumns.filter(c => columns.includes(c) || c === col)
		}
		viewStore?.actions.markModified()
	}

	// --- Derived data ---

	$: filteredData = data.filter(row => {
		return filters.every(filter => {
			const value = row[filter.field as keyof typeof row]
			if (filter.operator === 'equals') return value === filter.value
			if (filter.operator === 'greater_than') return Number(value) > Number(filter.value)
			return true
		})
	})

	$: sortedData = sorting.length > 0
		? [...filteredData].sort((a, b) => {
				for (const sort of sorting) {
					const aVal = a[sort.column as keyof typeof a]
					const bVal = b[sort.column as keyof typeof b]
					const modifier = sort.direction === 'asc' ? 1 : -1
					if (aVal < bVal) return -modifier
					if (aVal > bVal) return modifier
				}
				return 0
		  })
		: filteredData

	// Reactive store values for template
	$: activeViewId = viewStore?.activeViewId
	$: activeViewModified = viewStore?.activeViewModified
</script>

<svelte:head>
	<title>Saved Views Demo - svelte-gridlite-views</title>
</svelte:head>

<div class="container">
	<header>
		<h1>Saved Views Demo</h1>
		<p>Save and restore table configurations with PGLite persistence</p>
		<p class="subtitle">Powered by Svelte 5 and PGLite — views persist in IndexedDB</p>
	</header>

	<main>
		{#if !dbReady}
			<div class="py-12 text-center">
				<p class="text-gray-500">Initializing PGLite database...</p>
			</div>
		{:else if viewStore}
			<section>
				<!-- Toolbar: View controls + filter presets -->
				<div class="toolbar">
					<div class="toolbar-row">
						<!-- View Selector dropdown -->
						<ViewSelector {viewStore} on:viewSelected={handleViewSelected} />

						<!-- Update / Save New split button pattern -->
						{#if $activeViewId && $activeViewModified}
							<div class="button-group">
								<button type="button" on:click={handleUpdateView} class="btn btn-primary-left">
									Update View
								</button>
								<button type="button" on:click={handleSaveView} class="btn btn-primary-right">
									Save New
								</button>
							</div>
						{:else}
							<button type="button" on:click={handleSaveView} class="btn btn-primary">
								Save View
							</button>
						{/if}

						<!-- Clear active view -->
						{#if $activeViewId}
							<button type="button" on:click={handleClearActive} class="btn btn-ghost" title="Clear active view">
								Clear
							</button>
						{/if}

						<div class="toolbar-divider"></div>

						<!-- Filter presets -->
						<button type="button" on:click={filterActiveCases} class="btn btn-secondary">Active Only</button>
						<button type="button" on:click={filterHighValue} class="btn btn-secondary">Fines &gt; 25k</button>
						<button type="button" on:click={filterCasesOnly} class="btn btn-secondary">Cases Only</button>
						<button type="button" on:click={clearFilters} class="btn btn-secondary" disabled={filters.length === 0}>
							Clear Filters
						</button>
					</div>

					<!-- Storage stats -->
					{#if storageStats}
						<div class="storage-stats">
							{storageStats.count}/{storageStats.limit} views ({storageStats.percentFull}% full)
						</div>
					{/if}
				</div>

				<!-- Column visibility toggles -->
				<div class="column-toggles">
					<span class="toggle-label">Columns:</span>
					{#each availableColumns as col}
						<label class="column-toggle">
							<input type="checkbox" checked={columns.includes(col)} on:change={() => toggleColumn(col)} />
							{col}
						</label>
					{/each}
				</div>

				<!-- Data Table -->
				<div class="table-wrapper">
					<table class="demo-table">
						<thead>
							<tr>
								{#each columns as col}
									<th on:click={() => toggleSort(col)}>
										<div class="th-content">
											{col}
											{#each sorting as sort}
												{#if sort.column === col}
													<span class="sort-indicator">
														{sort.direction === 'asc' ? '↑' : '↓'}
													</span>
												{/if}
											{/each}
										</div>
									</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each sortedData as row}
								<tr>
									{#each columns as col}
										<td>
											{#if col === 'fine_amount'}
												{row[col] > 0 ? `£${row[col].toLocaleString()}` : '—'}
											{:else}
												{row[col as keyof typeof row]}
											{/if}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<div class="row-count">{sortedData.length} of {data.length} rows</div>

				<!-- Debug Panel -->
				<details class="debug-panel">
					<summary>Current Table State</summary>
					<pre><code>{JSON.stringify({
						filters,
						sorting,
						columns,
						columnOrder,
						activeViewId: $activeViewId,
						modified: $activeViewModified
					}, null, 2)}</code></pre>
				</details>
			</section>

			<!-- Save View Modal -->
			{#if showSaveModal && capturedConfig}
				<SaveViewModal
					{viewStore}
					bind:open={showSaveModal}
					config={capturedConfig}
					on:save={handleViewSaved}
				/>
			{/if}
		{/if}
	</main>
</div>

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	header {
		text-align: center;
		margin-bottom: 2rem;
	}

	h1 {
		font-size: 2rem;
		margin: 0 0 0.25rem 0;
		color: #333;
	}

	header p {
		font-size: 1.1rem;
		color: #666;
		margin: 0;
	}

	.subtitle {
		font-size: 0.85rem !important;
		color: #999 !important;
	}

	section {
		margin: 1.5rem 0;
	}

	.toolbar {
		margin-bottom: 0.75rem;
		padding: 1rem;
		background: #f9fafb;
		border-radius: 0.5rem;
	}

	.toolbar-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.toolbar-divider {
		width: 1px;
		height: 2rem;
		background: #d1d5db;
		margin: 0 0.25rem;
	}

	.storage-stats {
		margin-top: 0.5rem;
		font-size: 0.75rem;
		color: #9ca3af;
	}

	.column-toggles {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
		padding: 0.5rem 0;
		flex-wrap: wrap;
	}

	.toggle-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: #6b7280;
	}

	.column-toggle {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.8rem;
		color: #4b5563;
		cursor: pointer;
	}

	/* ViewSelector styling within toolbar */
	.toolbar-row :global(.view-selector button) {
		background: white;
		color: #374151;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		padding: 0.5rem 1rem;
		height: 2.5rem;
		transition: all 0.2s;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.toolbar-row :global(.view-selector button:hover) {
		background: #f9fafb;
		border-color: #9ca3af;
	}

	.button-group {
		display: inline-flex;
		border-radius: 0.375rem;
		overflow: hidden;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		height: 2.5rem;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-primary {
		background: #4f46e5;
		color: white;
		border-radius: 0.375rem;
	}

	.btn-primary:hover {
		background: #4338ca;
	}

	.btn-primary-left {
		background: #4f46e5;
		color: white;
		border-radius: 0.375rem 0 0 0.375rem;
		border-right: 1px solid #6366f1;
	}

	.btn-primary-left:hover {
		background: #4338ca;
	}

	.btn-primary-right {
		background: #4f46e5;
		color: white;
		border-radius: 0 0.375rem 0.375rem 0;
	}

	.btn-primary-right:hover {
		background: #4338ca;
	}

	.btn-secondary {
		background: white;
		color: #374151;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #f9fafb;
	}

	.btn-secondary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-ghost {
		background: transparent;
		color: #6b7280;
		border: 1px solid transparent;
		border-radius: 0.375rem;
	}

	.btn-ghost:hover {
		background: #f3f4f6;
		color: #374151;
	}

	.table-wrapper {
		overflow-x: auto;
		border-radius: 0.5rem;
		border: 1px solid #e5e7eb;
	}

	.demo-table {
		width: 100%;
		border-collapse: collapse;
		background: white;
	}

	.demo-table thead {
		background: #f9fafb;
		border-bottom: 2px solid #e5e7eb;
	}

	.demo-table th {
		padding: 0.75rem 1rem;
		text-align: left;
		font-weight: 600;
		color: #374151;
		cursor: pointer;
		user-select: none;
	}

	.demo-table th:hover {
		background: #f3f4f6;
	}

	.th-content {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.sort-indicator {
		font-size: 0.875rem;
		color: #4f46e5;
	}

	.demo-table td {
		padding: 0.75rem 1rem;
		border-top: 1px solid #e5e7eb;
		color: #4b5563;
	}

	.demo-table tbody tr:hover {
		background: #f9fafb;
	}

	.row-count {
		margin-top: 0.5rem;
		font-size: 0.8rem;
		color: #9ca3af;
	}

	.debug-panel {
		margin-top: 2rem;
		padding: 1rem;
		background: #f3f4f6;
		border-radius: 0.5rem;
		border: 1px solid #d1d5db;
	}

	.debug-panel summary {
		cursor: pointer;
		font-weight: 600;
		color: #374151;
		user-select: none;
	}

	.debug-panel pre {
		margin-top: 1rem;
		padding: 1rem;
		background: #1f2937;
		color: #e5e7eb;
		border-radius: 0.375rem;
		overflow-x: auto;
	}

	.debug-panel code {
		font-family: 'Monaco', 'Courier New', monospace;
		font-size: 0.875rem;
	}
</style>
