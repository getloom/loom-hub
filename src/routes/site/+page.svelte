<script lang="ts">
	import { Button, Table } from 'svelte-ux';
	import { invalidateAll } from '$app/navigation';
	import type { ColumnDef } from '@layerstack/svelte-table';
	import type { SiteDeploy } from '$lib/system/site/siteService';

	let { data } = $props();
	let deploys: SiteDeploy[] = $derived(data.deploys);

	let selectedFile = $state<File | null>(null);
	let uploading = $state(false);
	let error = $state<string | null>(null);
	let fileInput: HTMLInputElement;

	function onFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		selectedFile = input.files?.[0] ?? null;
	}

	async function upload() {
		if (!selectedFile) return;

		uploading = true;
		error = null;

		try {
			const formData = new FormData();
			formData.append('file', selectedFile);

			const response = await fetch('/api/site', { method: 'POST', body: formData });

			if (!response.ok) {
				const result = await response.json();
				error = result ?? 'Failed to upload site';
				return;
			}

			selectedFile = null;
			await invalidateAll();
		} catch {
			error = 'Failed to upload site';
		} finally {
			uploading = false;
		}
	}

	function formatDate(value: Date | string | null): string {
		if (!value) return '—';
		const date = value instanceof Date ? value : new Date(value);
		return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(
			date
		);
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		const units = ['KB', 'MB', 'GB'];
		let value = bytes / 1024;
		let unitIndex = 0;
		while (value >= 1024 && unitIndex < units.length - 1) {
			value /= 1024;
			unitIndex++;
		}
		return `${value.toFixed(1)} ${units[unitIndex]}`;
	}

	const columns: ColumnDef<SiteDeploy>[] = [
		{ name: 'filename', header: 'Filename' },
		{ name: 'size_bytes', header: 'Size' },
		{ name: 'file_count', header: 'Files' },
		{ name: 'deployed_by', header: 'Deployed By' },
		{ name: 'deployed_at', header: 'Deployed At' }
	];
</script>

<div class="mx-auto max-w-6xl p-6">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-bold">Site</h1>
	</div>

	<div class="mb-6 flex items-center gap-4">
		<input
			bind:this={fileInput}
			type="file"
			accept=".zip"
			class="hidden"
			onchange={onFileChange}
			disabled={uploading}
		/>
		<Button variant="outline" disabled={uploading} onclick={() => fileInput.click()}>
			{selectedFile ? selectedFile.name : 'Choose file'}
		</Button>
		<Button variant="fill" color="primary" disabled={!selectedFile || uploading} onclick={upload}>
			{uploading ? 'Uploading...' : 'Upload'}
		</Button>
	</div>

	{#if error}
		<p class="mb-4 text-red-600">{error}</p>
	{/if}

	<div class="mb-6 flex items-center justify-between">
		<h2 class="text-1xl font-bold">Deploy history</h2>
	</div>

	{#if deploys.length === 0}
		<p>No deploys found.</p>
	{:else}
		<Table
			{columns}
			data={deploys}
			classes={{
				thead: 'bg-surface-200 border-b-2 border-surface-300',
				th: 'px-4 py-2 text-left'
			}}
		>
			<svelte:fragment slot="data" let:data>
				<tbody class="[&>tr:nth-child(even)]:bg-surface-200">
					{#each data ?? [] as row (row.deploy_id)}
						<tr class="divide-x divide-surface-300">
							<td class="px-4 py-2 text-left">{row.filename}</td>
							<td class="px-4 py-2 text-left">{formatSize(row.size_bytes)}</td>
							<td class="px-4 py-2 text-left">{row.file_count}</td>
							<td class="px-4 py-2 text-left">{row.deployed_by}</td>
							<td class="px-4 py-2 text-left">{formatDate(row.deployed_at)}</td>
						</tr>
					{/each}
				</tbody>
			</svelte:fragment>
		</Table>
	{/if}
</div>
