<script lang="ts">
	import { Button, Dialog, TextField } from 'svelte-ux';
	import { invalidateAll } from '$app/navigation';
	import type { Post } from '$lib/system/posts/postsService';

	let { data } = $props();
	let posts: Post[] = $derived(data.posts);

	let creatingOpen = $state(false);
	let title = $state('');
	let body = $state('');
	let link = $state('');
	let image = $state('');
	let submitting = $state(false);
	let error = $state<string | null>(null);

	function openCreateDialog() {
		creatingOpen = true;
	}

	function resetForm() {
		title = '';
		body = '';
		link = '';
		image = '';
		error = null;
	}

	function closeCreateDialog() {
		creatingOpen = false;
		resetForm();
	}

	async function handleCreate() {
		if (!title.trim()) return;

		submitting = true;
		error = null;

		try {
			const response = await fetch('/api/posts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: 'news',
					title,
					body: body.trim() || null,
					link: link.trim() || null,
					image: image.trim() || null,
					active: true
				})
			});

			if (!response.ok) {
				const result = await response.json();
				error = result.error ?? 'Failed to create post';
				return;
			}

			closeCreateDialog();
			await invalidateAll();
		} catch {
			error = 'Failed to create post';
		} finally {
			submitting = false;
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
					{#if post.link}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- post.link is an external URL, not an app route -->
						<a href={post.link} class="mt-auto pt-2">Read more</a>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	<Dialog open={creatingOpen} persistent on:close={closeCreateDialog}>
		<div slot="title">Add post</div>
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
			<Button onclick={closeCreateDialog} disabled={submitting}>Cancel</Button>
			<Button
				variant="fill"
				color="primary"
				disabled={!title.trim() || submitting}
				onclick={handleCreate}
			>
				{submitting ? 'Adding...' : 'Add'}
			</Button>
		</div>
	</Dialog>
</div>
