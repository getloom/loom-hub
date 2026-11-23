<script lang="ts">
	import { Button, Checkbox, Dialog, Table, TextField } from 'svelte-ux';
	import { invalidateAll } from '$app/navigation';
	import type { ColumnDef } from '@layerstack/svelte-table';
	import type {
		InvitationId,
		InvitationWithUsernames
	} from '$lib/system/invitations/invitationsService';
	import {
		INVITE_CODE_MAX_LENGTH,
		MAX_USES_UPPER_BOUND,
		isDeletable
	} from '$lib/system/invitations/invitationsService';
	import IconMdiContentCopy from '~icons/mdi/content-copy';
	import IconMdiCheck from '~icons/mdi/check';

	let { data } = $props();
	let invitations: InvitationWithUsernames[] = $derived(data.invitations);
	let creating = $state(false);
	let createOpen = $state(false);
	let customCode = $state('');
	let maxUses = $state<string | number | null>('1');
	let unlimited = $state(false);
	let createError = $state<string | null>(null);
	let error = $state<string | null>(null);
	let deletingInvitation = $state<InvitationWithUsernames | null>(null);
	let confirmText = $state('');
	let deleting = $state(false);
	let copiedInviteId = $state<InvitationId | null>(null);

	function errorMessage(result: unknown, fallback: string): string {
		if (typeof result === 'string') return result;
		const message = (result as { error?: string } | null)?.error;
		return message ?? fallback;
	}

	function formatDate(value: Date | null): string {
		return value ? value.toLocaleString() : '—';
	}

	function formatUses(row: InvitationWithUsernames): string {
		return `${row.use_count} / ${row.max_uses ?? '∞'}`;
	}

	function formatRedeemers(row: InvitationWithUsernames): string {
		return row.redemptions.map((r) => r.username ?? r.user_sub).join(', ') || '—';
	}

	async function copyInviteCode(row: InvitationWithUsernames) {
		await navigator.clipboard.writeText(row.invite_code);
		copiedInviteId = row.invite_id;
		setTimeout(() => {
			if (copiedInviteId === row.invite_id) copiedInviteId = null;
		}, 1500);
	}

	function openCreateModal() {
		customCode = '';
		maxUses = '1';
		unlimited = false;
		createError = null;
		createOpen = true;
	}

	function closeCreateModal() {
		createOpen = false;
		customCode = '';
		maxUses = '1';
		unlimited = false;
		createError = null;
	}

	async function handleCreate() {
		createError = null;

		const parsedMaxUses = unlimited ? null : Number(maxUses);
		if (
			parsedMaxUses !== null &&
			(!Number.isInteger(parsedMaxUses) ||
				parsedMaxUses < 1 ||
				parsedMaxUses > MAX_USES_UPPER_BOUND)
		) {
			createError = 'Max uses must be a whole number of at least 1, or unlimited';
			return;
		}

		creating = true;

		try {
			const response = await fetch('/api/invitations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					invite_code: (customCode ?? '').trim() || undefined,
					max_uses: parsedMaxUses
				})
			});

			if (!response.ok) {
				const result = await response.json();
				createError = errorMessage(result, 'Failed to create invitation');
				return;
			}

			closeCreateModal();
			await invalidateAll();
		} catch {
			createError = 'Failed to create invitation';
		} finally {
			creating = false;
		}
	}

	function openDeleteModal(row: InvitationWithUsernames) {
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
				error = errorMessage(result, 'Failed to delete invitation');
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

	const columns: ColumnDef<InvitationWithUsernames>[] = [
		{ name: 'invite_code', header: 'Invite Code' },
		{ name: 'uses', header: 'Uses', value: (row) => formatUses(row) },
		{ name: 'used_by', header: 'Used By', value: (row) => formatRedeemers(row) },
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
		<div class="flex items-center gap-2">
			<Button variant="fill" color="primary" onclick={openCreateModal}>Create</Button>
		</div>
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
									<Button
										variant="fill-light"
										color={copiedInviteId === row.invite_id ? 'success' : 'default'}
										size="sm"
										iconOnly
										icon={copiedInviteId === row.invite_id ? IconMdiCheck : IconMdiContentCopy}
										aria-label="Copy invite code {row.invite_code}"
										onclick={() => copyInviteCode(row)}
									/>
								</span>
							</td>
							<td class="px-4 py-2 text-left">{formatUses(row)}</td>
							<td class="px-4 py-2 text-left">{formatRedeemers(row)}</td>
							<td class="px-4 py-2 text-left">{row.status}</td>
							<td class="px-4 py-2 text-left">{formatDate(row.expires_at)}</td>
							<td class="px-4 py-2 text-left">{formatDate(row.created_at)}</td>
							<td class="px-4 py-2 text-left">{formatDate(row.updated_at)}</td>
							<td class="px-4 py-2 text-center">
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

	<Dialog open={createOpen} persistent on:close={closeCreateModal}>
		<div slot="title">Create invitation</div>
		<div class="p-4">
			<TextField
				label="Custom code (optional)"
				bind:value={customCode}
				maxlength={INVITE_CODE_MAX_LENGTH}
				hint="Leave blank to generate a random code"
			/>
			<div class="mt-4 flex items-start gap-4">
				<TextField
					label="Max uses"
					type="integer"
					bind:value={maxUses}
					disabled={unlimited}
					hint="How many users can register with this code"
				/>
				<Checkbox bind:checked={unlimited}>Unlimited</Checkbox>
			</div>
			{#if createError}
				<p class="mt-2 text-red-600">{createError}</p>
			{/if}
		</div>
		<div slot="actions" class="flex justify-end gap-2 p-4">
			<Button onclick={closeCreateModal} disabled={creating}>Cancel</Button>
			<Button variant="fill" color="primary" disabled={creating} onclick={handleCreate}>
				{creating ? 'Creating...' : 'Create'}
			</Button>
		</div>
	</Dialog>

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
