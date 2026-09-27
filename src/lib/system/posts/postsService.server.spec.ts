import type { PostsRepo } from '$lib/system/posts/postsRepo';
import { PostsService } from '$lib/system/posts/postsService.server';
import { describe, it, expect, beforeEach } from 'vitest';
import sinon from 'sinon';
import type { Post } from './postsService';

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
