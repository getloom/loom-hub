<script lang="ts">
	import { Button, Dialog, Table, TextField } from 'svelte-ux';
	import { invalidateAll } from '$app/navigation';
	import type { ColumnDef } from '@layerstack/svelte-table';
	import type { Invitation } from '$lib/system/invitations/invitationsService';
	import { DELETABLE_STATUSES } from '$lib/system/invitations/invitationsService';

	let { data } = $props();
	let invitations: Invitation[] = $derived(data.invitations);
	let creating = $state(false);
	let error = $state<string | null>(null);
	let deletingInvitation = $state<Invitation | null>(null);
	let confirmText = $state('');
	let deleting = $state(false);

	function formatDate(value: Date | null): string {
		return value ? value.toLocaleString() : '—';
	}

	function isDeletable(row: Invitation): boolean {
		return DELETABLE_STATUSES.includes(row.status);
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

	function openDeleteModal(row: Invitation) {
		deletingInvitation = row;
		confirmText = '';
	}

	function closeDeleteModal() {
		deletingInvitation = null;
		confirmText = '';
	}

	async function handleDelete() {
		if (!deletingInvitation || confirmText !== 'DELETE') return;

		deleting = true;
		error = null;

		try {
			const response = await fetch(`/api/invitations/${deletingInvitation.invite_id}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const result = await response.json();
				error = result.error ?? 'Failed to delete invitation';
				return;
			}

			closeDeleteModal();
			await invalidateAll();
		} catch {
			error = 'Failed to delete invitation';
		} finally {
			deleting = false;
		}
	}

	const columns: ColumnDef<Invitation>[] = [
		{ name: 'invite_code', header: 'Invite Code' },
		{ name: 'used_by', header: 'Used By', value: (row) => row.used_by ?? '—' },
		{ name: 'status', header: 'Status' },
		{ name: 'expires_at', header: 'Expires At', value: (row) => formatDate(row.expires_at) },
		{ name: 'created_at', header: 'Created At', value: (row) => formatDate(row.created_at) },
		{ name: 'updated_at', header: 'Updated At', value: (row) => formatDate(row.updated_at) },
		{ name: 'actions', header: 'Delete' }
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
				th: 'px-4 py-2 text-left'
			}}
		>
			<svelte:fragment slot="data" let:data>
				<tbody class="[&>tr:nth-child(even)]:bg-surface-200">
					{#each data ?? [] as row}
						<tr class="divide-x divide-surface-300">
							<td class="px-4 py-2 text-left">{row.invite_code}</td>
							<td class="px-4 py-2 text-left">{row.used_by ?? '—'}</td>
							<td class="px-4 py-2 text-left">{row.status}</td>
							<td class="px-4 py-2 text-left">{formatDate(row.expires_at)}</td>
							<td class="px-4 py-2 text-left">{formatDate(row.created_at)}</td>
							<td class="px-4 py-2 text-left">{formatDate(row.updated_at)}</td>
							<td class="px-4 py-2 text-left">
								<Button
									variant="outline"
									color="danger"
									size="sm"
									disabled={!isDeletable(row)}
									aria-label="Delete invitation {row.invite_code}"
									onclick={() => openDeleteModal(row)}
								>
									×
								</Button>
							</td>
						</tr>
					{/each}
				</tbody>
			</svelte:fragment>
		</Table>
	{/if}

	<Dialog open={deletingInvitation !== null} persistent on:close={closeDeleteModal}>
		<div slot="title">Delete invitation</div>
		<div class="p-4">
			<p class="mb-4">
				Type <strong>DELETE</strong> to permanently delete invite
				<strong>{deletingInvitation?.invite_code}</strong>. This cannot be undone.
			</p>
			<TextField label="Confirmation" bind:value={confirmText} placeholder="DELETE" />
		</div>
		<div slot="actions" class="flex justify-end gap-2 p-4">
			<Button onclick={closeDeleteModal} disabled={deleting}>Cancel</Button>
			<Button
				variant="fill"
				color="danger"
				disabled={confirmText !== 'DELETE' || deleting}
				onclick={handleDelete}
			>
				{deleting ? 'Deleting...' : 'Delete'}
			</Button>
		</div>
	</Dialog>
</div>
