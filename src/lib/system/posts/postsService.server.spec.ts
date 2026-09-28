import type { PostsRepo } from '$lib/system/posts/postsRepo';
import { PostsService } from '$lib/system/posts/postsService.server';
import { describe, it, expect, beforeEach } from 'vitest';
import sinon from 'sinon';
import type { Post } from './postsService';

const post: Post = {
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

describe('creating a post', () => {
	let service: PostsService;
	let repo: PostsRepo;

	beforeEach(() => {
		repo = { create: () => {} } as any as PostsRepo;
		service = new PostsService(repo);
	});

	it('creates a post with valid input', async () => {
		const stub = sinon.stub(repo, 'create').resolves(post);

		const result = await service.create(
			'user-sub',
			'announcement',
			'Hello',
			null,
			null,
			null,
			true
		);

		expect(result).toEqual({ ok: true, data: post, code: 201 });
		sinon.assert.calledWith(stub, 'user-sub', 'announcement', 'Hello', null, null, null, true);
	});

	it('requires created_by', async () => {
		const result = await service.create('', 'announcement', 'Hello', null, null, null, true);

		expect(result).toEqual({ ok: false, error: 'created_by is required', code: 400 });
	});

	it('requires type', async () => {
		const result = await service.create('user-sub', '', 'Hello', null, null, null, true);

		expect(result).toEqual({ ok: false, error: 'type is required', code: 400 });
	});

	it('requires title', async () => {
		const result = await service.create('user-sub', 'announcement', '', null, null, null, true);

		expect(result).toEqual({ ok: false, error: 'title is required', code: 400 });
	});

	it('handles thrown errors', async () => {
		sinon.stub(repo, 'create').throwsException(new Error('boom'));

		const result = await service.create(
			'user-sub',
			'announcement',
			'Hello',
			null,
			null,
			null,
			true
		);

		expect(result).toEqual({ ok: false, error: 'Failed to create post', code: 500 });
	});
});

describe('listing posts', () => {
	let service: PostsService;
	let repo: PostsRepo;

	beforeEach(() => {
		repo = { findAll: () => {} } as any as PostsRepo;
		service = new PostsService(repo);
	});

	it('lists posts', async () => {
		const stub = sinon.stub(repo, 'findAll').resolves([post]);

		const result = await service.list();

		expect(result).toEqual({ ok: true, data: [post], code: 200 });
		sinon.assert.calledOnce(stub);
	});

	it('handles thrown errors', async () => {
		sinon.stub(repo, 'findAll').throwsException(new Error('boom'));

		const result = await service.list();

		expect(result).toEqual({ ok: false, error: 'Failed to list posts', code: 500 });
	});
});

describe('listing latest posts', () => {
	let service: PostsService;
	let repo: PostsRepo;

	beforeEach(() => {
		repo = { findLatest: () => {} } as any as PostsRepo;
		service = new PostsService(repo);
	});

	it('lists the latest posts', async () => {
		const stub = sinon.stub(repo, 'findLatest').resolves([post]);

		const result = await service.listLatest(4);

		expect(result).toEqual({ ok: true, data: [post], code: 200 });
		sinon.assert.calledWith(stub, 4);
	});

	it('lists the latest posts filtered by type', async () => {
		const stub = sinon.stub(repo, 'findLatest').resolves([post]);

		const result = await service.listLatest(4, 'news');

		expect(result).toEqual({ ok: true, data: [post], code: 200 });
		sinon.assert.calledWith(stub, 4, 'news');
	});

	it('handles thrown errors', async () => {
		sinon.stub(repo, 'findLatest').throwsException(new Error('boom'));

		const result = await service.listLatest(4);

		expect(result).toEqual({ ok: false, error: 'Failed to list latest posts', code: 500 });
	});
});

describe('getting a post', () => {
	let service: PostsService;
	let repo: PostsRepo;

	beforeEach(() => {
		repo = { findById: () => {} } as any as PostsRepo;
		service = new PostsService(repo);
	});

	it('gets a post by id', async () => {
		const stub = sinon.stub(repo, 'findById').resolves(post);

		const result = await service.get(post.post_id);

		expect(result).toEqual({ ok: true, data: post, code: 200 });
		sinon.assert.calledWith(stub, post.post_id);
	});

	it('returns not found when missing', async () => {
		sinon.stub(repo, 'findById').resolves(undefined);

		const result = await service.get(999);

		expect(result).toEqual({ ok: false, error: 'Post not found', code: 404 });
	});

	it('handles thrown errors', async () => {
		sinon.stub(repo, 'findById').throwsException(new Error('boom'));

		const result = await service.get(post.post_id);

		expect(result).toEqual({ ok: false, error: 'Failed to get post', code: 500 });
	});
});
