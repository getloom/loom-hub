<script lang="ts">
	import { Button } from 'svelte-ux';
	import { fade } from 'svelte/transition';
	import type { Post } from '$lib/system/posts/postsService';
	import IconMdiChevronLeft from '~icons/mdi/chevron-left';
	import IconMdiChevronRight from '~icons/mdi/chevron-right';
	import IconMdiPencil from '~icons/mdi/pencil';
	import IconMdiTrashCan from '~icons/mdi/trash-can';

	const ADVANCE_MS = 8000;

	let {
		quotes,
		isAdmin,
		onedit,
		ondelete
	}: {
		quotes: Post[];
		isAdmin: boolean;
		onedit: (post: Post) => void;
		ondelete: (post: Post) => void;
	} = $props();

	let index = $state(0);
	let paused = $state(false);

	let current = $derived(quotes[index] ?? quotes[0]);

	const duration =
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
			? 0
			: 400;

	$effect(() => {
		if (index >= quotes.length) index = 0;
	});

	$effect(() => {
		if (quotes.length < 2 || paused) return;
		// reading `index` re-creates the interval on manual navigation, resetting the timer
		void index;
		const id = setInterval(() => (index = (index + 1) % quotes.length), ADVANCE_MS);
		return () => clearInterval(id);
	});

	function go(delta: number) {
		index = (index + delta + quotes.length) % quotes.length;
	}
</script>

{#if current}
	<div
		role="region"
		aria-roledescription="carousel"
		aria-label="Quotes"
		class="flex flex-col items-center gap-3 rounded border border-surface-300 p-4"
		onmouseenter={() => (paused = true)}
		onmouseleave={() => (paused = false)}
		onfocusin={() => (paused = true)}
		onfocusout={() => (paused = false)}
	>
		<div class="flex w-full items-center gap-2">
			{#if quotes.length > 1}
				<Button
					variant="outline"
					size="sm"
					iconOnly
					icon={IconMdiChevronLeft}
					aria-label="Previous quote"
					onclick={() => go(-1)}
				/>
			{/if}
			<div class="grid min-w-0 flex-1" aria-live={paused ? 'polite' : 'off'}>
				{#key current.post_id}
					<figure
						class="flex flex-col items-center gap-2 text-center [grid-area:1/1]"
						in:fade={{ duration }}
						out:fade={{ duration }}
					>
						<blockquote class="text-lg whitespace-pre-line italic">{current.body}</blockquote>
						<figcaption class="text-sm font-semibold">
							—
							{#if current.link}
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- link is an external URL, not an app route -->
								<a href={current.link} target="_blank" rel="noopener noreferrer">{current.title}</a>
							{:else}
								{current.title}
							{/if}
						</figcaption>
					</figure>
				{/key}
			</div>
			{#if quotes.length > 1}
				<Button
					variant="outline"
					size="sm"
					iconOnly
					icon={IconMdiChevronRight}
					aria-label="Next quote"
					onclick={() => go(1)}
				/>
			{/if}
		</div>

		{#if quotes.length > 1}
			<div class="flex gap-2">
				{#each quotes as quote, i (quote.post_id)}
					<button
						type="button"
						class="size-2.5 rounded-full {i === index ? 'bg-primary' : 'bg-surface-300'}"
						aria-label="Show quote {i + 1}"
						aria-current={i === index ? 'true' : undefined}
						onclick={() => (index = i)}
					></button>
				{/each}
			</div>
		{/if}

		{#if isAdmin}
			<div class="flex gap-2">
				<Button
					variant="outline"
					size="sm"
					iconOnly
					icon={IconMdiPencil}
					aria-label="Edit post {current.title}"
					onclick={() => onedit(current)}
				/>
				<Button
					variant="outline"
					color="danger"
					size="sm"
					iconOnly
					icon={IconMdiTrashCan}
					aria-label="Delete post {current.title}"
					onclick={() => ondelete(current)}
				/>
			</div>
		{/if}
	</div>
{/if}
