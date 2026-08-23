import type { InvitationRepo } from '$lib/system/invitations/invitationsRepo';
import { InvitationService } from '$lib/system/invitations/invitationsService.server';
import { describe, it, expect, beforeEach } from 'vitest';
import sinon from 'sinon';
import type { Invitation } from './invitationsService';

describe('creating an invitation', () => {
	let service: InvitationService;
	let repo: InvitationRepo;

	const invitation: Invitation = {
		invite_id: 1,
		invite_code: 'abc123',
		created_by: 'user-sub',
		used_by: null,
		status: 'pending',
		expires_at: new Date('2026-11-19'),
		created_at: new Date(),
		updated_at: null
	};

	beforeEach(() => {
		repo = {
			create: () => {},
			findAllByCreator: () => {}
		} as any as InvitationRepo;

		service = new InvitationService(repo);
	});

	it('creates an invitation with a default expiration when none is provided', async () => {
		const stub = sinon.stub(repo, 'create').resolves(invitation);

		const result = await service.create('user-sub');

		expect(result).toEqual({ ok: true, data: invitation, code: 201 });
		const [createdBy, invite_code, expiresAt] = stub.firstCall.args;
		expect(createdBy).toBe('user-sub');
		const daysOut = Math.round((expiresAt!.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
		expect(daysOut).toBe(90);
	});

	it('creates an invitation with a caller-supplied expiration', async () => {
		const customExpiresAt = new Date('2027-01-01');
		const stub = sinon.stub(repo, 'create').resolves(invitation);

		const result = await service.create('user-sub', customExpiresAt);
		const [createdBy, invite_code, expiresAt] = stub.firstCall.args;

		expect(result).toEqual({ ok: true, data: invitation, code: 201 });
		sinon.assert.calledWith(stub, 'user-sub', invite_code, customExpiresAt);
	});

	it('handles validation errors', async () => {
		const result = await service.create('');

		expect(result).toEqual({
			ok: false,
			error: 'created_by is required',
			code: 400
		});
	});

	it('handles thrown errors', async () => {
		sinon.stub(repo, 'create').throwsException(new Error('Thrown error for testing'));

		const result = await service.create('user-sub');

		expect(result).toEqual({
			ok: false,
			error: 'Failed to create invitation',
			code: 500
		});
	});
});

describe('listing invitations', () => {
	let service: InvitationService;
	let repo: InvitationRepo;

	const invitation: Invitation = {
		invite_id: 1,
		invite_code: 'abc123',
		created_by: 'user-sub',
		used_by: null,
		status: 'pending',
		expires_at: new Date('2026-11-19'),
		created_at: new Date(),
		updated_at: null
	};

	beforeEach(() => {
		repo = {
			create: () => {},
			findAllByCreator: () => {}
		} as any as InvitationRepo;

		service = new InvitationService(repo);
	});

	it('returns invitations for the given creator', async () => {
		const stub = sinon.stub(repo, 'findAllByCreator').resolves([invitation]);

		const result = await service.listInvitations('user-sub');

		expect(result).toEqual({ ok: true, data: [invitation], code: 200 });
		sinon.assert.calledWith(stub, 'user-sub');
	});

	it('returns an empty array when the creator has no invitations', async () => {
		sinon.stub(repo, 'findAllByCreator').resolves([]);

		const result = await service.listInvitations('user-sub');

		expect(result).toEqual({ ok: true, data: [], code: 200 });
	});

	it('handles validation errors', async () => {
		const result = await service.listInvitations('');

		expect(result).toEqual({
			ok: false,
			error: 'created_by is required',
			code: 400
		});
	});

	it('handles thrown errors', async () => {
		sinon.stub(repo, 'findAllByCreator').throwsException(new Error('Thrown error for testing'));

		const result = await service.listInvitations('user-sub');

		expect(result).toEqual({
			ok: false,
			error: 'Failed to list invitations',
			code: 500
		});
	});
});

describe('deleting an invitation', () => {
	let service: InvitationService;
	let repo: InvitationRepo;

	const invitation: Invitation = {
		invite_id: 1,
		invite_code: 'abc123',
		created_by: 'user-sub',
		used_by: null,
		status: 'pending',
		expires_at: new Date('2027-01-01'),
		created_at: new Date(),
		updated_at: null
	};

	beforeEach(() => {
		repo = {
			create: () => {},
			findAllByCreator: () => {},
			delete: () => {}
		} as any as InvitationRepo;

		service = new InvitationService(repo);
	});

	it('deletes an invitation and returns the deleted row', async () => {
		const stub = sinon.stub(repo, 'delete').resolves(invitation);

		const result = await service.delete('user-sub', 1);

		expect(result).toEqual({ ok: true, data: invitation, code: 200 });
		sinon.assert.calledWith(stub, 1, 'user-sub');
	});

	it('handles validation errors when created_by is missing', async () => {
		const result = await service.delete('', 1);

		expect(result).toEqual({
			ok: false,
			error: 'created_by is required',
			code: 400
		});
	});

	it('handles validation errors when invite_id is not a positive integer', async () => {
		const zero = await service.delete('user-sub', 0);
		const negative = await service.delete('user-sub', -1);
		const nonInteger = await service.delete('user-sub', 1.5);

		const expected = {
			ok: false,
			error: 'invite_id must be a positive integer',
			code: 400
		};
		expect(zero).toEqual(expected);
		expect(negative).toEqual(expected);
		expect(nonInteger).toEqual(expected);
	});

	it('returns not found when the repo finds no matching row', async () => {
		sinon.stub(repo, 'delete').resolves(undefined);

		const result = await service.delete('user-sub', 1);

		expect(result).toEqual({
			ok: false,
			error: 'Invitation not found',
			code: 404
		});
	});

	it('handles thrown errors', async () => {
		sinon.stub(repo, 'delete').throwsException(new Error('Thrown error for testing'));

		const result = await service.delete('user-sub', 1);

		expect(result).toEqual({
			ok: false,
			error: 'Failed to delete invitation',
			code: 500
		});
	});
});
