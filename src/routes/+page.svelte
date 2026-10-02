<script lang="ts">
	import { Button, Dialog, Icon, TextField } from 'svelte-ux';
	import { invalidateAll } from '$app/navigation';
	import type { Post } from '$lib/system/posts/postsService';
	import { parseIconPaths } from '$lib/util/icons';
	import IconPicker from '$lib/components/IconPicker.svelte';
	import QuoteCarousel from '$lib/components/QuoteCarousel.svelte';
	import IconMdiPencil from '~icons/mdi/pencil';
	import IconMdiTrashCan from '~icons/mdi/trash-can';
	import IconMdiPlusCircle from '~icons/mdi/plus-circle';

	let { data } = $props();
	let posts: Post[] = $derived(data.posts);
	let motd: Post | null = $derived(data.motd);
	let quicklinks: Post[] = $derived(data.quicklinks);
	let quotes: Post[] = $derived(data.quotes);

	let editingPost = $state<Post | null>(null);
	let dialogOpen = $state(false);
	let dialogType = $state<Post['type']>('news');
	let title = $state('');
	let body = $state('');
	let link = $state('');
	let image = $state('');
	let submitting = $state(false);
	let error = $state<string | null>(null);

	function openCreateDialog(type: Post['type'] = 'news') {
		editingPost = null;
		dialogType = type;
		title = '';
		body = '';
		link = '';
		image = '';
		error = null;
		dialogOpen = true;
	}

	function openEditDialog(post: Post) {
		editingPost = post;
		dialogType = post.type;
		title = post.title;
		body = post.body ?? '';
		link = post.link ?? '';
		image = post.image ?? '';
		error = null;
		dialogOpen = true;
	}

	function closeDialog() {
		dialogOpen = false;
		error = null;
	}

	async function handleSubmit() {
		if (!title.trim()) return;

		submitting = true;
		error = null;

		const payload = {
			type: dialogType,
			title,
			body: body.trim() || null,
			link: link.trim() || null,
			image: image.trim() || null,
			active: true
		};

		try {
			const response = editingPost
				? await fetch(`/api/posts/${editingPost.post_id}`, {
						method: 'PATCH',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload)
					})
				: await fetch('/api/posts', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload)
					});

			if (!response.ok) {
				const result = await response.json();
				error = result.error ?? `Failed to ${editingPost ? 'update' : 'create'} post`;
				return;
			}

			closeDialog();
			await invalidateAll();
		} catch {
			error = `Failed to ${editingPost ? 'update' : 'create'} post`;
		} finally {
			submitting = false;
		}
	}

	let deletingPost = $state<Post | null>(null);
	let deleteConfirmText = $state('');
	let deleting = $state(false);
	let deleteError = $state<string | null>(null);

	function openDeleteDialog(post: Post) {
		deletingPost = post;
		deleteConfirmText = '';
		deleteError = null;
	}

	function closeDeleteDialog() {
		deletingPost = null;
		deleteConfirmText = '';
		deleteError = null;
	}

	async function handleDelete() {
		if (!deletingPost || deleteConfirmText !== 'DELETE') return;

		deleting = true;
		deleteError = null;

		try {
			const response = await fetch(`/api/posts/${deletingPost.post_id}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const result = await response.json();
				deleteError = result.error ?? 'Failed to delete post';
				return;
			}

			closeDeleteDialog();
			await invalidateAll();
		} catch {
			deleteError = 'Failed to delete post';
		} finally {
			deleting = false;
		}
	}
</script>

<div class="mx-auto max-w-6xl p-6">
	{#snippet postCard(post: Post)}
		<li class="flex h-full flex-col gap-2 rounded border border-surface-300 p-4">
			{#if post.type === 'motd'}
				<div class="flex items-center gap-2">
					<h2 class="line-clamp-2 text-lg font-semibold">{post.title}</h2>
					{#if data.isAdmin}
						<Button
							variant="outline"
							size="sm"
							iconOnly
							icon={IconMdiPencil}
							aria-label="Edit post {post.title}"
							onclick={() => openEditDialog(post)}
						/>
					{/if}
				</div>
			{:else}
				<h2 class="line-clamp-2 text-lg font-semibold">{post.title}</h2>
			{/if}
			{#if post.body}
				<p class="line-clamp-3 text-sm">{post.body}</p>
			{/if}
			{#if post.image}
				<img src={post.image} alt={post.title} class="h-40 w-full rounded object-cover" />
			{/if}
			<div class="mt-auto flex items-center justify-between gap-2 pt-2">
				{#if post.link}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- post.link is an external URL, not an app route -->
					<a href={post.link} target="_blank" rel="noopener noreferrer">Read more</a>
				{:else}
					<span></span>
				{/if}
				{#if data.isAdmin && post.type !== 'motd'}
					<div class="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							iconOnly
							icon={IconMdiPencil}
							aria-label="Edit post {post.title}"
							onclick={() => openEditDialog(post)}
						/>
						<Button
							variant="outline"
							color="danger"
							size="sm"
							iconOnly
							icon={IconMdiTrashCan}
							aria-label="Delete post {post.title}"
							onclick={() => openDeleteDialog(post)}
						/>
					</div>
				{/if}
			</div>
		</li>
	{/snippet}

	{#snippet postCardCompact(post: Post)}
		{@const iconPaths = parseIconPaths(post.image)}
		<li
			class="relative flex aspect-square flex-col gap-1 overflow-hidden rounded border border-surface-300 p-2 {post.link
				? 'transition-shadow duration-200 hover:shadow-[0_0_12px_var(--color-primary)]'
				: ''}"
		>
			{#if post.link}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- post.link is an external URL, not an app route -->
				<a
					href={post.link}
					target="_blank"
					rel="noopener noreferrer"
					class="absolute inset-0 z-10 rounded"
					aria-label={post.title}
				></a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
			<h2 class="line-clamp-2 text-center text-base font-semibold">{post.title}</h2>
			{#if post.body}
				<p class="line-clamp-2 text-center text-xs">{post.body}</p>
			{/if}
			{#if iconPaths}
				<Icon path={iconPaths} class="self-center {data.isAdmin ? 'size-10' : 'size-14'}" />
			{/if}
			{#if data.isAdmin}
				<div class="relative z-20 mt-auto flex justify-end gap-2 pt-2">
					<Button
						variant="outline"
						size="sm"
						iconOnly
						icon={IconMdiPencil}
						aria-label="Edit post {post.title}"
						onclick={() => openEditDialog(post)}
					/>
					<Button
						variant="outline"
						color="danger"
						size="sm"
						iconOnly
						icon={IconMdiTrashCan}
						aria-label="Delete post {post.title}"
						onclick={() => openDeleteDialog(post)}
					/>
				</div>
			{/if}
		</li>
	{/snippet}

	{#if motd}
		<ul class="mb-2 grid grid-cols-1 gap-4">
			{@render postCard(motd)}
		</ul>
	{:else}
		<p class="mb-2">No MOTD posts yet.</p>
	{/if}

	<div class="mb-2 flex items-center gap-4">
		<h1 class="text-2xl font-bold">News</h1>
		{#if data.isAdmin}
			<Button
				variant="fill"
				color="primary"
				iconOnly
				icon={IconMdiPlusCircle}
				aria-label="Add news post"
				onclick={() => openCreateDialog('news')}
			/>
		{/if}
	</div>

	{#if posts.length === 0}
		<p>No posts yet.</p>
	{:else}
		<ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each posts as post (post.post_id)}
				{@render postCard(post)}
			{/each}
		</ul>
	{/if}

	<div class="mt-2 mb-4 flex items-center gap-4">
		<h1 class="text-2xl font-bold">Quicklinks</h1>
		{#if data.isAdmin}
			<Button
				variant="fill"
				color="primary"
				iconOnly
				icon={IconMdiPlusCircle}
				aria-label="Add quicklink post"
				onclick={() => openCreateDialog('quicklink')}
			/>
		{/if}
	</div>

	{#if quicklinks.length === 0}
		<p>No quicklinks yet.</p>
	{:else}
		<ul class="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
			{#each quicklinks as post (post.post_id)}
				{@render postCardCompact(post)}
			{/each}
		</ul>
	{/if}

	<div class="mt-4 mb-4 flex items-center gap-4">
		<h1 class="text-2xl font-bold">Quotes</h1>
		{#if data.isAdmin}
			<Button
				variant="fill"
				color="primary"
				iconOnly
				icon={IconMdiPlusCircle}
				aria-label="Add quote post"
				onclick={() => openCreateDialog('quote')}
			/>
		{/if}
	</div>

	{#if quotes.length === 0}
		<p>No quotes yet.</p>
	{:else}
		<QuoteCarousel
			{quotes}
			isAdmin={data.isAdmin}
			onedit={openEditDialog}
			ondelete={openDeleteDialog}
		/>
	{/if}

	<Dialog open={dialogOpen} persistent on:close={closeDialog}>
		<div slot="title">
			{editingPost ? 'Edit' : 'Add'}
			{dialogType === 'motd'
				? 'MOTD'
				: dialogType === 'quicklink'
					? 'quicklink post'
					: dialogType === 'quote'
						? 'quote'
						: 'news post'}
		</div>
		<div class="flex flex-col gap-4 p-4">
			{#if error}
				<p class="text-red-600">{error}</p>
			{/if}
			<TextField
				label={dialogType === 'quote' ? 'Author' : 'Title'}
				bind:value={title}
				disabled={dialogType === 'motd'}
			/>
			{#if dialogType !== 'quicklink'}
				<TextField
					label={dialogType === 'quote' ? 'Quote' : 'Body'}
					bind:value={body}
					multiline
					classes={{ input: 'min-h-24' }}
				/>
			{/if}
			{#if dialogType !== 'motd'}
				<TextField label="Link" bind:value={link} />
				{#if dialogType === 'quicklink'}
					<IconPicker bind:value={image} />
				{:else if dialogType === 'news'}
					<TextField label="Image URL" bind:value={image} />
				{/if}
			{/if}
		</div>
		<div slot="actions" class="flex justify-end gap-2 p-4">
			<Button onclick={closeDialog} disabled={submitting}>Cancel</Button>
			<Button
				variant="fill"
				color="primary"
				disabled={!title.trim() || submitting}
				onclick={handleSubmit}
			>
				{submitting ? 'Saving...' : editingPost ? 'Save' : 'Add'}
			</Button>
		</div>
	</Dialog>

	<Dialog open={deletingPost !== null} persistent on:close={closeDeleteDialog}>
		<div slot="title">Delete post</div>
		<div class="p-4">
			{#if deleteError}
				<p class="mb-4 text-red-600">{deleteError}</p>
			{/if}
			<p class="mb-4">
				Type <strong>DELETE</strong> to permanently delete
				<strong>{deletingPost?.title}</strong>. This cannot be undone.
			</p>
			<TextField label="Confirmation" bind:value={deleteConfirmText} placeholder="DELETE" />
		</div>
		<div slot="actions" class="flex justify-end gap-2 p-4">
			<Button onclick={closeDeleteDialog} disabled={deleting}>Cancel</Button>
			<Button
				variant="fill"
				color="danger"
				disabled={deleteConfirmText !== 'DELETE' || deleting}
				onclick={handleDelete}
			>
				{deleting ? 'Deleting...' : 'Delete'}
			</Button>
		</div>
	</Dialog>
</div>
