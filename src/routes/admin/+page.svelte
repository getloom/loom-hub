<script lang="ts">
	import { Table } from 'svelte-ux';
	import type { ColumnDef } from '@layerstack/svelte-table';
	import type { Invitation } from '$lib/system/invitations/invitationsService';

	let { data } = $props();
	let invitations: Invitation[] = $derived(data.invitations);

	function formatDate(value: Date | string | null): string {
		if (!value) return '—';
		const date = value instanceof Date ? value : new Date(value);
		return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(
			date
		);
	}

	const columns: ColumnDef<Invitation>[] = [
		{ name: 'invite_code', header: 'Invite Code' },
		{ name: 'created_by', header: 'Created By' },
		{ name: 'used_by', header: 'Used By', value: (row) => row.used_by ?? '—' },
		{ name: 'status', header: 'Status' },
		{
			name: 'expires_at',
			header: 'Expires',
			value: (row) => formatDate(row.expires_at),
			classes: { th: 'whitespace-nowrap' }
		},
		{
			name: 'created_at',
			header: 'Created',
			value: (row) => formatDate(row.created_at),
			classes: { th: 'whitespace-nowrap' }
		},
		{
			name: 'updated_at',
			header: 'Updated',
			value: (row) => formatDate(row.updated_at),
			classes: { th: 'whitespace-nowrap' }
		}
	];
</script>

<div class="mx-auto max-w-6xl p-6">
	<h1 class="mb-6 text-2xl font-bold">Admin · All Invitations</h1>

	{#if invitations.length === 0}
		<p>No invitations found.</p>
	{:else}
		<Table
			{columns}
			data={invitations}
			classes={{
				thead: 'bg-surface-200 border-b-2 border-surface-300',
				th: 'px-4 py-2 text-left'
			}}
		>
			<svelte:fragment slot="data" let:data>
				<tbody class="[&>tr:nth-child(even)]:bg-surface-200">
					{#each data ?? [] as row}
						<tr class="divide-x divide-surface-300">
							<td class="px-4 py-2 text-left">{row.invite_code}</td>
							<td class="px-4 py-2 text-left">{row.created_by}</td>
							<td class="px-4 py-2 text-left">{row.used_by ?? '—'}</td>
							<td class="px-4 py-2 text-left">{row.status}</td>
							<td class="px-4 py-2 text-left whitespace-nowrap">{formatDate(row.expires_at)}</td>
							<td class="px-4 py-2 text-left whitespace-nowrap">{formatDate(row.created_at)}</td>
							<td class="px-4 py-2 text-left whitespace-nowrap">{formatDate(row.updated_at)}</td>
						</tr>
					{/each}
				</tbody>
			</svelte:fragment>
		</Table>
	{/if}
</div>
