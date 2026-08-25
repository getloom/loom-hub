<script lang="ts">
	import { Table } from 'svelte-ux';
	import type { ColumnDef } from '@layerstack/svelte-table';
	import type { Invitation } from '$lib/system/invitations/invitationsService';

	let { data } = $props();
	let error = $state<string | null>(null);
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
		{ name: 'created_by', header: 'Created By', value: (row) => row.created_by },
		{ name: 'used_by', header: 'Used By', value: (row) => row.used_by ?? '—' },
		{ name: 'status', header: 'Status' },
		{ name: 'expires_at', header: 'Expires At', value: (row) => formatDate(row.expires_at) },
		{ name: 'created_at', header: 'Created At', value: (row) => formatDate(row.created_at) },
		{ name: 'updated_at', header: 'Updated At', value: (row) => formatDate(row.updated_at) },		
	];
</script>

<div class="mx-auto max-w-6xl p-6">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-bold">Admin</h1>		
	</div>

	<div class="mb-6 flex items-center justify-between">
		<h2 class="text-1xl font-bold">Invitations</h2>
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
				th: 'px-4 py-2 text-left'
			}}
		>
			<svelte:fragment slot="data" let:data>
				<tbody class="[&>tr:nth-child(even)]:bg-surface-200">
					{#each data ?? [] as row}
						<tr class="divide-x divide-surface-300">
							<td class="px-4 py-2 text-left">
								<span class="flex items-center justify-between gap-2">
									{row.invite_code}
								</span>
							</td>
							<td class="px-4 py-2 text-left">{row.created_by ?? '—'}</td>
							<td class="px-4 py-2 text-left">{row.used_by ?? '—'}</td>
							<td class="px-4 py-2 text-left">{row.status}</td>
							<td class="px-4 py-2 text-left">{formatDate(row.expires_at)}</td>
							<td class="px-4 py-2 text-left">{formatDate(row.created_at)}</td>
							<td class="px-4 py-2 text-left">{formatDate(row.updated_at)}</td>							
						</tr>
					{/each}
				</tbody>
			</svelte:fragment>
		</Table>
	{/if}

</div>

