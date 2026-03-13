<script lang="ts">
	import { onMount } from 'svelte'
	import { ViewSelector, SaveViewModal, initViewStore } from '$lib/index.js'
	import type { ViewConfig, SavedView, ViewStoreBundle } from '$lib/types.js'

	// Example enforcement data
	const data = [
		{
			id: 1,
			type: 'Case',
			date: '2024-03-15',
			organization: 'ABC Manufacturing Ltd',
			description: 'Health & Safety violation',
			fine_amount: '25,000',
			status: 'Closed'
		},
		{
			id: 2,
			type: 'Notice',
			date: '2024-03-10',
			organization: 'XYZ Construction',
			description: 'Improvement notice issued',
			fine_amount: '-',
			status: 'Active'
		},
		{
			id: 3,
			type: 'Case',
			date: '2024-02-28',
			organization: 'Global Logistics Inc',
			description: 'Environmental breach',
			fine_amount: '50,000',
			status: 'Closed'
		},
		{
			id: 4,
			type: 'Notice',
			date: '2024-02-20',
			organization: 'Tech Solutions Ltd',
			description: 'Prohibition notice',
			fine_amount: '-',
			status: 'Active'
		},
		{
			id: 5,
			type: 'Case',
			date: '2024-01-15',
			organization: 'Food Services Group',
			description: 'Food safety violation',
			fine_amount: '10,000',
			status: 'Closed'
		}
	]

	const availableColumns = ['id', 'type', 'date', 'organization', 'description', 'fine_amount', 'status']

	// Table state
	let filters: Array<{ id: string; field: string; operator: string; value: unknown }> = []
	let sorting: Array<{ column: string; direction: 'asc' | 'desc' }> = []
	let columns = [...availableColumns]
	let columnOrder = [...availableColumns]

	// View store (initialized on mount with PGLite)
	let viewStore: ViewStoreBundle | null = null
	let dbReady = false

	// Saved views UI state
	let showSaveModal = false
	let capturedConfig: ViewConfig | null = null

	onMount(async () => {
		// Dynamic import — PGLite is browser-only WASM
		const { PGlite } = await import('@electric-sql/pglite')
		const { live } = await import('@electric-sql/pglite/live')

		const db = new PGlite({ extensions: { live } })

		viewStore = initViewStore(db as any, 'demo-grid')
		await viewStore.actions.waitForReady()
		dbReady = true
	})

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

	function handleSaveView() {
		capturedConfig = captureCurrentConfig()
		showSaveModal = true
	}

	async function handleUpdateView() {
		if (!viewStore) return
		const activeId = viewStore.activeViewId
		let id: string | null = null
		const unsub = activeId.subscribe(v => id = v)
		unsub()
		if (!id) return

		try {
			const config = captureCurrentConfig()
			await viewStore.actions.update(id, { config })
			console.log('[Demo] View updated successfully')
		} catch (err) {
			console.error('[Demo] Failed to update view:', err)
			alert('Failed to update view. Please try again.')
		}
	}

	async function handleViewSelected(event: CustomEvent<{ view: SavedView }>) {
		const view = event.detail.view
		console.log('[Demo] Loading view:', view.name)

		filters = view.config.filters
		sorting = view.config.sorting
		columnOrder = view.config.columnOrder.length > 0
			? view.config.columnOrder.filter(col => availableColumns.includes(col))
			: [...availableColumns]
		columns = columnOrder
	}

	function handleViewSaved(event: CustomEvent<{ id: string; name: string }>) {
		console.log('[Demo] View saved:', event.detail.name)
	}

	function addFilter() {
		filters = [...filters, { id: crypto.randomUUID(), field: 'status', operator: 'equals', value: 'Active' }]
		viewStore?.actions.markModified()
	}

	function clearFilters() {
		filters = []
		viewStore?.actions.markModified()
	}

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

	// Filter data
	$: filteredData = data.filter(row => {
		return filters.every(filter => {
			const value = row[filter.field as keyof typeof row]
			if (filter.operator === 'equals') {
				return value === filter.value
			}
			return true
		})
	})

	// Sort data
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
		<p class="subtitle">Powered by Svelte 5 and PGLite</p>
		<nav class="nav-links">
			<a href="/">Back to Home</a>
		</nav>
	</header>

	<main>
		{#if !dbReady}
			<div class="py-12 text-center">
				<p class="text-gray-500">Initializing PGLite database...</p>
			</div>
		{:else if viewStore}
			<section>
				<h2>Interactive Demo</h2>
				<p class="description">
					Try saving different table configurations (filter, column sort).
					Your views persist in IndexedDB via PGLite and can be quickly restored.
				</p>

				<!-- Toolbar -->
				<div class="toolbar">
					<div class="toolbar-row">
						<ViewSelector {viewStore} on:viewSelected={handleViewSelected} />

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

						<div class="toolbar-divider"></div>

						<button
							type="button"
							on:click={addFilter}
							class="btn btn-secondary"
							disabled={filters.length > 0}
						>
							Add Filter (Status = Active)
						</button>
						<button
							type="button"
							on:click={clearFilters}
							class="btn btn-secondary"
							disabled={filters.length === 0}
						>
							Clear Filters
						</button>
					</div>
				</div>

				<!-- Table -->
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
										<td>{row[col as keyof typeof row]}</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Debug -->
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
		margin-bottom: 3rem;
	}

	h1 {
		font-size: 2.5rem;
		margin: 0 0 0.5rem 0;
		color: #333;
	}

	header p {
		font-size: 1.2rem;
		color: #666;
		margin: 0;
	}

	.subtitle {
		font-size: 0.9rem !important;
		color: #999 !important;
	}

	.nav-links {
		margin-top: 1rem;
		display: flex;
		gap: 0.5rem;
		justify-content: center;
	}

	.nav-links a {
		display: inline-block;
		padding: 0.5rem 1rem;
		background: #f0f9ff;
		color: #0369a1;
		text-decoration: none;
		border-radius: 0.375rem;
		border: 1px solid #0ea5e9;
		font-weight: 500;
		transition: all 0.2s;
	}

	.nav-links a:hover {
		background: #0ea5e9;
		color: white;
	}

	h2 {
		font-size: 1.5rem;
		margin: 2rem 0 1rem 0;
		color: #444;
	}

	section {
		margin: 2rem 0;
	}

	.description {
		color: #666;
		line-height: 1.6;
	}

	.toolbar {
		margin-bottom: 1rem;
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

	.table-wrapper {
		overflow-x: auto;
		border-radius: 0.5rem;
		border: 1px solid #e5e7eb;
		margin-bottom: 1rem;
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
