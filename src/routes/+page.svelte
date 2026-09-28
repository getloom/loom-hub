<script lang="ts">
	import type { Post } from '$lib/system/posts/postsService';

	let { data } = $props();
	let posts: Post[] = $derived(data.posts);
</script>

<div class="mx-auto max-w-6xl p-6">
	<h1 class="mb-6 text-2xl font-bold">News</h1>

	{#if posts.length === 0}
		<p>No posts yet.</p>
	{:else}
		<ul class="flex flex-col gap-4">
			{#each posts as post (post.post_id)}
				<li class="rounded border border-surface-300 p-4">
					<h2 class="text-lg font-semibold">{post.title}</h2>
					{#if post.body}
						<p>{post.body}</p>
					{/if}
					{#if post.image}
						<img src={post.image} alt={post.title} />
					{/if}
					{#if post.link}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- post.link is an external URL, not an app route -->
						<a href={post.link}>Read more</a>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
