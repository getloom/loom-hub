import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Post } from '$lib/system/posts/postsService';
import type { PageServerLoad } from './$types';

const { load } = await import('./+page.server');

function loadEvent(fetch: ReturnType<typeof vi.fn>): Parameters<PageServerLoad>[0] {
	return { fetch } as unknown as Parameters<PageServerLoad>[0];
}

function mockFetchImpl(response: {
	ok: boolean;
	status?: number;
	body: unknown;
}): ReturnType<typeof vi.fn> {
	return vi.fn(() =>
		Promise.resolve({
			ok: response.ok,
			status: response.status ?? (response.ok ? 200 : 500),
			json: async () => response.body
		})
	);
}

describe('/+page.server load', () => {
	const post: Post = {
		post_id: 1,
		type: 'announcement',
		title: 'Hello',
		body: null,
		link: null,
		image: null,
		active: true,
		created_by: 'user-sub',
		created_at: new Date(),
		updated_at: null
	};

	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
	});

	it('returns the latest posts on success', async () => {
		fetchMock = mockFetchImpl({ ok: true, body: [post] });

		const result = await load(loadEvent(fetchMock));

		expect(result).toEqual({ posts: [post] });
		expect(fetchMock).toHaveBeenCalledWith('/api/posts?limit=4&type=news');
	});

	it('throws a SvelteKit error with the upstream status when the fetch is not ok', async () => {
		fetchMock = mockFetchImpl({ ok: false, status: 500, body: 'Failed to list latest posts' });

		await expect(load(loadEvent(fetchMock))).rejects.toMatchObject({
			status: 500,
			body: { message: 'Failed to list latest posts' }
		});
	});
});
