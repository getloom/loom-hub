import type { UsersRepo } from '$lib/system/users/usersRepo';
import { UsersService } from '$lib/system/users/usersService.server';
import { describe, it, expect, beforeEach } from 'vitest';
import sinon from 'sinon';
import type { User } from './usersService';

const user: User = {
	sub: 'kc-user-sub',
	username: 'newuser1',
	email: 'newuser1@example.com',
	email_verified: true,
	created_at: new Date(),
	updated_at: null
};

describe('upserting a user', () => {
	let service: UsersService;
	let repo: UsersRepo;

	beforeEach(() => {
		repo = { upsert: () => {} } as any as UsersRepo;
		service = new UsersService(repo);
	});

	it('creates or updates the user', async () => {
		const stub = sinon.stub(repo, 'upsert').resolves(user);

		const result = await service.upsertUser(
			'kc-user-sub',
			'newuser1',
			'newuser1@example.com',
			true
		);

		expect(result).toEqual({ ok: true, data: user, code: 200 });
		sinon.assert.calledWith(stub, 'kc-user-sub', 'newuser1', 'newuser1@example.com', true);
	});

	it('handles missing sub', async () => {
		const result = await service.upsertUser('', 'newuser1', null, false);

		expect(result).toEqual({ ok: false, error: 'sub is required', code: 400 });
	});

	it('handles missing username', async () => {
		const result = await service.upsertUser('kc-user-sub', '', null, false);

		expect(result).toEqual({ ok: false, error: 'username is required', code: 400 });
	});

	it('handles thrown errors', async () => {
		sinon.stub(repo, 'upsert').throwsException(new Error('boom'));

		const result = await service.upsertUser('kc-user-sub', 'newuser1', null, false);

		expect(result).toEqual({ ok: false, error: 'Failed to upsert user', code: 500 });
	});
});

describe('listing users', () => {
	let service: UsersService;
	let repo: UsersRepo;

	beforeEach(() => {
		repo = { findAll: () => {} } as any as UsersRepo;
		service = new UsersService(repo);
	});

	it('returns all users', async () => {
		sinon.stub(repo, 'findAll').resolves([user]);

		const result = await service.listUsers();

		expect(result).toEqual({ ok: true, data: [user], code: 200 });
	});

	it('handles thrown errors', async () => {
		sinon.stub(repo, 'findAll').throwsException(new Error('boom'));

		const result = await service.listUsers();

		expect(result).toEqual({ ok: false, error: 'Failed to list users', code: 500 });
	});
});
