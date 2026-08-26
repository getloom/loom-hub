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

describe('listing all invitations', () => {
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
			findAll: () => {}
		} as any as InvitationRepo;

		service = new InvitationService(repo);
	});

	it('returns every invitation in the system', async () => {
		const stub = sinon.stub(repo, 'findAll').resolves([invitation]);

		const result = await service.listAllInvitations();

		expect(result).toEqual({ ok: true, data: [invitation], code: 200 });
		sinon.assert.calledOnce(stub);
	});

	it('returns an empty array when there are no invitations', async () => {
		sinon.stub(repo, 'findAll').resolves([]);

		const result = await service.listAllInvitations();

		expect(result).toEqual({ ok: true, data: [], code: 200 });
	});

	it('handles thrown errors', async () => {
		sinon.stub(repo, 'findAll').throwsException(new Error('Thrown error for testing'));

		const result = await service.listAllInvitations();

		expect(result).toEqual({
			ok: false,
			error: 'Failed to list all invitations',
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
			findById: () => {},
			delete: () => {}
		} as any as InvitationRepo;

		service = new InvitationService(repo);
	});

	it('deletes an invitation and returns the deleted row', async () => {
		sinon.stub(repo, 'findById').resolves(invitation);
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
		sinon.stub(repo, 'findById').resolves(undefined);

		const result = await service.delete('user-sub', 1);

		expect(result).toEqual({
			ok: false,
			error: 'Invitation not found',
			code: 404
		});
	});

	it('returns a conflict when the invitation is accepted', async () => {
		sinon.stub(repo, 'findById').resolves({ ...invitation, status: 'accepted' });
		const deleteStub = sinon.stub(repo, 'delete').resolves(invitation);

		const result = await service.delete('user-sub', 1);

		expect(result).toEqual({
			ok: false,
			error: 'Invitation cannot be deleted in its current status',
			code: 409
		});
		sinon.assert.notCalled(deleteStub);
	});

	it('returns a conflict when the invitation is revoked', async () => {
		sinon.stub(repo, 'findById').resolves({ ...invitation, status: 'revoked' });
		const deleteStub = sinon.stub(repo, 'delete').resolves(invitation);

		const result = await service.delete('user-sub', 1);

		expect(result).toEqual({
			ok: false,
			error: 'Invitation cannot be deleted in its current status',
			code: 409
		});
		sinon.assert.notCalled(deleteStub);
	});

	it('handles thrown errors', async () => {
		sinon.stub(repo, 'findById').resolves(invitation);
		sinon.stub(repo, 'delete').throwsException(new Error('Thrown error for testing'));

		const result = await service.delete('user-sub', 1);

		expect(result).toEqual({
			ok: false,
			error: 'Failed to delete invitation',
			code: 500
		});
	});

	describe('expiring overdue invitations', () => {
		let service: InvitationService;
		let repo: InvitationRepo;

		beforeEach(() => {
			repo = {
				expireOverdue: () => {}
			} as any as InvitationRepo;

			service = new InvitationService(repo);
		});

		it('returns the invitations that were expired', async () => {
			const expired: Invitation[] = [
				{
					invite_id: 1,
					invite_code: 'abc123',
					created_by: 'user-sub',
					used_by: null,
					status: 'expired',
					expires_at: new Date('2020-01-01'),
					created_at: new Date(),
					updated_at: new Date()
				}
			];
			sinon.stub(repo, 'expireOverdue').resolves(expired);

			const result = await service.expireOverdue();

			expect(result).toEqual({ ok: true, data: expired, code: 200 });
		});

		it('returns an empty array when nothing is overdue', async () => {
			sinon.stub(repo, 'expireOverdue').resolves([]);

			const result = await service.expireOverdue();

			expect(result).toEqual({ ok: true, data: [], code: 200 });
		});

		it('handles thrown errors', async () => {
			sinon.stub(repo, 'expireOverdue').throwsException(new Error('Thrown error for testing'));

			const result = await service.expireOverdue();

			expect(result).toEqual({
				ok: false,
				error: 'Failed to expire overdue invitations',
				code: 500
			});
		});
	});
});

describe('revoking an invitation', () => {
	let service: InvitationService;
	let repo: InvitationRepo;
	let keycloakAdmin: { deactivateUser: sinon.SinonStub };

	const invitation: Invitation = {
		invite_id: 1,
		invite_code: 'abc123',
		created_by: 'user-sub',
		used_by: 'keycloak-sub-1',
		status: 'accepted',
		expires_at: new Date('2027-01-01'),
		created_at: new Date(),
		updated_at: null
	};

	beforeEach(() => {
		repo = {
			findByIdAdmin: () => {},
			revoke: () => {}
		} as any as InvitationRepo;

		keycloakAdmin = { deactivateUser: sinon.stub() };
		service = new InvitationService(repo, keycloakAdmin);
	});

	it('deactivates the Keycloak user and revokes the invitation', async () => {
		sinon.stub(repo, 'findByIdAdmin').resolves(invitation);
		keycloakAdmin.deactivateUser.resolves();
		const revokeStub = sinon.stub(repo, 'revoke').resolves({ ...invitation, status: 'revoked' });

		const result = await service.revoke(1);

		expect(result).toEqual({ ok: true, data: { ...invitation, status: 'revoked' }, code: 200 });
		sinon.assert.calledWith(keycloakAdmin.deactivateUser, 'keycloak-sub-1');
		sinon.assert.calledWith(revokeStub, 1);
	});

	it('handles validation errors when invite_id is not a positive integer', async () => {
		const zero = await service.revoke(0);
		const negative = await service.revoke(-1);
		const nonInteger = await service.revoke(1.5);

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
		sinon.stub(repo, 'findByIdAdmin').resolves(undefined);

		const result = await service.revoke(1);

		expect(result).toEqual({ ok: false, error: 'Invitation not found', code: 404 });
		sinon.assert.notCalled(keycloakAdmin.deactivateUser);
	});

	it('returns a conflict when the invitation is not accepted, without touching Keycloak', async () => {
		sinon.stub(repo, 'findByIdAdmin').resolves({ ...invitation, status: 'pending' });
		const revokeStub = sinon.stub(repo, 'revoke').resolves(invitation);

		const result = await service.revoke(1);

		expect(result).toEqual({
			ok: false,
			error: 'Invitation cannot be revoked in its current status',
			code: 422
		});
		sinon.assert.notCalled(keycloakAdmin.deactivateUser);
		sinon.assert.notCalled(revokeStub);
	});

	it('returns 500 and does not revoke in the DB when Keycloak deactivation fails', async () => {
		sinon.stub(repo, 'findByIdAdmin').resolves(invitation);
		keycloakAdmin.deactivateUser.rejects(new Error('Keycloak unreachable'));
		const revokeStub = sinon.stub(repo, 'revoke').resolves({ ...invitation, status: 'revoked' });

		const result = await service.revoke(1);

		expect(result).toEqual({ ok: false, error: 'Failed to deactivate user', code: 500 });
		sinon.assert.notCalled(revokeStub);
	});

	it('returns not found when the repo revoke finds no matching row (race)', async () => {
		sinon.stub(repo, 'findByIdAdmin').resolves(invitation);
		keycloakAdmin.deactivateUser.resolves();
		sinon.stub(repo, 'revoke').resolves(undefined);

		const result = await service.revoke(1);

		expect(result).toEqual({ ok: false, error: 'Invitation not found', code: 404 });
	});

	it('handles thrown errors', async () => {
		sinon.stub(repo, 'findByIdAdmin').throwsException(new Error('Thrown error for testing'));

		const result = await service.revoke(1);

		expect(result).toEqual({ ok: false, error: 'Failed to revoke invitation', code: 500 });
	});
});
