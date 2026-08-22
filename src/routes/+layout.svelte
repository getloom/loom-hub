<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { AppBar, AppLayout, NavItem } from 'svelte-ux';

	let { data, children } = $props();
</script>

{#if data.isAuthenticated}
	<AppLayout>
		<svelte:fragment slot="nav">
			<NavItem currentUrl={page.url} path="/invitations" text="Invitations" />
		</svelte:fragment>

		<AppBar title="Loom" class="bg-primary text-primary-content">
			<div slot="title" class="ml-2 text-lg font-medium">
				<a href={resolve('/')}>Loom</a>
			</div>
			<div slot="actions">
				<a href="/auth/logout">Sign out</a>
			</div>
		</AppBar>

		<main>
			{@render children()}
		</main>
	</AppLayout>
{:else}
	<main>
		{@render children()}
	</main>
{/if}
