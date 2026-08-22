<script lang="ts">
	import { Table } from 'svelte-ux';
	import type { ColumnDef } from '@layerstack/svelte-table';
	import type { Invitation } from '$lib/system/invitations/invitationsService';

	let { data } = $props();
	let invitations: Invitation[] = data.invitations;

	function formatDate(value: Date | null): string {
		return value ? value.toLocaleString() : '—';
	}

	const columns: ColumnDef<Invitation>[] = [
		{ name: 'invite_code', header: 'Invite Code' },
		{ name: 'used_by', header: 'Used By', value: (row) => row.used_by ?? '—' },
		{ name: 'expires_at', header: 'Expires At', value: (row) => formatDate(row.expires_at) },
		{ name: 'created_at', header: 'Created At', value: (row) => formatDate(row.created_at) },
		{ name: 'updated_at', header: 'Updated At', value: (row) => formatDate(row.updated_at) }
	];
</script>

<div class="mx-auto max-w-6xl p-6">
	<h1 class="mb-6 text-2xl font-bold">Invitations</h1>

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
