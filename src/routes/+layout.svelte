<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { AppBar, AppLayout, NavItem, settings } from 'svelte-ux';
	import { mdScreen } from '@layerstack/svelte-stores';
	import IconMdiEmailOutline from '~icons/mdi/email-outline';
	import IconMdiShieldAccountOutline from '~icons/mdi/shield-account-outline';
	import IconMdiWeb from '~icons/mdi/web';

	let { data, children } = $props();

	const { showDrawer } = settings();

	$effect(() => {
		$showDrawer = $mdScreen;
	});
</script>

<svelte:head>
	<title>{page.data.title ? `${page.data.title} · Hub` : 'Hub'}</title>
</svelte:head>

{#if data.isAuthenticated}
	<AppLayout>
		<svelte:fragment slot="nav">
			{#if data.isAdmin}
				<NavItem
					currentUrl={page.url}
					path="/admin"
					text="Admin"
					class="mt-2 justify-center font-bold transition-shadow duration-200 hover:shadow-[0_0_10px_var(--color-primary)]"
					icon={IconMdiShieldAccountOutline}
				/>
				<NavItem
					currentUrl={page.url}
					path="/site"
					text="Site"
					class="mt-2 justify-center font-bold transition-shadow duration-200 hover:shadow-[0_0_10px_var(--color-primary)]"
					icon={IconMdiWeb}
				/>
			{/if}
			<NavItem
				currentUrl={page.url}
				path="/invitations"
				text="Invitations"
				class="mt-2 justify-center font-bold transition-shadow duration-200 hover:shadow-[0_0_10px_var(--color-primary)]"
				icon={IconMdiEmailOutline}
			/>
		</svelte:fragment>

		<AppBar head={false} class="bg-primary text-primary-content">
			<div slot="title" class="ml-2 text-lg font-medium">
				<a href={resolve('/')}>Loom-Hub</a>
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
