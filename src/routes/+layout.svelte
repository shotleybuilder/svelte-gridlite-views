<script>
	import { page } from '$app/stores'
	import '../styles/app.css'
</script>

<nav class="gridlite-nav">
	<a href="/" class:active={$page.url.pathname === '/'}>Home</a>
	<a href="/demo" class:active={$page.url.pathname === '/demo'}>Demo</a>
	<span class="nav-title">svelte-gridlite-views dev</span>
</nav>

<slot />

<style>
	.gridlite-nav {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 12px 24px;
		background: #f8f9fa;
		border-bottom: 1px solid #dee2e6;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		font-size: 14px;
	}

	.gridlite-nav a {
		color: #495057;
		text-decoration: none;
		padding: 4px 12px;
		border-radius: 4px;
	}

	.gridlite-nav a:hover {
		background: #e9ecef;
	}

	.gridlite-nav a.active {
		background: #4c6ef5;
		color: white;
	}

	.nav-title {
		margin-left: auto;
		color: #868e96;
		font-size: 12px;
	}
</style>
