import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Post } from '$lib/system/posts/postsService';
import type { PageServerLoad } from './$types';

const create = vi.fn();

vi.mock('$lib/system/posts/postsService.server', () => ({
	PostsService: vi.fn().mockImplementation(function (this: { create: typeof create }) {
		this.create = create;
	})
}));

const { load } = await import('./+page.server');

function loadEvent(fetch: ReturnType<typeof vi.fn>): Parameters<PageServerLoad>[0] {
	return { fetch } as unknown as Parameters<PageServerLoad>[0];
}

function mockResponse(response: { ok: boolean; status?: number; body: unknown }) {
	return {
		ok: response.ok,
		status: response.status ?? (response.ok ? 200 : 500),
		json: async () => response.body
	};
}

function mockFetchByUrl(responses: {
	news: { ok: boolean; status?: number; body: unknown };
	motd: { ok: boolean; status?: number; body: unknown };
}): ReturnType<typeof vi.fn> {
	return vi.fn((url: string) => {
		if (url === '/api/posts?limit=4&type=news') {
			return Promise.resolve(mockResponse(responses.news));
		}
		if (url === '/api/posts?limit=1&type=motd') {
			return Promise.resolve(mockResponse(responses.motd));
		}
		throw new Error(`Unexpected fetch url: ${url}`);
	});
}

describe('/+page.server load', () => {
	const newsPost: Post = {
		post_id: 1,
		type: 'news',
		title: 'Hello',
		body: null,
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
		title: 'Attention',
		body: null,
		link: null,
		image: null,
		active: true,
		created_by: 'user-sub',
		created_at: new Date(),
		updated_at: null
	};

	const defaultMotdPost: Post = {
		post_id: 3,
		type: 'motd',
		title: 'Message of the Day',
		body: 'Welcome to your new Loom hub!',
		link: null,
		image: null,
		active: true,
		created_by: 'system',
		created_at: new Date(),
		updated_at: null
	};

	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		create.mockReset();
	});

	it('returns the latest news posts and the latest motd post on success', async () => {
		fetchMock = mockFetchByUrl({
			news: { ok: true, body: [newsPost] },
			motd: { ok: true, body: [motdPost] }
		});

		const result = await load(loadEvent(fetchMock));

		expect(result).toEqual({ posts: [newsPost], motd: motdPost });
		expect(fetchMock).toHaveBeenCalledWith('/api/posts?limit=4&type=news');
		expect(fetchMock).toHaveBeenCalledWith('/api/posts?limit=1&type=motd');
		expect(create).not.toHaveBeenCalled();
	});

	it('creates and returns a default motd post when there is no active motd post', async () => {
		fetchMock = mockFetchByUrl({
			news: { ok: true, body: [newsPost] },
			motd: { ok: true, body: [] }
		});
		create.mockResolvedValue({ ok: true, data: defaultMotdPost, code: 201 });

		const result = await load(loadEvent(fetchMock));

		expect(result).toEqual({ posts: [newsPost], motd: defaultMotdPost });
		expect(create).toHaveBeenCalledWith(
			'system',
			'motd',
			'Message of the Day',
			'Welcome to your new Loom hub!',
			null,
			null,
			true
		);
	});

	it('returns motd: null when there is no active motd post and creating the default fails', async () => {
		fetchMock = mockFetchByUrl({
			news: { ok: true, body: [newsPost] },
			motd: { ok: true, body: [] }
		});
		create.mockResolvedValue({ ok: false, error: 'Failed to create post', code: 500 });

		const result = await load(loadEvent(fetchMock));

		expect(result).toEqual({ posts: [newsPost], motd: null });
	});

	it('throws a SvelteKit error with the upstream status when the news fetch is not ok', async () => {
		fetchMock = mockFetchByUrl({
			news: { ok: false, status: 500, body: 'Failed to list latest posts' },
			motd: { ok: true, body: [] }
		});

		await expect(load(loadEvent(fetchMock))).rejects.toMatchObject({
			status: 500,
			body: { message: 'Failed to list latest posts' }
		});
		expect(create).not.toHaveBeenCalled();
	});

	it('throws a SvelteKit error with the upstream status when the motd fetch is not ok', async () => {
		fetchMock = mockFetchByUrl({
			news: { ok: true, body: [newsPost] },
			motd: { ok: false, status: 500, body: 'Failed to list latest posts' }
		});

		await expect(load(loadEvent(fetchMock))).rejects.toMatchObject({
			status: 500,
			body: { message: 'Failed to list latest posts' }
		});
		expect(create).not.toHaveBeenCalled();
	});
});
