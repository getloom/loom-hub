import type { InvitationRepo } from '$lib/system/invitations/invitationsRepo';
import { InvitationService } from '$lib/system/invitations/invitationsService.server';
import type { SettingsService } from '$lib/system/settings/settingsService.server';
import { describe, it, expect, beforeEach } from 'vitest';
import sinon from 'sinon';
import type { Invitation, InvitationWithUsernames, Redemption } from './invitationsService';

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
		status: 'pending',
		max_uses: 1,
		use_count: 0,
		limit_exempt: false,
		expires_at: new Date('2026-11-19'),
		created_at: new Date(),
		updated_at: null
	};

	beforeEach(() => {
		repo = {
			create: () => {},
			findAllByCreator: () => {},
			countRedemptionsByCreatorSince: () => {}
		} as any as InvitationRepo;
		sinon.stub(repo, 'countRedemptionsByCreatorSince').resolves(0);

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

	describe('max_uses', () => {
		it('defaults to 1 use and records no limit exemption', async () => {
			const stub = sinon.stub(repo, 'create').resolves(invitation);

			await service.create('user-sub');

			expect(stub.firstCall.args[3]).toBe(1);
			expect(stub.firstCall.args[4]).toBe(false);
		});

		it('passes an explicit max_uses through', async () => {
			const stub = sinon.stub(repo, 'create').resolves(invitation);

			await service.create('user-sub', undefined, [], undefined, 5);

			expect(stub.firstCall.args[3]).toBe(5);
		});

		it('passes null through for unlimited', async () => {
			const stub = sinon.stub(repo, 'create').resolves(invitation);

			await service.create('user-sub', undefined, [], undefined, null);

			expect(stub.firstCall.args[3]).toBeNull();
		});

		it.each([0, -1, 1.5, '3' as unknown as number, 2147483648, NaN])(
			'rejects invalid max_uses %j with 400',
			async (bad) => {
				const stub = sinon.stub(repo, 'create').resolves(invitation);

				const result = await service.create('user-sub', undefined, [], undefined, bad);

				expect(result).toEqual({
					ok: false,
					error: 'max_uses must be a positive integer or unlimited',
					code: 400
				});
				sinon.assert.notCalled(stub);
			}
		);

		it('persists limit_exempt for a founder', async () => {
			const stub = sinon.stub(repo, 'create').resolves(invitation);

			await service.create('user-sub', undefined, ['founder']);

			expect(stub.firstCall.args[4]).toBe(true);
		});
	});

	describe('with a custom invite code', () => {
		it('passes a valid custom code to the repo, trimmed', async () => {
			const stub = sinon.stub(repo, 'create').resolves(invitation);

			const result = await service.create('user-sub', undefined, [], '  Welcome-2026  ');

			expect(result).toEqual({ ok: true, data: invitation, code: 201 });
			expect(stub.firstCall.args[1]).toBe('Welcome-2026');
		});

		it.each([undefined, '', '   '])(
			'falls back to a generated code for blank input %j',
			async (blank) => {
				const stub = sinon.stub(repo, 'create').resolves(invitation);

				const result = await service.create('user-sub', undefined, [], blank);

				expect(result.ok).toBe(true);
				expect(stub.firstCall.args[1]).toHaveLength(32);
			}
		);

		it.each(['abc', 'a'.repeat(65), 'a b c d', 'café-code', 'bad!code'])(
			'rejects the invalid code "%s" with 400 without calling the repo',
			async (bad) => {
				const stub = sinon.stub(repo, 'create').resolves(invitation);

				const result = await service.create('user-sub', undefined, [], bad);

				expect(result).toEqual({
					ok: false,
					error: 'Invite code must be 4-64 characters: letters, numbers, - or _',
					code: 400
				});
				sinon.assert.notCalled(stub);
			}
		);

		it('returns 409 when the code is already taken', async () => {
			sinon.stub(repo, 'create').rejects({ code: '23505' });

			const result = await service.create('user-sub', undefined, [], 'welcome');

			expect(result).toEqual({ ok: false, error: 'Invite code is already taken', code: 409 });
		});

		it('returns 500 for other repo errors', async () => {
			sinon.stub(repo, 'create').rejects(new Error('boom'));

			const result = await service.create('user-sub', undefined, [], 'welcome');

			expect(result).toEqual({
				ok: false,
				error: 'Failed to create invitation',
				code: 500
			});
		});

		it('returns 500 for a unique violation when no custom code was supplied', async () => {
			sinon.stub(repo, 'create').rejects({ code: '23505' });

			const result = await service.create('user-sub');

			expect(result).toEqual({
				ok: false,
				error: 'Failed to create invitation',
				code: 500
			});
		});

		it('still enforces the invite limit', async () => {
			(repo.countRedemptionsByCreatorSince as sinon.SinonStub).resolves(1000);
			const stub = sinon.stub(repo, 'create').resolves(invitation);

			const result = await service.create('user-sub', undefined, [], 'welcome');

			expect(result).toEqual({
				ok: false,
				error: 'Invite creation limit reached for the current cycle',
				code: 429
			});
			sinon.assert.notCalled(stub);
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
		status: 'pending',
		max_uses: 1,
		use_count: 0,
		limit_exempt: false,
		expires_at: new Date('2026-11-19'),
		created_at: new Date(),
		updated_at: null
	};

	beforeEach(() => {
		repo = {
			create: () => {},
			countRedemptionsByCreatorSince: () => {}
		} as any as InvitationRepo;
		sinon.stub(repo, 'create').resolves(invitation);
	});

	function build(settingsService: SettingsService) {
		service = new InvitationService(repo, undefined, settingsService);
	}

	it('allows creation when the count is below the limit', async () => {
		sinon.stub(repo, 'countRedemptionsByCreatorSince').resolves(1);
		build(fakeSettingsService({ invite_count_limit: '2', invite_count_cycle: 'lifetime' }));

		const result = await service.create('user-sub');

		expect(result).toEqual({ ok: true, data: invitation, code: 201 });
		sinon.assert.calledOnce(repo.create as sinon.SinonStub);
	});

	it('rejects with 429 when the count is at the limit', async () => {
		sinon.stub(repo, 'countRedemptionsByCreatorSince').resolves(2);
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
		sinon.stub(repo, 'countRedemptionsByCreatorSince').resolves(3);
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
		const countStub = sinon.stub(repo, 'countRedemptionsByCreatorSince').resolves(9999);
		build(settingsService);

		const result = await service.create('user-sub', undefined, ['founder']);

		expect(result).toEqual({ ok: true, data: invitation, code: 201 });
		sinon.assert.notCalled(getSettingSpy);
		sinon.assert.notCalled(countStub);
		sinon.assert.calledOnce(repo.create as sinon.SinonStub);
	});

	it('does not bypass the check for a non-exempt role', async () => {
		sinon.stub(repo, 'countRedemptionsByCreatorSince').resolves(2);
		build(fakeSettingsService({ invite_count_limit: '2', invite_count_cycle: 'lifetime' }));

		const result = await service.create('user-sub', undefined, ['member']);

		expect(result).toEqual({
			ok: false,
			error: 'Invite creation limit reached for the current cycle',
			code: 429
		});
	});

	it('resolves a since date roughly one year back for the year cycle', async () => {
		const countStub = sinon.stub(repo, 'countRedemptionsByCreatorSince').resolves(0);
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
		const countStub = sinon.stub(repo, 'countRedemptionsByCreatorSince').resolves(0);
		build(fakeSettingsService({ invite_count_limit: '2', invite_count_cycle: 'month' }));

		await service.create('user-sub');

		const [, since] = countStub.firstCall.args;
		expect(since).not.toBeNull();
		const daysBack = (Date.now() - since!.getTime()) / (1000 * 60 * 60 * 24);
		expect(daysBack).toBeGreaterThan(25);
		expect(daysBack).toBeLessThan(32);
	});

	it('passes a null since date for the lifetime cycle', async () => {
		const countStub = sinon.stub(repo, 'countRedemptionsByCreatorSince').resolves(0);
		build(fakeSettingsService({ invite_count_limit: '2', invite_count_cycle: 'lifetime' }));

		await service.create('user-sub');

		const [, since] = countStub.firstCall.args;
		expect(since).toBeNull();
	});

	it('treats a limit of -1 as unlimited, skipping the count entirely', async () => {
		const countStub = sinon.stub(repo, 'countRedemptionsByCreatorSince').resolves(9999);
		build(fakeSettingsService({ invite_count_limit: '-1', invite_count_cycle: 'year' }));

		const result = await service.create('user-sub');

		expect(result).toEqual({ ok: true, data: invitation, code: 201 });
		sinon.assert.notCalled(countStub);
	});

	it('fails closed with 500 when invite_count_limit is missing', async () => {
		sinon.stub(repo, 'countRedemptionsByCreatorSince').resolves(0);
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
		sinon.stub(repo, 'countRedemptionsByCreatorSince').resolves(0);
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
			sinon.stub(repo, 'countRedemptionsByCreatorSince').resolves(0);
			build(fakeSettingsService({ invite_count_limit: value, invite_count_cycle: 'lifetime' }));

			const result = await service.create('user-sub');

			expect(result).toEqual({ ok: false, error: 'Invite limit is misconfigured', code: 500 });
			sinon.assert.notCalled(repo.create as sinon.SinonStub);
		}
	);

	it('fails closed with 500 for an invalid invite_count_cycle value', async () => {
		sinon.stub(repo, 'countRedemptionsByCreatorSince').resolves(0);
		build(fakeSettingsService({ invite_count_limit: '2', invite_count_cycle: 'quarter' }));

		const result = await service.create('user-sub');

		expect(result).toEqual({ ok: false, error: 'Invite limit is misconfigured', code: 500 });
		sinon.assert.notCalled(repo.create as sinon.SinonStub);
	});
});

describe('listing invitations', () => {
	let service: InvitationService;
	let repo: InvitationRepo;

	const invitation: InvitationWithUsernames = {
		invite_id: 1,
		invite_code: 'abc123',
		created_by: 'user-sub',
		status: 'pending',
		max_uses: 1,
		use_count: 0,
		limit_exempt: false,
		expires_at: new Date('2026-11-19'),
		created_at: new Date(),
		updated_at: null,
		created_by_username: 'alice',
		redemptions: []
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

	const invitation: InvitationWithUsernames = {
		invite_id: 1,
		invite_code: 'abc123',
		created_by: 'user-sub',
		status: 'pending',
		max_uses: 1,
		use_count: 0,
		limit_exempt: false,
		expires_at: new Date('2026-11-19'),
		created_at: new Date(),
		updated_at: null,
		created_by_username: 'alice',
		redemptions: []
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
		status: 'pending',
		max_uses: 1,
		use_count: 0,
		limit_exempt: false,
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

	it('returns a conflict when the invitation is active', async () => {
		sinon.stub(repo, 'findById').resolves({ ...invitation, status: 'active', use_count: 1 });
		const deleteStub = sinon.stub(repo, 'delete').resolves(invitation);

		const result = await service.delete('user-sub', 1);

		expect(result).toEqual({
			ok: false,
			error: 'Invitation cannot be deleted in its current status',
			code: 409
		});
		sinon.assert.notCalled(deleteStub);
	});

	it('returns a conflict when an expired invitation has redemptions', async () => {
		sinon.stub(repo, 'findById').resolves({ ...invitation, status: 'expired', use_count: 1 });
		const deleteStub = sinon.stub(repo, 'delete').resolves(invitation);

		const result = await service.delete('user-sub', 1);

		expect(result.ok).toBe(false);
		expect((result as { code: number }).code).toBe(409);
		sinon.assert.notCalled(deleteStub);
	});

	it('allows deleting an unused expired invitation', async () => {
		sinon.stub(repo, 'findById').resolves({ ...invitation, status: 'expired' });
		sinon.stub(repo, 'delete').resolves(invitation);

		const result = await service.delete('user-sub', 1);

		expect(result.ok).toBe(true);
	});

	it('returns a conflict when the repo refuses the delete after a concurrent redemption', async () => {
		sinon.stub(repo, 'findById').resolves(invitation);
		sinon.stub(repo, 'delete').resolves(undefined);

		const result = await service.delete('user-sub', 1);

		expect(result).toEqual({
			ok: false,
			error: 'Invitation cannot be deleted in its current status',
			code: 409
		});
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
					status: 'expired',
					max_uses: 1,
					use_count: 0,
					limit_exempt: false,
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

describe('revoking a redemption', () => {
	let service: InvitationService;
	let repo: InvitationRepo;
	let keycloakAdmin: { deactivateUser: sinon.SinonStub };

	const invitation: Invitation = {
		invite_id: 1,
		invite_code: 'abc123',
		created_by: 'user-sub',
		status: 'accepted',
		max_uses: 1,
		use_count: 1,
		limit_exempt: false,
		expires_at: new Date('2027-01-01'),
		created_at: new Date(),
		updated_at: null
	};
	const redemption: Redemption = {
		redemption_id: 7,
		invite_id: 1,
		user_sub: 'keycloak-sub-1',
		username: 'bob',
		status: 'active',
		created_at: new Date(),
		revoked_at: null
	};

	beforeEach(() => {
		repo = {
			findRedemption: () => {},
			revokeRedemption: () => {},
			markRevokedIfAllRevoked: () => {},
			findByIdAdmin: () => {}
		} as any as InvitationRepo;

		keycloakAdmin = { deactivateUser: sinon.stub() };
		service = new InvitationService(repo, keycloakAdmin);
	});

	it('deactivates the Keycloak user and revokes the redemption', async () => {
		sinon.stub(repo, 'findRedemption').resolves(redemption);
		keycloakAdmin.deactivateUser.resolves();
		const revokeStub = sinon
			.stub(repo, 'revokeRedemption')
			.resolves({ ...redemption, status: 'revoked' });
		sinon.stub(repo, 'markRevokedIfAllRevoked').resolves(undefined);
		sinon.stub(repo, 'findByIdAdmin').resolves(invitation);

		const result = await service.revokeRedemption(1, 7);

		expect(result).toEqual({ ok: true, data: invitation, code: 200 });
		sinon.assert.calledWith(keycloakAdmin.deactivateUser, 'keycloak-sub-1');
		sinon.assert.calledWith(revokeStub, 7);
	});

	it('checks whether the invitation is now fully revoked and returns it', async () => {
		sinon.stub(repo, 'findRedemption').resolves(redemption);
		keycloakAdmin.deactivateUser.resolves();
		sinon.stub(repo, 'revokeRedemption').resolves({ ...redemption, status: 'revoked' });
		const markStub = sinon
			.stub(repo, 'markRevokedIfAllRevoked')
			.resolves({ ...invitation, status: 'revoked' });
		sinon.stub(repo, 'findByIdAdmin').resolves({ ...invitation, status: 'revoked' });

		const result = await service.revokeRedemption(1, 7);

		sinon.assert.calledWith(markStub, 1);
		expect(result).toEqual({
			ok: true,
			data: { ...invitation, status: 'revoked' },
			code: 200
		});
	});

	it('handles validation errors for ids', async () => {
		expect(await service.revokeRedemption(0, 7)).toEqual({
			ok: false,
			error: 'invite_id must be a positive integer',
			code: 400
		});
		expect(await service.revokeRedemption(1, 1.5)).toEqual({
			ok: false,
			error: 'redemption_id must be a positive integer',
			code: 400
		});
	});

	it('returns not found when the redemption is missing', async () => {
		sinon.stub(repo, 'findRedemption').resolves(undefined);

		const result = await service.revokeRedemption(1, 7);

		expect(result).toEqual({ ok: false, error: 'Redemption not found', code: 404 });
		sinon.assert.notCalled(keycloakAdmin.deactivateUser);
	});

	it('returns not found when the redemption belongs to a different invitation', async () => {
		sinon.stub(repo, 'findRedemption').resolves({ ...redemption, invite_id: 2 });

		const result = await service.revokeRedemption(1, 7);

		expect(result).toEqual({ ok: false, error: 'Redemption not found', code: 404 });
		sinon.assert.notCalled(keycloakAdmin.deactivateUser);
	});

	it('returns 422 when the redemption is already revoked, without touching Keycloak', async () => {
		sinon.stub(repo, 'findRedemption').resolves({ ...redemption, status: 'revoked' });
		const revokeStub = sinon.stub(repo, 'revokeRedemption');

		const result = await service.revokeRedemption(1, 7);

		expect(result).toEqual({
			ok: false,
			error: 'Redemption cannot be revoked in its current status',
			code: 422
		});
		sinon.assert.notCalled(keycloakAdmin.deactivateUser);
		sinon.assert.notCalled(revokeStub);
	});

	it('returns 500 and leaves the redemption active when Keycloak deactivation fails', async () => {
		sinon.stub(repo, 'findRedemption').resolves(redemption);
		keycloakAdmin.deactivateUser.rejects(new Error('Keycloak unreachable'));
		const revokeStub = sinon.stub(repo, 'revokeRedemption');

		const result = await service.revokeRedemption(1, 7);

		expect(result).toEqual({ ok: false, error: 'Failed to deactivate user', code: 500 });
		sinon.assert.notCalled(revokeStub);
	});

	it('handles thrown errors', async () => {
		sinon.stub(repo, 'findRedemption').throwsException(new Error('Thrown error for testing'));

		const result = await service.revokeRedemption(1, 7);

		expect(result).toEqual({ ok: false, error: 'Failed to revoke redemption', code: 500 });
	});
});
