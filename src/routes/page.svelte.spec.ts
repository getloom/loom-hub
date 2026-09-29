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

const motdPost: Post = {
	post_id: 2,
	type: 'motd',
	title: 'Attention please',
	body: 'MOTD body text',
	link: null,
	image: null,
	active: true,
	created_by: 'user-sub',
	created_at: new Date(),
	updated_at: null
};

const quicklinkPost: Post = {
	post_id: 3,
	type: 'quicklink',
	title: 'Handbook',
	body: 'Company handbook',
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
		render(Page, {
			data: { isAuthenticated: true, isAdmin: false, posts: [], motd: null, quicklinks: [] }
		});

		const heading = page.getByRole('heading', { level: 1, name: 'News' });
		await expect.element(heading).toBeInTheDocument();
	});

	it('renders post titles', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: false, posts: [post], motd: null, quicklinks: [] }
		});

		await expect.element(page.getByText('Hello world')).toBeInTheDocument();
	});

	it('renders an empty state with no posts', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: false, posts: [], motd: null, quicklinks: [] }
		});

		await expect.element(page.getByText('No posts yet.')).toBeInTheDocument();
	});

	it('does not show the Add button for non-admins', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: false, posts: [], motd: null, quicklinks: [] }
		});

		await expect
			.element(page.getByRole('button', { name: 'Add news post' }))
			.not.toBeInTheDocument();
	});

	it('shows the Add button for admins', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, posts: [], motd: null, quicklinks: [] }
		});

		await expect.element(page.getByRole('button', { name: 'Add news post' })).toBeInTheDocument();
	});

	it('opens the create dialog when Add is clicked', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, posts: [], motd: null, quicklinks: [] }
		});

		await page.getByRole('button', { name: 'Add news post' }).click();

		await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		await expect.element(page.getByText('Add news post')).toBeInTheDocument();
	});

	it('confirm add button is disabled until a title is entered', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, posts: [], motd: null, quicklinks: [] }
		});

		await page.getByRole('button', { name: 'Add news post' }).click();

		const confirmButton = page.getByRole('dialog').getByRole('button', { name: 'Add' });
		await expect.element(confirmButton).toBeDisabled();

		await page.getByLabelText('Title').fill('New post');
		await expect.element(confirmButton).not.toBeDisabled();
	});

	it('creates a post and refreshes the list on success', async () => {
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(post), { status: 201 }));

		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, posts: [], motd: null, quicklinks: [] }
		});

		await page.getByRole('button', { name: 'Add news post' }).click();
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

		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, posts: [], motd: null, quicklinks: [] }
		});

		await page.getByRole('button', { name: 'Add news post' }).click();
		await page.getByLabelText('Title').fill('Hello world');
		await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();

		await expect.element(page.getByText('Failed to create post')).toBeInTheDocument();
		expect(invalidateAll).not.toHaveBeenCalled();
		await expect.element(page.getByRole('dialog')).toBeInTheDocument();
	});

	it('cancel closes the dialog without creating a post', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, posts: [], motd: null, quicklinks: [] }
		});

		await page.getByRole('button', { name: 'Add news post' }).click();
		await page.getByLabelText('Title').fill('Hello world');
		await page.getByRole('button', { name: 'Cancel' }).click();

		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		expect(fetch).not.toHaveBeenCalled();
	});

	it('does not show the Delete button for non-admins', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: false, posts: [post], motd: null, quicklinks: [] }
		});

		await expect
			.element(page.getByRole('button', { name: 'Delete post Hello world' }))
			.not.toBeInTheDocument();
	});

	it('shows the Delete button for admins and opens the confirmation dialog', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, posts: [post], motd: null, quicklinks: [] }
		});

		await page.getByRole('button', { name: 'Delete post Hello world' }).click();

		const dialog = page.getByRole('dialog');
		await expect.element(dialog).toBeInTheDocument();
		await expect.element(page.getByText('Delete post')).toBeInTheDocument();
		await expect.element(dialog.getByText('Hello world')).toBeInTheDocument();
	});

	it('confirm delete button is disabled until DELETE is typed exactly', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, posts: [post], motd: null, quicklinks: [] }
		});

		await page.getByRole('button', { name: 'Delete post Hello world' }).click();

		const confirmButton = page.getByRole('dialog').getByRole('button', { name: 'Delete' });
		await expect.element(confirmButton).toBeDisabled();

		await page.getByLabelText('Confirmation').fill('delete');
		await expect.element(confirmButton).toBeDisabled();

		await page.getByLabelText('Confirmation').fill('DELETE');
		await expect.element(confirmButton).not.toBeDisabled();
	});

	it('deletes a post and refreshes the list on success', async () => {
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(post), { status: 200 }));

		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, posts: [post], motd: null, quicklinks: [] }
		});

		await page.getByRole('button', { name: 'Delete post Hello world' }).click();
		await page.getByLabelText('Confirmation').fill('DELETE');
		await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

		await expect.poll(() => invalidateAll).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenCalledWith(
			'/api/posts/1',
			expect.objectContaining({ method: 'DELETE' })
		);
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	});

	it('shows an error and does not refresh when delete fails', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: 'Failed to delete post' }), { status: 500 })
		);

		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, posts: [post], motd: null, quicklinks: [] }
		});

		await page.getByRole('button', { name: 'Delete post Hello world' }).click();
		await page.getByLabelText('Confirmation').fill('DELETE');
		await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

		await expect.element(page.getByText('Failed to delete post')).toBeInTheDocument();
		expect(invalidateAll).not.toHaveBeenCalled();
		await expect.element(page.getByRole('dialog')).toBeInTheDocument();
	});

	it('cancel closes the delete dialog without deleting the post', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, posts: [post], motd: null, quicklinks: [] }
		});

		await page.getByRole('button', { name: 'Delete post Hello world' }).click();
		await page.getByLabelText('Confirmation').fill('DELETE');

		const dialog = page.getByRole('dialog');
		await dialog.getByRole('button', { name: 'Cancel' }).click();

		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		expect(fetch).not.toHaveBeenCalled();
	});

	it('does not show the Edit button for non-admins', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: false, posts: [post], motd: null, quicklinks: [] }
		});

		await expect
			.element(page.getByRole('button', { name: 'Edit post Hello world' }))
			.not.toBeInTheDocument();
	});

	it('shows the Edit button for admins and opens the dialog pre-filled', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, posts: [post], motd: null, quicklinks: [] }
		});

		await page.getByRole('button', { name: 'Edit post Hello world' }).click();

		const dialog = page.getByRole('dialog');
		await expect.element(dialog).toBeInTheDocument();
		await expect.element(page.getByText('Edit news post')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Title')).toHaveValue('Hello world');
		await expect.element(page.getByLabelText('Body')).toHaveValue('Body text');
		await expect.element(page.getByLabelText('Link', { exact: true })).toHaveValue('');
		await expect.element(page.getByLabelText('Image URL')).toHaveValue('');
	});

	it('confirm button in edit mode reads Save', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, posts: [post], motd: null, quicklinks: [] }
		});

		await page.getByRole('button', { name: 'Edit post Hello world' }).click();

		await expect
			.element(page.getByRole('dialog').getByRole('button', { name: 'Save' }))
			.toBeInTheDocument();
	});

	it('edits a post and refreshes the list on success', async () => {
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(post), { status: 200 }));

		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, posts: [post], motd: null, quicklinks: [] }
		});

		await page.getByRole('button', { name: 'Edit post Hello world' }).click();
		await page.getByLabelText('Title').fill('Updated title');
		await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();

		await expect.poll(() => invalidateAll).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenCalledWith(
			'/api/posts/1',
			expect.objectContaining({
				method: 'PATCH',
				body: JSON.stringify({
					type: 'news',
					title: 'Updated title',
					body: 'Body text',
					link: null,
					image: null,
					active: true
				})
			})
		);
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	});

	it('shows an error and does not refresh when edit fails', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: 'Failed to update post' }), { status: 500 })
		);

		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, posts: [post], motd: null, quicklinks: [] }
		});

		await page.getByRole('button', { name: 'Edit post Hello world' }).click();
		await page.getByLabelText('Title').fill('Updated title');
		await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();

		await expect.element(page.getByText('Failed to update post')).toBeInTheDocument();
		expect(invalidateAll).not.toHaveBeenCalled();
		await expect.element(page.getByRole('dialog')).toBeInTheDocument();
	});

	it('cancel from edit mode closes the dialog without leaking values into Add', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, posts: [post], motd: null, quicklinks: [] }
		});

		await page.getByRole('button', { name: 'Edit post Hello world' }).click();
		await page.getByLabelText('Title').fill('Updated title');
		await page.getByRole('button', { name: 'Cancel' }).click();

		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		expect(fetch).not.toHaveBeenCalled();

		await page.getByRole('button', { name: 'Add news post' }).click();

		await expect.element(page.getByText('Add news post')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Title')).toHaveValue('');
	});

	it('renders an empty state with no MOTD post', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: false, posts: [], motd: null, quicklinks: [] }
		});

		await expect.element(page.getByText('No MOTD posts yet.')).toBeInTheDocument();
	});

	it('renders the MOTD post title when present', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: false, posts: [], motd: motdPost, quicklinks: [] }
		});

		await expect.element(page.getByText('Attention please')).toBeInTheDocument();
	});

	it('editing an existing MOTD post opens the dialog titled Edit MOTD', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, posts: [], motd: motdPost, quicklinks: [] }
		});

		await page.getByRole('button', { name: 'Edit post Attention please' }).click();

		await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		await expect.element(page.getByText('Edit MOTD')).toBeInTheDocument();
	});

	it('disables the Title field and hides Link/Image fields when editing the MOTD post', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, posts: [], motd: motdPost, quicklinks: [] }
		});

		await page.getByRole('button', { name: 'Edit post Attention please' }).click();

		await expect.element(page.getByLabelText('Title')).toBeDisabled();
		await expect.element(page.getByLabelText('Link', { exact: true })).not.toBeInTheDocument();
		await expect.element(page.getByLabelText('Image URL')).not.toBeInTheDocument();
	});

	it('does not show the Delete button for the MOTD post, even for admins', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, posts: [], motd: motdPost, quicklinks: [] }
		});

		await expect
			.element(page.getByRole('button', { name: 'Delete post Attention please' }))
			.not.toBeInTheDocument();
	});

	it('renders a Quicklinks heading', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: false, posts: [], motd: null, quicklinks: [] }
		});

		const heading = page.getByRole('heading', { level: 1, name: 'Quicklinks' });
		await expect.element(heading).toBeInTheDocument();
	});

	it('renders quicklink post titles', async () => {
		render(Page, {
			data: {
				isAuthenticated: true,
				isAdmin: false,
				posts: [],
				motd: null,
				quicklinks: [quicklinkPost]
			}
		});

		await expect.element(page.getByText('Handbook', { exact: true })).toBeInTheDocument();
	});

	it('renders an empty state with no quicklinks', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: false, posts: [], motd: null, quicklinks: [] }
		});

		await expect.element(page.getByText('No quicklinks yet.')).toBeInTheDocument();
	});

	it('does not show the Add button for quicklinks for non-admins', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: false, posts: [], motd: null, quicklinks: [] }
		});

		await expect
			.element(page.getByRole('button', { name: 'Add quicklink post' }))
			.not.toBeInTheDocument();
	});

	it('shows the Add button for quicklinks for admins', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, posts: [], motd: null, quicklinks: [] }
		});

		await expect
			.element(page.getByRole('button', { name: 'Add quicklink post' }))
			.toBeInTheDocument();
	});

	it('opens the create dialog titled Add quicklink post when Add is clicked', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, posts: [], motd: null, quicklinks: [] }
		});

		await page.getByRole('button', { name: 'Add quicklink post' }).click();

		await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		await expect.element(page.getByText('Add quicklink post')).toBeInTheDocument();
	});

	it('creates a quicklink post and refreshes the list on success', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify(quicklinkPost), { status: 201 })
		);

		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, posts: [], motd: null, quicklinks: [] }
		});

		await page.getByRole('button', { name: 'Add quicklink post' }).click();
		await page.getByLabelText('Title').fill('Handbook');
		await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();

		await expect.poll(() => invalidateAll).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenCalledWith(
			'/api/posts',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({
					type: 'quicklink',
					title: 'Handbook',
					body: null,
					link: null,
					image: null,
					active: true
				})
			})
		);
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	});

	it('selects an icon for a quicklink post via the icon picker', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify(quicklinkPost), { status: 201 })
		);

		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, posts: [], motd: null, quicklinks: [] }
		});

		await page.getByRole('button', { name: 'Add quicklink post' }).click();
		await page.getByLabelText('Title').fill('Handbook');

		const dialog = page.getByRole('dialog');
		await dialog.getByRole('button', { name: 'Select icon' }).click();
		await page.getByLabelText('Search icons').fill('account');
		await dialog.getByRole('button', { name: 'account', exact: true }).click();

		await expect.element(dialog.getByRole('button', { name: 'Change icon' })).toBeInTheDocument();

		await dialog.getByRole('button', { name: 'Add' }).click();

		await expect.poll(() => invalidateAll).toHaveBeenCalledTimes(1);
		const [, options] = vi.mocked(fetch).mock.calls[0];
		const payload = JSON.parse((options as RequestInit).body as string);
		expect(payload.type).toBe('quicklink');
		const iconPaths = JSON.parse(payload.image);
		expect(Array.isArray(iconPaths)).toBe(true);
		expect(iconPaths.length).toBeGreaterThan(0);
	});

	it('shows the Edit button for quicklink posts and opens the dialog pre-filled', async () => {
		render(Page, {
			data: {
				isAuthenticated: true,
				isAdmin: true,
				posts: [],
				motd: null,
				quicklinks: [quicklinkPost]
			}
		});

		await page.getByRole('button', { name: 'Edit post Handbook' }).click();

		const dialog = page.getByRole('dialog');
		await expect.element(dialog).toBeInTheDocument();
		await expect.element(page.getByText('Edit quicklink post')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Title')).toHaveValue('Handbook');
		await expect.element(page.getByLabelText('Body')).not.toBeInTheDocument();
		await expect.element(page.getByLabelText('Link', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByLabelText('Image URL')).not.toBeInTheDocument();
		await expect.element(dialog.getByRole('button', { name: 'Select icon' })).toBeInTheDocument();
	});

	it('shows the Delete button for quicklink posts and deletes on confirm', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify(quicklinkPost), { status: 200 })
		);

		render(Page, {
			data: {
				isAuthenticated: true,
				isAdmin: true,
				posts: [],
				motd: null,
				quicklinks: [quicklinkPost]
			}
		});

		await page.getByRole('button', { name: 'Delete post Handbook' }).click();

		const dialog = page.getByRole('dialog');
		await expect.element(dialog).toBeInTheDocument();
		await expect.element(page.getByText('Delete post')).toBeInTheDocument();

		await page.getByLabelText('Confirmation').fill('DELETE');
		await dialog.getByRole('button', { name: 'Delete' }).click();

		await expect.poll(() => invalidateAll).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenCalledWith(
			'/api/posts/3',
			expect.objectContaining({ method: 'DELETE' })
		);
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	});
});
