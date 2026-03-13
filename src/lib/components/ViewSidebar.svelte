<!--
  ViewSidebar — persistent sidebar panel for browsing and managing saved views.

  Alternative to ViewSelector (dropdown). Same viewStore prop, same events.
  Use alongside or instead of ViewSelector depending on layout needs.

  Features: search, pinned views, collapsible groups, group CRUD (create/rename/delete),
  drag-and-drop views between groups, group reordering, rename, delete,
  set default, modified indicator, storage stats, CSS custom properties.
-->
<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte'
	import type { ViewStoreBundle, ViewGroup, SavedView } from '../types.js'

	// --- Props ---
	export let viewStore: ViewStoreBundle
	export let groups: ViewGroup[] = []
	export let storageKey: string = 'view-sidebar-state'
	export let isDocked: boolean = true
	export let width: number = 260
	export let showSearch: boolean = true
	export let showPinned: boolean = true
	export let searchPlaceholder: string = 'Search views...'

	// --- Store destructuring (same pattern as ViewSelector) ---
	$: ({ savedViews, savedGroups, activeViewId, activeViewModified, actions, groupActions } = viewStore)

	// --- Internal state ---
	let searchQuery = ''
	let collapsedGroupIds: string[] = []
	let pinnedViewIds: string[] = []
	let renamingId: string | null = null
	let renameValue = ''
	let confirmDeleteId: string | null = null
	let storageStats: { count: number; limit: number; percentFull: number } | null = null

	// --- Group management state ---
	let creatingGroup = false
	let newGroupName = ''
	let renamingGroupId: string | null = null
	let renameGroupValue = ''

	// --- Drag-and-drop state ---
	let dragViewId: string | null = null
	let dragGroupId: string | null = null
	let dropTargetGroupId: string | null = null

	const dispatch = createEventDispatcher<{
		viewSelected: { view: SavedView }
		deleteView: { id: string }
		pin: { view: SavedView; isPinned: boolean }
		groupToggle: { group: ViewGroup; isCollapsed: boolean }
		groupCreated: { group: ViewGroup }
		groupDeleted: { id: string }
		groupRenamed: { id: string; name: string }
		viewMoved: { viewId: string; groupId: string | null }
	}>()

	// --- Persisted sidebar UI state ---
	interface SidebarState {
		collapsedGroups: string[]
		pinnedViews: string[]
		isDocked: boolean
		width: number
	}

	onMount(() => {
		if (typeof localStorage !== 'undefined') {
			try {
				const saved = localStorage.getItem(storageKey)
				if (saved) {
					const state: SidebarState = JSON.parse(saved)
					collapsedGroupIds = state.collapsedGroups || []
					pinnedViewIds = state.pinnedViews || []
					if (state.isDocked !== undefined) isDocked = state.isDocked
					if (state.width !== undefined) width = state.width
				}
			} catch (e) {
				console.warn('[ViewSidebar] Failed to load state:', e)
			}
		}
		loadStorageStats()
	})

	function saveState() {
		if (typeof localStorage !== 'undefined') {
			const state: SidebarState = {
				collapsedGroups: collapsedGroupIds,
				pinnedViews: pinnedViewIds,
				isDocked,
				width
			}
			localStorage.setItem(storageKey, JSON.stringify(state))
		}
	}

	async function loadStorageStats() {
		storageStats = await actions.getStorageStats()
	}

	// --- Reactive: effective groups (store-driven or prop fallback) ---
	$: effectiveGroups = $savedGroups.length > 0
		? $savedGroups
		: groups.map(g => ({
				...g,
				gridId: '',
				sortOrder: g.sortOrder ?? 0,
				createdAt: '',
				updatedAt: ''
			}))

	$: hasStoreGroups = $savedGroups.length > 0

	// --- Reactive filtering ---
	$: filteredViews = searchQuery
		? $savedViews.filter(
				(v) =>
					v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
					v.description?.toLowerCase().includes(searchQuery.toLowerCase())
			)
		: $savedViews

	$: pinnedViews = $savedViews.filter((v) => pinnedViewIds.includes(v.id))

	// Group views by groupId — uses actual view.groupId
	$: viewsByGroup = filteredViews.reduce(
		(acc, view) => {
			const groupId = view.groupId ?? '__ungrouped__'
			if (!acc[groupId]) acc[groupId] = []
			acc[groupId].push(view)
			return acc
		},
		{} as Record<string, SavedView[]>
	)

	$: ungroupedViews = viewsByGroup['__ungrouped__'] || []
	$: sortedGroups = [...effectiveGroups].sort((a, b) => a.sortOrder - b.sortOrder)

	// --- Event Handlers ---

	async function selectView(view: SavedView) {
		await actions.load(view.id)
		dispatch('viewSelected', { view })
		await loadStorageStats()
	}

	function handleTogglePin(view: SavedView, event: MouseEvent) {
		event.stopPropagation()
		const isPinned = pinnedViewIds.includes(view.id)
		if (isPinned) {
			pinnedViewIds = pinnedViewIds.filter((id) => id !== view.id)
		} else {
			pinnedViewIds = [...pinnedViewIds, view.id]
		}
		saveState()
		dispatch('pin', { view, isPinned: !isPinned })
	}

	function handleToggleGroup(group: ViewGroup) {
		const isCollapsed = collapsedGroupIds.includes(group.id)
		if (isCollapsed) {
			collapsedGroupIds = collapsedGroupIds.filter((id) => id !== group.id)
		} else {
			collapsedGroupIds = [...collapsedGroupIds, group.id]
		}
		saveState()
		dispatch('groupToggle', { group, isCollapsed: !isCollapsed })
	}

	function startRename(view: SavedView, event: MouseEvent) {
		event.stopPropagation()
		renamingId = view.id
		renameValue = view.name
	}

	async function confirmRename(id: string) {
		const trimmed = renameValue.trim()
		const view = $savedViews.find((v) => v.id === id)
		if (trimmed && view && trimmed !== view.name) {
			await actions.rename(id, trimmed)
		}
		renamingId = null
		renameValue = ''
	}

	function cancelRename() {
		renamingId = null
		renameValue = ''
	}

	async function handleDelete(id: string, event: MouseEvent) {
		event.stopPropagation()
		const view = $savedViews.find((v) => v.id === id)
		if (!view) return

		if (confirm(`Delete view "${view.name}"?`)) {
			await actions.delete(id)
			dispatch('deleteView', { id })
			await loadStorageStats()
		}
	}

	async function handleSetDefault(view: SavedView, event: MouseEvent) {
		event.stopPropagation()
		await actions.setDefaultView(view.id)
	}

	function formatDate(timestamp: string): string {
		const date = new Date(timestamp)
		const now = new Date()
		const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

		if (diffDays === 0) return 'Today'
		if (diffDays === 1) return 'Yesterday'
		if (diffDays < 7) return `${diffDays}d ago`
		if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
		return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
	}

	// --- Group CRUD handlers ---

	async function handleCreateGroup() {
		const trimmed = newGroupName.trim()
		if (!trimmed) return
		try {
			const group = await groupActions.createGroup({ name: trimmed })
			newGroupName = ''
			creatingGroup = false
			dispatch('groupCreated', { group })
		} catch (err) {
			console.error('[ViewSidebar] Failed to create group:', err)
		}
	}

	function startGroupRename(group: ViewGroup, event: MouseEvent) {
		event.stopPropagation()
		renamingGroupId = group.id
		renameGroupValue = group.name
	}

	async function confirmGroupRename(id: string) {
		const trimmed = renameGroupValue.trim()
		const group = effectiveGroups.find(g => g.id === id)
		if (trimmed && group && trimmed !== group.name) {
			await groupActions.renameGroup(id, trimmed)
			dispatch('groupRenamed', { id, name: trimmed })
		}
		renamingGroupId = null
		renameGroupValue = ''
	}

	function cancelGroupRename() {
		renamingGroupId = null
		renameGroupValue = ''
	}

	async function handleDeleteGroup(group: ViewGroup, event: MouseEvent) {
		event.stopPropagation()
		if (confirm(`Delete group "${group.name}"? Views in this group will be moved to Ungrouped.`)) {
			await groupActions.deleteGroup(group.id)
			dispatch('groupDeleted', { id: group.id })
		}
	}

	// --- Drag-and-drop handlers ---

	function handleViewDragStart(event: DragEvent, view: SavedView) {
		dragViewId = view.id
		dragGroupId = null
		event.dataTransfer?.setData('text/plain', view.id)
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move'
		}
	}

	function handleGroupDragStart(event: DragEvent, group: ViewGroup) {
		dragGroupId = group.id
		dragViewId = null
		event.dataTransfer?.setData('text/plain', group.id)
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move'
		}
	}

	function handleGroupDragOver(event: DragEvent, targetId: string) {
		if (dragViewId || dragGroupId) {
			event.preventDefault()
			if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
			dropTargetGroupId = targetId
		}
	}

	function handleGroupDragLeave(event: DragEvent) {
		const relatedTarget = event.relatedTarget as HTMLElement | null
		if (!relatedTarget || !(event.currentTarget as HTMLElement).contains(relatedTarget)) {
			dropTargetGroupId = null
		}
	}

	async function handleGroupDrop(event: DragEvent, targetGroupId: string | null) {
		event.preventDefault()
		dropTargetGroupId = null

		if (dragViewId) {
			await groupActions.moveViewToGroup(dragViewId, targetGroupId)
			dispatch('viewMoved', { viewId: dragViewId, groupId: targetGroupId })
			dragViewId = null
		} else if (dragGroupId && targetGroupId && dragGroupId !== targetGroupId) {
			const currentOrder = sortedGroups.map(g => g.id)
			const fromIndex = currentOrder.indexOf(dragGroupId)
			const toIndex = currentOrder.indexOf(targetGroupId)
			if (fromIndex >= 0 && toIndex >= 0) {
				currentOrder.splice(fromIndex, 1)
				currentOrder.splice(toIndex, 0, dragGroupId)
				await groupActions.reorderGroups(currentOrder)
			}
			dragGroupId = null
		}
	}

	function handleDragEnd() {
		dragViewId = null
		dragGroupId = null
		dropTargetGroupId = null
	}
</script>

{#if isDocked}
	<aside class="view-sidebar" style="width: {width}px;">
		<!-- Header -->
		<div class="sidebar-header">
			<span class="sidebar-title">Views</span>
			<div class="header-actions">
				{#if storageStats}
					<span class="storage-stats">{storageStats.count}/{storageStats.limit}</span>
				{/if}
				<button
					class="new-group-btn"
					on:click={() => { creatingGroup = true }}
					title="New group"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon-xs">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
					</svg>
				</button>
			</div>
		</div>

		<!-- Search -->
		{#if showSearch}
			<div class="sidebar-search">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder={searchPlaceholder}
					class="search-input"
				/>
				{#if searchQuery}
					<button class="clear-search" on:click={() => (searchQuery = '')} title="Clear search">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon-sm">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				{/if}
			</div>
		{/if}

		<div class="sidebar-content">
			<!-- New Group inline creation -->
			{#if creatingGroup}
				<div class="new-group-row">
					<input
						type="text"
						bind:value={newGroupName}
						placeholder="Group name..."
						maxlength="100"
						on:keydown={(e) => {
							if (e.key === 'Enter') handleCreateGroup()
							if (e.key === 'Escape') { creatingGroup = false; newGroupName = '' }
						}}
						class="rename-input"
						autofocus
					/>
					<button class="action-btn confirm" on:click={handleCreateGroup} title="Create">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon-xs">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
					</button>
					<button class="action-btn cancel" on:click={() => { creatingGroup = false; newGroupName = '' }} title="Cancel">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon-xs">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			{/if}

			<!-- Pinned Views -->
			{#if showPinned && pinnedViews.length > 0 && !searchQuery}
				<div class="pinned-section">
					<div class="section-header">
						<svg viewBox="0 0 24 24" fill="currentColor" class="icon-xs pin-icon">
							<path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
						</svg>
						<span class="section-title">Pinned</span>
					</div>
					<ul class="view-list">
						{#each pinnedViews as view (view.id)}
							<li class="view-item" class:selected={view.id === $activeViewId}>
								<button class="view-button" on:click={() => selectView(view)}>
									<span class="view-name">
										{view.name}
										{#if view.id === $activeViewId && $activeViewModified}
											<span class="modified-indicator">*</span>
										{/if}
									</span>
								</button>
								<button
									class="action-btn pinned"
									on:click={(e) => handleTogglePin(view, e)}
									title="Unpin view"
								>
									<svg viewBox="0 0 24 24" fill="currentColor" class="icon-xs">
										<path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
									</svg>
								</button>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<!-- Groups -->
			{#each sortedGroups as group (group.id)}
				{@const groupViews = viewsByGroup[group.id] || []}
				{@const isCollapsed = collapsedGroupIds.includes(group.id)}
				{#if groupViews.length > 0 || !searchQuery}
					<div
						class="view-group"
						role="group"
						aria-label={group.name}
						class:drop-target={dropTargetGroupId === group.id}
						on:dragover={(e) => handleGroupDragOver(e, group.id)}
						on:dragleave={handleGroupDragLeave}
						on:drop={(e) => handleGroupDrop(e, group.id)}
					>
						{#if renamingGroupId === group.id}
							<div class="rename-row group-rename-row">
								<input
									type="text"
									bind:value={renameGroupValue}
									on:keydown={(e) => {
										if (e.key === 'Enter') confirmGroupRename(group.id)
										if (e.key === 'Escape') cancelGroupRename()
									}}
									class="rename-input"
									maxlength="100"
									autofocus
								/>
								<button class="action-btn confirm" on:click={() => confirmGroupRename(group.id)} title="Save">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon-xs">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
									</svg>
								</button>
								<button class="action-btn cancel" on:click={cancelGroupRename} title="Cancel">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon-xs">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
						{:else}
							<div
								class="group-header"
								role="button"
								tabindex="0"
								draggable={hasStoreGroups}
								on:dragstart={(e) => handleGroupDragStart(e, group)}
								on:dragend={handleDragEnd}
								on:click={() => handleToggleGroup(group)}
								on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleToggleGroup(group) }}
							>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon-xs collapse-icon" class:collapsed={isCollapsed}>
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
								</svg>
								{#if group.icon}
									<span class="group-icon">{group.icon}</span>
								{/if}
								<span class="group-name">{group.name}</span>
								<span class="group-count">{groupViews.length}</span>
								{#if hasStoreGroups}
									<div class="group-actions">
										<button class="action-btn" on:click={(e) => startGroupRename(group, e)} title="Rename group">
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon-xs">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
											</svg>
										</button>
										<button class="action-btn delete" on:click={(e) => handleDeleteGroup(group, e)} title="Delete group">
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon-xs">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
											</svg>
										</button>
									</div>
								{/if}
							</div>
						{/if}
						{#if !isCollapsed}
							<ul class="view-list">
								{#each groupViews as view (view.id)}
									<li
										class="view-item"
										class:selected={view.id === $activeViewId}
										draggable="true"
										on:dragstart={(e) => handleViewDragStart(e, view)}
										on:dragend={handleDragEnd}
									>
										{#if renamingId === view.id}
											<div class="rename-row">
												<input
													type="text"
													bind:value={renameValue}
													on:keydown={(e) => {
														if (e.key === 'Enter') confirmRename(view.id)
														if (e.key === 'Escape') cancelRename()
													}}
													class="rename-input"
													autofocus
												/>
												<button class="action-btn confirm" on:click={() => confirmRename(view.id)} title="Save">
													<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon-xs">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
													</svg>
												</button>
												<button class="action-btn cancel" on:click={cancelRename} title="Cancel">
													<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon-xs">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
													</svg>
												</button>
											</div>
										{:else}
											<button class="view-button" on:click={() => selectView(view)}>
												<span class="view-name">
													{view.name}
													{#if view.id === $activeViewId && $activeViewModified}
														<span class="modified-indicator">*</span>
													{/if}
												</span>
												{#if view.isDefault}
													<span class="default-badge">Default</span>
												{/if}
												<span class="view-meta">{formatDate(view.lastUsed)}</span>
											</button>
											<div class="action-buttons">
												<button
													class="action-btn"
													class:pinned={pinnedViewIds.includes(view.id)}
													on:click={(e) => handleTogglePin(view, e)}
													title={pinnedViewIds.includes(view.id) ? 'Unpin' : 'Pin'}
												>
													<svg viewBox="0 0 24 24" fill={pinnedViewIds.includes(view.id) ? 'currentColor' : 'none'} stroke="currentColor" class="icon-xs">
														<path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
													</svg>
												</button>
												<button class="action-btn" on:click={(e) => startRename(view, e)} title="Rename">
													<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon-xs">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
													</svg>
												</button>
												{#if !view.isDefault}
													<button class="action-btn" on:click={(e) => handleSetDefault(view, e)} title="Set as default">
														<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon-xs">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
														</svg>
													</button>
												{/if}
												<button class="action-btn delete" on:click={(e) => handleDelete(view.id, e)} title="Delete">
													<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon-xs">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
													</svg>
												</button>
											</div>
										{/if}
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/if}
			{/each}

			<!-- Ungrouped Views -->
			{#if ungroupedViews.length > 0}
				<div
					class="view-group"
					role="group"
					aria-label="Ungrouped views"
					class:drop-target={dropTargetGroupId === '__ungrouped__'}
					on:dragover={(e) => handleGroupDragOver(e, '__ungrouped__')}
					on:dragleave={handleGroupDragLeave}
					on:drop={(e) => handleGroupDrop(e, null)}
				>
					{#if effectiveGroups.length > 0}
						<div class="group-header static">
							<span class="group-name">{searchQuery ? 'Search Results' : 'Ungrouped'}</span>
							<span class="group-count">{ungroupedViews.length}</span>
						</div>
					{/if}
					<ul class="view-list">
						{#each ungroupedViews as view (view.id)}
							<li
								class="view-item"
								class:selected={view.id === $activeViewId}
								draggable="true"
								on:dragstart={(e) => handleViewDragStart(e, view)}
								on:dragend={handleDragEnd}
							>
								{#if renamingId === view.id}
									<div class="rename-row">
										<input
											type="text"
											bind:value={renameValue}
											on:keydown={(e) => {
												if (e.key === 'Enter') confirmRename(view.id)
												if (e.key === 'Escape') cancelRename()
											}}
											class="rename-input"
											autofocus
										/>
										<button class="action-btn confirm" on:click={() => confirmRename(view.id)} title="Save">
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon-xs">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
											</svg>
										</button>
										<button class="action-btn cancel" on:click={cancelRename} title="Cancel">
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon-xs">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									</div>
								{:else}
									<button class="view-button" on:click={() => selectView(view)}>
										<span class="view-name">
											{view.name}
											{#if view.id === $activeViewId && $activeViewModified}
												<span class="modified-indicator">*</span>
											{/if}
										</span>
										{#if view.isDefault}
											<span class="default-badge">Default</span>
										{/if}
										<span class="view-meta">{formatDate(view.lastUsed)}</span>
									</button>
									<div class="action-buttons">
										<button
											class="action-btn"
											class:pinned={pinnedViewIds.includes(view.id)}
											on:click={(e) => handleTogglePin(view, e)}
											title={pinnedViewIds.includes(view.id) ? 'Unpin' : 'Pin'}
										>
											<svg viewBox="0 0 24 24" fill={pinnedViewIds.includes(view.id) ? 'currentColor' : 'none'} stroke="currentColor" class="icon-xs">
												<path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
											</svg>
										</button>
										<button class="action-btn" on:click={(e) => startRename(view, e)} title="Rename">
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon-xs">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
											</svg>
										</button>
										{#if !view.isDefault}
											<button class="action-btn" on:click={(e) => handleSetDefault(view, e)} title="Set as default">
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon-xs">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
												</svg>
											</button>
										{/if}
										<button class="action-btn delete" on:click={(e) => handleDelete(view.id, e)} title="Delete">
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon-xs">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
											</svg>
										</button>
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{:else if $savedViews.length === 0}
				<div class="empty-state">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="empty-icon">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
					</svg>
					<p class="empty-text">No saved views</p>
					<p class="empty-hint">Save your first view to get started</p>
				</div>
			{/if}
		</div>
	</aside>
{/if}

<style>
	.view-sidebar {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--sidebar-bg, #f8f9fa);
		border-right: 1px solid var(--sidebar-border, #e1e4e8);
		font-family: var(--sidebar-font, system-ui, -apple-system, sans-serif);
		font-size: 13px;
		flex-shrink: 0;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 14px;
		border-bottom: 1px solid var(--sidebar-border, #e1e4e8);
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.sidebar-title {
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-secondary, #4b5563);
	}

	.storage-stats {
		font-size: 11px;
		color: var(--text-muted, #9ca3af);
	}

	.new-group-btn {
		padding: 3px;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-muted, #9ca3af);
		border-radius: 3px;
		display: flex;
		align-items: center;
	}

	.new-group-btn:hover {
		background: var(--hover-bg, rgba(0, 0, 0, 0.08));
		color: var(--text-secondary, #4b5563);
	}

	.new-group-row {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 14px;
		border-bottom: 1px solid var(--sidebar-border, #e1e4e8);
	}

	.sidebar-search {
		padding: 8px 12px;
		border-bottom: 1px solid var(--sidebar-border, #e1e4e8);
		position: relative;
	}

	.search-input {
		width: 100%;
		padding: 6px 28px 6px 10px;
		border: 1px solid var(--input-border, #d1d5db);
		border-radius: 4px;
		font-size: 12px;
		background: var(--input-bg, white);
		box-sizing: border-box;
	}

	.search-input:focus {
		outline: none;
		border-color: var(--focus-color, #3b82f6);
		box-shadow: 0 0 0 2px var(--focus-ring, rgba(59, 130, 246, 0.2));
	}

	.clear-search {
		position: absolute;
		right: 16px;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		color: var(--text-muted, #6b7280);
		cursor: pointer;
		padding: 2px;
		display: flex;
		align-items: center;
	}

	.sidebar-content {
		flex: 1;
		overflow-y: auto;
		padding: 4px 0;
	}

	/* Icons */
	.icon-xs {
		width: 14px;
		height: 14px;
	}

	.icon-sm {
		width: 16px;
		height: 16px;
	}

	/* Pinned section */
	.pinned-section {
		margin-bottom: 4px;
		padding-bottom: 4px;
		border-bottom: 1px solid var(--sidebar-border, #e1e4e8);
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px 2px;
		color: var(--text-muted, #6b7280);
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.pin-icon {
		color: var(--pin-color, #f59e0b);
	}

	/* Groups */
	.view-group {
		margin-bottom: 2px;
		border: 1px solid transparent;
		border-radius: 4px;
		transition: border-color 0.15s ease, background-color 0.15s ease;
	}

	.view-group.drop-target {
		background: var(--drop-target-bg, rgba(59, 130, 246, 0.06));
		border-color: var(--drop-target-border, rgba(59, 130, 246, 0.35));
		border-style: dashed;
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 6px 14px;
		background: none;
		border: none;
		cursor: pointer;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary, #4b5563);
		text-align: left;
	}

	.group-header:hover {
		background: var(--hover-bg, rgba(0, 0, 0, 0.04));
	}

	.group-header[draggable="true"] {
		cursor: grab;
	}

	.group-header[draggable="true"]:active {
		cursor: grabbing;
	}

	.group-header[role="button"] {
		user-select: none;
	}

	.group-header.static {
		cursor: default;
	}

	.group-header.static:hover {
		background: none;
	}

	.collapse-icon {
		transition: transform 0.15s ease;
		flex-shrink: 0;
	}

	.collapse-icon:not(.collapsed) {
		transform: rotate(90deg);
	}

	.group-count {
		margin-left: auto;
		color: var(--text-muted, #9ca3af);
		font-weight: normal;
		font-size: 11px;
	}

	.group-actions {
		display: none;
		align-items: center;
		gap: 1px;
		margin-left: auto;
	}

	.group-header:hover .group-actions {
		display: flex;
	}

	.group-header:hover .group-count {
		display: none;
	}

	.group-rename-row {
		padding: 4px 14px;
	}

	/* View list */
	.view-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.view-item {
		display: flex;
		align-items: center;
		padding: 0 6px 0 14px;
		position: relative;
	}

	.view-item:hover {
		background: var(--hover-bg, rgba(0, 0, 0, 0.04));
	}

	.view-item.selected {
		background: var(--selected-bg, rgba(59, 130, 246, 0.1));
	}

	.view-item[draggable="true"] {
		cursor: grab;
	}

	.view-item[draggable="true"]:active {
		cursor: grabbing;
	}

	.view-button {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 4px;
		background: none;
		border: none;
		cursor: pointer;
		font-size: 13px;
		color: var(--text-primary, #1f2937);
		text-align: left;
		min-width: 0;
	}

	.view-item.selected .view-button {
		color: var(--selected-text, #1d4ed8);
		font-weight: 500;
	}

	.view-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.modified-indicator {
		color: var(--modified-color, #f59e0b);
		font-weight: bold;
	}

	.view-meta {
		font-size: 10px;
		color: var(--text-muted, #9ca3af);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.default-badge {
		font-size: 9px;
		padding: 1px 4px;
		background: var(--badge-bg, #e5e7eb);
		color: var(--badge-text, #6b7280);
		border-radius: 3px;
		text-transform: uppercase;
		font-weight: 600;
		flex-shrink: 0;
	}

	/* Action buttons */
	.action-buttons {
		display: none;
		align-items: center;
		gap: 1px;
		flex-shrink: 0;
	}

	.view-item:hover .action-buttons {
		display: flex;
	}

	.action-btn {
		padding: 3px;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-muted, #9ca3af);
		border-radius: 3px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.action-btn:hover {
		background: var(--hover-bg, rgba(0, 0, 0, 0.08));
		color: var(--text-secondary, #4b5563);
	}

	.action-btn.pinned {
		color: var(--pin-color, #f59e0b);
	}

	.action-btn.delete:hover {
		color: var(--delete-color, #ef4444);
		background: rgba(239, 68, 68, 0.1);
	}

	.action-btn.confirm:hover {
		color: var(--confirm-color, #22c55e);
		background: rgba(34, 197, 94, 0.1);
	}

	.action-btn.cancel:hover {
		color: var(--text-secondary, #4b5563);
	}

	/* Rename */
	.rename-row {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px;
		flex: 1;
	}

	.rename-input {
		flex: 1;
		padding: 3px 6px;
		font-size: 12px;
		border: 1px solid var(--focus-color, #3b82f6);
		border-radius: 3px;
		min-width: 0;
	}

	.rename-input:focus {
		outline: none;
		box-shadow: 0 0 0 2px var(--focus-ring, rgba(59, 130, 246, 0.2));
	}

	/* Empty state */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 32px 16px;
		color: var(--text-muted, #9ca3af);
	}

	.empty-icon {
		width: 40px;
		height: 40px;
		margin-bottom: 8px;
		opacity: 0.5;
	}

	.empty-text {
		font-size: 13px;
		font-weight: 500;
		margin: 0;
	}

	.empty-hint {
		font-size: 11px;
		margin: 4px 0 0;
		opacity: 0.7;
	}

	/* Scrollbar */
	.sidebar-content::-webkit-scrollbar {
		width: 6px;
	}

	.sidebar-content::-webkit-scrollbar-track {
		background: transparent;
	}

	.sidebar-content::-webkit-scrollbar-thumb {
		background: var(--scrollbar-thumb, #d1d5db);
		border-radius: 3px;
	}

	.sidebar-content::-webkit-scrollbar-thumb:hover {
		background: var(--scrollbar-thumb-hover, #9ca3af);
	}
</style>
