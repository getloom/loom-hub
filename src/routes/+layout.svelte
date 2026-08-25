<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { AppBar, AppLayout, NavItem } from 'svelte-ux';
	import IconMdiEmailOutline from '~icons/mdi/email-outline';
	import IconMdiShieldAccountOutline from '~icons/mdi/shield-account-outline';

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
				icon={IconMdiEmailOutline}
			/>
			{#if data.isAdmin}
				<NavItem
					currentUrl={page.url}
					path="/admin"
					text="Admin"
					class="mt-2 justify-center font-bold transition-shadow duration-200 hover:shadow-[0_0_10px_var(--color-primary)]"
					icon={IconMdiShieldAccountOutline}
				/>
			{/if}
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
