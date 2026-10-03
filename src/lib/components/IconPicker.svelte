<script lang="ts">
	import { Button, Icon, TextField } from 'svelte-ux';
	import { loadIconLibrary, parseIconPaths } from '$lib/util/icons';

	let { value = $bindable('') }: { value: string } = $props();

	const RESULT_LIMIT = 60;

	let open = $state(false);
	let loading = $state(false);
	let search = $state('');
	let iconPaths = $state<Record<string, string[]> | null>(null);

	async function ensureLoaded() {
		if (iconPaths || loading) return;
		loading = true;
		iconPaths = await loadIconLibrary();
		loading = false;
	}

	function togglePicker() {
		open = !open;
		if (open) ensureLoaded();
	}

	let sortedNames = $derived(iconPaths ? Object.keys(iconPaths).sort() : []);

	let filteredNames = $derived.by(() => {
		const term = search.trim().toLowerCase();
		const names = term ? sortedNames.filter((name) => name.includes(term)) : sortedNames;
		return names.slice(0, RESULT_LIMIT);
	});

	function selectIcon(name: string) {
		if (!iconPaths) return;
		value = JSON.stringify(iconPaths[name]);
		open = false;
		search = '';
	}

	let selectedPaths = $derived(parseIconPaths(value));
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center gap-3">
		{#if selectedPaths}
			<Icon path={selectedPaths} class="size-8" />
		{:else}
			<span class="text-surface-500 text-sm">No icon selected</span>
		{/if}
		<Button variant="outline" size="sm" onclick={togglePicker}>
			{open ? 'Close' : selectedPaths ? 'Change icon' : 'Select icon'}
		</Button>
	</div>

	{#if open}
		<TextField label="Search icons" bind:value={search} placeholder="e.g. home, calendar, link" />
		{#if loading}
			<p class="text-surface-500 text-sm">Loading icons...</p>
		{:else}
			<div
				class="grid max-h-48 grid-cols-8 gap-1 overflow-y-auto rounded border border-surface-300 p-2"
			>
				{#each filteredNames as name (name)}
					<Button
						variant="outline"
						size="sm"
						iconOnly
						icon={{ path: iconPaths?.[name] ?? [] }}
						aria-label={name}
						onclick={() => selectIcon(name)}
					/>
				{/each}
				{#if filteredNames.length === 0}
					<p class="text-surface-500 col-span-full text-sm">No icons found.</p>
				{/if}
			</div>
		{/if}
	{/if}
</div>
