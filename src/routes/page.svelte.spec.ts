import { page } from 'vitest/browser';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';
import type { Post } from '$lib/system/posts/postsService';

const invalidateAll = vi.fn();

vi.mock('$app/navigation', () => ({
	invalidateAll: () => invalidateAll()
}));

const post: Post = {
	post_id: 1,
	type: 'news',
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
	beforeEach(() => {
		invalidateAll.mockReset();
		vi.stubGlobal('fetch', vi.fn());
	});

	it('renders a heading', async () => {
		render(Page, { data: { isAuthenticated: true, isAdmin: false, posts: [] } });

		const heading = page.getByRole('heading', { level: 1, name: 'News' });
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

	it('does not show the Add button for non-admins', async () => {
		render(Page, { data: { isAuthenticated: true, isAdmin: false, posts: [] } });

		await expect.element(page.getByRole('button', { name: 'Add' })).not.toBeInTheDocument();
	});

	it('shows the Add button for admins', async () => {
		render(Page, { data: { isAuthenticated: true, isAdmin: true, posts: [] } });

		await expect.element(page.getByRole('button', { name: 'Add' })).toBeInTheDocument();
	});

	it('opens the create dialog when Add is clicked', async () => {
		render(Page, { data: { isAuthenticated: true, isAdmin: true, posts: [] } });

		await page.getByRole('button', { name: 'Add' }).click();

		await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		await expect.element(page.getByText('Add post')).toBeInTheDocument();
	});

	it('confirm add button is disabled until a title is entered', async () => {
		render(Page, { data: { isAuthenticated: true, isAdmin: true, posts: [] } });

		await page.getByRole('button', { name: 'Add' }).click();

		const confirmButton = page.getByRole('dialog').getByRole('button', { name: 'Add' });
		await expect.element(confirmButton).toBeDisabled();

		await page.getByLabelText('Title').fill('New post');
		await expect.element(confirmButton).not.toBeDisabled();
	});

	it('creates a post and refreshes the list on success', async () => {
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(post), { status: 201 }));

		render(Page, { data: { isAuthenticated: true, isAdmin: true, posts: [] } });

		await page.getByRole('button', { name: 'Add' }).click();
		await page.getByLabelText('Title').fill('Hello world');
		await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();

		await expect.poll(() => invalidateAll).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenCalledWith(
			'/api/posts',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({
					type: 'news',
					title: 'Hello world',
					body: null,
					link: null,
					image: null,
					active: true
				})
			})
		);
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	});

	it('shows an error and does not refresh when create fails', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: 'Failed to create post' }), { status: 500 })
		);

		render(Page, { data: { isAuthenticated: true, isAdmin: true, posts: [] } });

		await page.getByRole('button', { name: 'Add' }).click();
		await page.getByLabelText('Title').fill('Hello world');
		await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();

		await expect.element(page.getByText('Failed to create post')).toBeInTheDocument();
		expect(invalidateAll).not.toHaveBeenCalled();
		await expect.element(page.getByRole('dialog')).toBeInTheDocument();
	});

	it('cancel closes the dialog without creating a post', async () => {
		render(Page, { data: { isAuthenticated: true, isAdmin: true, posts: [] } });

		await page.getByRole('button', { name: 'Add' }).click();
		await page.getByLabelText('Title').fill('Hello world');
		await page.getByRole('button', { name: 'Cancel' }).click();

		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		expect(fetch).not.toHaveBeenCalled();
	});
});
