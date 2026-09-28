<script lang="ts">
	import { Button, Dialog, TextField } from 'svelte-ux';
	import { invalidateAll } from '$app/navigation';
	import type { Post } from '$lib/system/posts/postsService';

	let { data } = $props();
	let posts: Post[] = $derived(data.posts);

	let editingPost = $state<Post | null>(null);
	let dialogOpen = $state(false);
	let title = $state('');
	let body = $state('');
	let link = $state('');
	let image = $state('');
	let submitting = $state(false);
	let error = $state<string | null>(null);

	function openCreateDialog() {
		editingPost = null;
		title = '';
		body = '';
		link = '';
		image = '';
		error = null;
		dialogOpen = true;
	}

	function openEditDialog(post: Post) {
		editingPost = post;
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
			type: 'news',
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
	<div class="mb-6 flex items-center gap-4">
		<h1 class="text-2xl font-bold">News</h1>
		{#if data.isAdmin}
			<Button variant="fill" color="primary" onclick={openCreateDialog}>Add</Button>
		{/if}
	</div>

	{#if posts.length === 0}
		<p>No posts yet.</p>
	{:else}
		<ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each posts as post (post.post_id)}
				<li class="flex h-full flex-col gap-2 rounded border border-surface-300 p-4">
					<h2 class="line-clamp-2 text-lg font-semibold">{post.title}</h2>
					{#if post.body}
						<p class="line-clamp-3 text-sm">{post.body}</p>
					{/if}
					{#if post.image}
						<img src={post.image} alt={post.title} class="h-40 w-full rounded object-cover" />
					{/if}
					<div class="mt-auto flex items-center justify-between gap-2 pt-2">
						{#if post.link}
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- post.link is an external URL, not an app route -->
							<a href={post.link}>Read more</a>
						{:else}
							<span></span>
						{/if}
						{#if data.isAdmin}
							<div class="flex gap-2">
								<Button
									variant="outline"
									size="sm"
									aria-label="Edit post {post.title}"
									onclick={() => openEditDialog(post)}
								>
									Edit
								</Button>
								<Button
									variant="outline"
									color="danger"
									size="sm"
									aria-label="Delete post {post.title}"
									onclick={() => openDeleteDialog(post)}
								>
									Delete
								</Button>
							</div>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}

	<Dialog open={dialogOpen} persistent on:close={closeDialog}>
		<div slot="title">{editingPost ? 'Edit post' : 'Add post'}</div>
		<div class="flex flex-col gap-4 p-4">
			{#if error}
				<p class="text-red-600">{error}</p>
			{/if}
			<TextField label="Title" bind:value={title} />
			<TextField label="Body" bind:value={body} />
			<TextField label="Link" bind:value={link} />
			<TextField label="Image URL" bind:value={image} />
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
