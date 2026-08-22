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
			<NavItem
				currentUrl={page.url}
				path="/invitations"
				text="Invitations"
				class="mt-2 justify-center font-bold transition-shadow duration-200 hover:shadow-[0_0_10px_var(--color-primary)]"
				icon={{
					path: 'M20,4H4C2.9,4 2,4.9 2,6V18C2,19.1 2.9,20 4,20H20C21.1,20 22,19.1 22,18V6C22,4.9 21.1,4 20,4M20,8L12,13L4,8V6L12,11L20,6V8Z'
				}}
			/>
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
