import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';
import type { Post } from '$lib/system/posts/postsService';

const post: Post = {
	post_id: 1,
	type: 'announcement',
	title: 'Hello world',
	body: 'Body text',
	link: null,
	image: null,
	active: true,
	created_by: 'user-sub',
	created_at: new Date(),
	updated_at: null
};

describe('/+page.svelte', () => {
	it('renders a heading', async () => {
		render(Page, { data: { isAuthenticated: true, isAdmin: false, posts: [] } });

		const heading = page.getByRole('heading', { level: 1 });
		await expect.element(heading).toBeInTheDocument();
	});

	it('renders post titles', async () => {
		render(Page, { data: { isAuthenticated: true, isAdmin: false, posts: [post] } });

		await expect.element(page.getByText('Hello world')).toBeInTheDocument();
	});

	it('renders an empty state with no posts', async () => {
		render(Page, { data: { isAuthenticated: true, isAdmin: false, posts: [] } });

		await expect.element(page.getByText('No posts yet.')).toBeInTheDocument();
	});
});
