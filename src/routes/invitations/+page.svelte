<script lang="ts">
	import { Button, Table } from 'svelte-ux';
	import { invalidateAll } from '$app/navigation';
	import type { ColumnDef } from '@layerstack/svelte-table';
	import type { Invitation } from '$lib/system/invitations/invitationsService';

	let { data } = $props();
	let invitations: Invitation[] = $derived(data.invitations);
	let creating = $state(false);
	let error = $state<string | null>(null);

	function formatDate(value: Date | null): string {
		return value ? value.toLocaleString() : '—';
	}

	async function handleCreate() {
		creating = true;
		error = null;

		try {
			const response = await fetch('/api/invitations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({})
			});

			if (!response.ok) {
				const result = await response.json();
				error = result.error ?? 'Failed to create invitation';
				return;
			}

			await invalidateAll();
		} catch {
			error = 'Failed to create invitation';
		} finally {
			creating = false;
		}
	}

	const columns: ColumnDef<Invitation>[] = [
		{ name: 'invite_code', header: 'Invite Code' },
		{ name: 'used_by', header: 'Used By', value: (row) => row.used_by ?? '—' },
		{ name: 'status', header: 'Status' },
		{ name: 'expires_at', header: 'Expires At', value: (row) => formatDate(row.expires_at) },
		{ name: 'created_at', header: 'Created At', value: (row) => formatDate(row.created_at) },
		{ name: 'updated_at', header: 'Updated At', value: (row) => formatDate(row.updated_at) }
	];
</script>

<div class="mx-auto max-w-6xl p-6">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-bold">Invitations</h1>
		<Button variant="fill" color="primary" disabled={creating} onclick={handleCreate}>
			{creating ? 'Creating...' : 'Create'}
		</Button>
	</div>

	{#if error}
		<p class="mb-4 text-red-600">{error}</p>
	{/if}

	{#if invitations.length === 0}
		<p>No invitations found.</p>
	{:else}
		<Table
			{columns}
			data={invitations}
			classes={{
				thead: 'bg-surface-200 border-b-2 border-surface-300',
				tbody: '[&>tr:nth-child(even)]:bg-surface-200',
				tr: 'divide-x divide-surface-300',
				th: 'px-4 py-2 text-left',
				td: 'px-4 py-2 text-left'
			}}
		/>
	{/if}
</div>
