import type { InvitationRepo } from '$lib/system/invitations/invitationsRepo';
import { InvitationService } from '$lib/system/invitations/invitationsService.server';
import type { SettingsService } from '$lib/system/settings/settingsService.server';
import { describe, it, expect, beforeEach } from 'vitest';
import sinon from 'sinon';
import type { Invitation } from './invitationsService';

function fakeSettingsService(overrides: Record<string, string> = {}): SettingsService {
	const values: Record<string, string> = {
		invite_count_limit: '1000',
		invite_count_cycle: 'lifetime',
		...overrides
	};

	return {
		getSetting: (key: string) =>
			Promise.resolve(
				key in values
					? {
							ok: true,
							data: { key, value: values[key], created_at: new Date(), updated_at: null },
							code: 200
						}
					: { ok: false, error: 'Setting not found', code: 404 }
			)
	} as any as SettingsService;
}

describe('creating an invitation', () => {
	let service: InvitationService;
	let repo: InvitationRepo;
	let settingsService: SettingsService;

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
			findAllByCreator: () => {},
			countActiveByCreatorSince: () => {}
		} as any as InvitationRepo;
		sinon.stub(repo, 'countActiveByCreatorSince').resolves(0);

		settingsService = fakeSettingsService();

		service = new InvitationService(repo, undefined, settingsService);
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

describe('enforcing the invite count limit', () => {
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
			countActiveByCreatorSince: () => {}
		} as any as InvitationRepo;
		sinon.stub(repo, 'create').resolves(invitation);
	});

	function build(settingsService: SettingsService) {
		service = new InvitationService(repo, undefined, settingsService);
	}

	it('allows creation when the count is below the limit', async () => {
		sinon.stub(repo, 'countActiveByCreatorSince').resolves(1);
		build(fakeSettingsService({ invite_count_limit: '2', invite_count_cycle: 'lifetime' }));

		const result = await service.create('user-sub');

		expect(result).toEqual({ ok: true, data: invitation, code: 201 });
		sinon.assert.calledOnce(repo.create as sinon.SinonStub);
	});

	it('rejects with 429 when the count is at the limit', async () => {
		sinon.stub(repo, 'countActiveByCreatorSince').resolves(2);
		build(fakeSettingsService({ invite_count_limit: '2', invite_count_cycle: 'lifetime' }));

		const result = await service.create('user-sub');

		expect(result).toEqual({
			ok: false,
			error: 'Invite creation limit reached for the current cycle',
			code: 429
		});
		sinon.assert.notCalled(repo.create as sinon.SinonStub);
	});

	it('rejects with 429 when the count is above the limit', async () => {
		sinon.stub(repo, 'countActiveByCreatorSince').resolves(3);
		build(fakeSettingsService({ invite_count_limit: '2', invite_count_cycle: 'lifetime' }));

		const result = await service.create('user-sub');

		expect(result).toEqual({
			ok: false,
			error: 'Invite creation limit reached for the current cycle',
			code: 429
		});
		sinon.assert.notCalled(repo.create as sinon.SinonStub);
	});

	it('lets a founder bypass the check entirely, without touching settings or the count', async () => {
		const settingsService = fakeSettingsService();
		const getSettingSpy = sinon.spy(settingsService, 'getSetting');
		const countStub = sinon.stub(repo, 'countActiveByCreatorSince').resolves(9999);
		build(settingsService);

		const result = await service.create('user-sub', undefined, ['founder']);

		expect(result).toEqual({ ok: true, data: invitation, code: 201 });
		sinon.assert.notCalled(getSettingSpy);
		sinon.assert.notCalled(countStub);
		sinon.assert.calledOnce(repo.create as sinon.SinonStub);
	});

	it('does not bypass the check for a non-exempt role', async () => {
		sinon.stub(repo, 'countActiveByCreatorSince').resolves(2);
		build(fakeSettingsService({ invite_count_limit: '2', invite_count_cycle: 'lifetime' }));

		const result = await service.create('user-sub', undefined, ['member']);

		expect(result).toEqual({
			ok: false,
			error: 'Invite creation limit reached for the current cycle',
			code: 429
		});
	});

	it('resolves a since date roughly one year back for the year cycle', async () => {
		const countStub = sinon.stub(repo, 'countActiveByCreatorSince').resolves(0);
		build(fakeSettingsService({ invite_count_limit: '2', invite_count_cycle: 'year' }));

		await service.create('user-sub');

		const [createdBy, since] = countStub.firstCall.args;
		expect(createdBy).toBe('user-sub');
		expect(since).not.toBeNull();
		const yearsBack = (Date.now() - since!.getTime()) / (1000 * 60 * 60 * 24 * 365);
		expect(yearsBack).toBeGreaterThan(0.99);
		expect(yearsBack).toBeLessThan(1.01);
	});

	it('resolves a since date roughly one month back for the month cycle', async () => {
		const countStub = sinon.stub(repo, 'countActiveByCreatorSince').resolves(0);
		build(fakeSettingsService({ invite_count_limit: '2', invite_count_cycle: 'month' }));

		await service.create('user-sub');

		const [, since] = countStub.firstCall.args;
		expect(since).not.toBeNull();
		const daysBack = (Date.now() - since!.getTime()) / (1000 * 60 * 60 * 24);
		expect(daysBack).toBeGreaterThan(25);
		expect(daysBack).toBeLessThan(32);
	});

	it('passes a null since date for the lifetime cycle', async () => {
		const countStub = sinon.stub(repo, 'countActiveByCreatorSince').resolves(0);
		build(fakeSettingsService({ invite_count_limit: '2', invite_count_cycle: 'lifetime' }));

		await service.create('user-sub');

		const [, since] = countStub.firstCall.args;
		expect(since).toBeNull();
	});

	it('treats a limit of -1 as unlimited, skipping the count entirely', async () => {
		const countStub = sinon.stub(repo, 'countActiveByCreatorSince').resolves(9999);
		build(fakeSettingsService({ invite_count_limit: '-1', invite_count_cycle: 'year' }));

		const result = await service.create('user-sub');

		expect(result).toEqual({ ok: true, data: invitation, code: 201 });
		sinon.assert.notCalled(countStub);
	});

	it('fails closed with 500 when invite_count_limit is missing', async () => {
		sinon.stub(repo, 'countActiveByCreatorSince').resolves(0);
		const settingsService = fakeSettingsService();
		sinon
			.stub(settingsService, 'getSetting')
			.callThrough()
			.withArgs('invite_count_limit')
			.resolves({ ok: false, error: 'Setting not found', code: 404 });
		build(settingsService);

		const result = await service.create('user-sub');

		expect(result).toEqual({ ok: false, error: 'Invite limit is misconfigured', code: 500 });
		sinon.assert.notCalled(repo.create as sinon.SinonStub);
	});

	it('fails closed with 500 when invite_count_cycle is missing', async () => {
		sinon.stub(repo, 'countActiveByCreatorSince').resolves(0);
		const settingsService = fakeSettingsService();
		sinon
			.stub(settingsService, 'getSetting')
			.callThrough()
			.withArgs('invite_count_cycle')
			.resolves({ ok: false, error: 'Setting not found', code: 404 });
		build(settingsService);

		const result = await service.create('user-sub');

		expect(result).toEqual({ ok: false, error: 'Invite limit is misconfigured', code: 500 });
		sinon.assert.notCalled(repo.create as sinon.SinonStub);
	});

	it.each(['abc', '2.5', '-2'])(
		'fails closed with 500 for an invalid invite_count_limit value "%s"',
		async (value) => {
			sinon.stub(repo, 'countActiveByCreatorSince').resolves(0);
			build(fakeSettingsService({ invite_count_limit: value, invite_count_cycle: 'lifetime' }));

			const result = await service.create('user-sub');

			expect(result).toEqual({ ok: false, error: 'Invite limit is misconfigured', code: 500 });
			sinon.assert.notCalled(repo.create as sinon.SinonStub);
		}
	);

	it('fails closed with 500 for an invalid invite_count_cycle value', async () => {
		sinon.stub(repo, 'countActiveByCreatorSince').resolves(0);
		build(fakeSettingsService({ invite_count_limit: '2', invite_count_cycle: 'quarter' }));

		const result = await service.create('user-sub');

		expect(result).toEqual({ ok: false, error: 'Invite limit is misconfigured', code: 500 });
		sinon.assert.notCalled(repo.create as sinon.SinonStub);
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
