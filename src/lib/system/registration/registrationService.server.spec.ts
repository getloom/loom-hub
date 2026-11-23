import type { InvitationRepo } from '$lib/system/invitations/invitationsRepo';
import {
	RegistrationService,
	type KeycloakAdminOps,
	type KeycloakLoginOps,
	type UsersOps
} from '$lib/system/registration/registrationService.server';
import { KeycloakUsernameTakenError } from '$lib/system/admin/keycloakAdmin.server';
import { describe, it, expect, beforeEach } from 'vitest';
import sinon from 'sinon';
import type { SettingsService } from '$lib/system/settings/settingsService.server';
import type { Invitation } from '$lib/system/invitations/invitationsService';

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
					? { ok: true, data: { key, value: values[key] }, code: 200 }
					: { ok: false, error: 'Setting not found', code: 404 }
			)
	} as unknown as SettingsService;
}

describe('registering an account', () => {
	let service: RegistrationService;
	let repo: InvitationRepo;
	let keycloakAdmin: KeycloakAdminOps;
	let keycloakLogin: KeycloakLoginOps;
	let usersOps: UsersOps;

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

	const session = {
		sub: 'kc-user-sub',
		iss: 'https://issuer.example/realms/loom',
		id_token: 'fake-id-token'
	};

	beforeEach(() => {
		repo = {
			findByCode: () => {},
			redeem: () => {}
		} as unknown as InvitationRepo;

		keycloakAdmin = {
			createUser: () => Promise.resolve(session.sub),
			deleteUser: () => Promise.resolve()
		};

		keycloakLogin = {
			passwordLogin: () => Promise.resolve(session)
		};

		usersOps = {
			upsertUser: () => Promise.resolve()
		};

		service = new RegistrationService(
			repo,
			keycloakAdmin,
			keycloakLogin,
			usersOps,
			fakeSettingsService()
		);
	});

	it('succeeds with a valid username, matching passwords, and a pending invite', async () => {
		const findByCode = sinon.stub(repo, 'findByCode').resolves(invitation);
		const createUser = sinon.stub(keycloakAdmin, 'createUser').resolves(session.sub);
		const passwordLoginStub = sinon.stub(keycloakLogin, 'passwordLogin').resolves(session);
		const redeem = sinon
			.stub(repo, 'redeem')
			.resolves({ ok: true, invitation: { ...invitation, status: 'accepted', use_count: 1 } });

		const result = await service.register(
			'newuser1',
			'newuser1@example.com',
			'pw123',
			'pw123',
			'abc123'
		);

		expect(result).toEqual({ ok: true, data: session, code: 201 });
		sinon.assert.calledWith(findByCode, 'abc123');
		sinon.assert.calledWith(createUser, 'newuser1', 'newuser1@example.com', 'pw123');
		sinon.assert.calledWith(passwordLoginStub, 'newuser1', 'pw123');
		sinon.assert.calledWith(redeem, 'abc123', session.sub, { max: 1000, since: null });
	});

	it('rejects a missing username', async () => {
		const result = await service.register('', 'newuser1@example.com', 'pw123', 'pw123', 'abc123');

		expect(result).toEqual({
			ok: false,
			error: 'username must contain only letters and numbers',
			code: 400
		});
	});

	it('rejects a username with non-alphanumeric characters', async () => {
		const result = await service.register(
			'new_user!',
			'newuser1@example.com',
			'pw123',
			'pw123',
			'abc123'
		);

		expect(result).toEqual({
			ok: false,
			error: 'username must contain only letters and numbers',
			code: 400
		});
	});

	it('rejects a username that looks like an email', async () => {
		const result = await service.register(
			'new_user@gmail.com',
			'newuser1@example.com',
			'pw123',
			'pw123',
			'abc123'
		);

		expect(result).toEqual({
			ok: false,
			error: 'username must contain only letters and numbers',
			code: 400
		});
	});

	it('rejects a missing email', async () => {
		const result = await service.register('newuser1', '', 'pw123', 'pw123', 'abc123');

		expect(result).toEqual({
			ok: false,
			error: 'a valid email is required',
			code: 400
		});
	});

	it('rejects an invalid email format', async () => {
		const result = await service.register('newuser1', 'not-an-email', 'pw123', 'pw123', 'abc123');

		expect(result).toEqual({
			ok: false,
			error: 'a valid email is required',
			code: 400
		});
	});

	it('rejects a missing password or confirmation', async () => {
		const noPassword = await service.register(
			'newuser1',
			'newuser1@example.com',
			'',
			'pw123',
			'abc123'
		);
		const noConfirmation = await service.register(
			'newuser1',
			'newuser1@example.com',
			'pw123',
			'',
			'abc123'
		);

		const expected = {
			ok: false,
			error: 'password and confirmation are required',
			code: 400
		};
		expect(noPassword).toEqual(expected);
		expect(noConfirmation).toEqual(expected);
	});

	it('rejects a password/confirmation mismatch', async () => {
		const result = await service.register(
			'newuser1',
			'newuser1@example.com',
			'pw123',
			'pw456',
			'abc123'
		);

		expect(result).toEqual({
			ok: false,
			error: 'password and confirmation must match',
			code: 400
		});
	});

	it('rejects a missing invite_code', async () => {
		const result = await service.register('newuser1', 'newuser1@example.com', 'pw123', 'pw123', '');

		expect(result).toEqual({
			ok: false,
			error: 'invite_code is required',
			code: 400
		});
	});

	it('returns not found when no invitation matches the code', async () => {
		sinon.stub(repo, 'findByCode').resolves(undefined);

		const result = await service.register(
			'newuser1',
			'newuser1@example.com',
			'pw123',
			'pw123',
			'bad-code'
		);

		expect(result).toEqual({
			ok: false,
			error: 'Invitation not found',
			code: 404
		});
	});

	it.each([
		['accepted', 1, 1],
		['revoked', 1, 1],
		['expired', 0, 1],
		['active', 3, 3]
	] as const)(
		'rejects a %s invitation (%i/%i uses) before creating a user',
		async (status, use_count, max_uses) => {
			sinon.stub(repo, 'findByCode').resolves({ ...invitation, status, use_count, max_uses });
			const createUser = sinon.stub(keycloakAdmin, 'createUser');

			const result = await service.register(
				'newuser1',
				'newuser1@example.com',
				'pw123',
				'pw123',
				'abc123'
			);

			expect(result).toEqual({ ok: false, error: 'Invitation is not available', code: 409 });
			sinon.assert.notCalled(createUser);
		}
	);

	it('accepts an active invitation with uses remaining', async () => {
		sinon
			.stub(repo, 'findByCode')
			.resolves({ ...invitation, status: 'active', use_count: 1, max_uses: 3 });
		const redeem = sinon.stub(repo, 'redeem').resolves({ ok: true, invitation });

		const result = await service.register(
			'newuser1',
			'newuser1@example.com',
			'pw123',
			'pw123',
			'abc123'
		);

		expect(result.ok).toBe(true);
		sinon.assert.calledOnce(redeem);
	});

	it('accepts an unlimited active invitation', async () => {
		sinon
			.stub(repo, 'findByCode')
			.resolves({ ...invitation, status: 'active', use_count: 50, max_uses: null });
		sinon.stub(repo, 'redeem').resolves({ ok: true, invitation });

		const result = await service.register(
			'newuser1',
			'newuser1@example.com',
			'pw123',
			'pw123',
			'abc123'
		);

		expect(result.ok).toBe(true);
	});

	it('returns 500 without creating a Keycloak user when invite settings are misconfigured', async () => {
		service = new RegistrationService(
			repo,
			keycloakAdmin,
			keycloakLogin,
			usersOps,
			fakeSettingsService({ invite_count_limit: 'abc' })
		);
		sinon.stub(repo, 'findByCode').resolves(invitation);
		const createUser = sinon.stub(keycloakAdmin, 'createUser');

		const result = await service.register(
			'newuser1',
			'newuser1@example.com',
			'pw123',
			'pw123',
			'abc123'
		);

		expect(result).toEqual({ ok: false, error: 'Invite limit is misconfigured', code: 500 });
		sinon.assert.notCalled(createUser);
	});

	it('passes a null limit to redeem when invites are unlimited', async () => {
		service = new RegistrationService(
			repo,
			keycloakAdmin,
			keycloakLogin,
			usersOps,
			fakeSettingsService({ invite_count_limit: '-1' })
		);
		sinon.stub(repo, 'findByCode').resolves(invitation);
		const redeem = sinon.stub(repo, 'redeem').resolves({ ok: true, invitation });

		await service.register('newuser1', 'newuser1@example.com', 'pw123', 'pw123', 'abc123');

		expect(redeem.firstCall.args[2]).toBeNull();
	});

	it('returns 429 and rolls back the Keycloak user when the creator limit is reached', async () => {
		sinon.stub(repo, 'findByCode').resolves(invitation);
		sinon.stub(repo, 'redeem').resolves({ ok: false, reason: 'limit_reached' });
		const deleteUser = sinon.stub(keycloakAdmin, 'deleteUser').resolves();

		const result = await service.register(
			'newuser1',
			'newuser1@example.com',
			'pw123',
			'pw123',
			'abc123'
		);

		expect(result).toEqual({
			ok: false,
			error: 'Invitation limit reached for this invite creator',
			code: 429
		});
		sinon.assert.calledWith(deleteUser, session.sub);
	});

	it('handles thrown errors while validating the invitation', async () => {
		sinon.stub(repo, 'findByCode').throwsException(new Error('Thrown error for testing'));

		const result = await service.register(
			'newuser1',
			'newuser1@example.com',
			'pw123',
			'pw123',
			'abc123'
		);

		expect(result).toEqual({
			ok: false,
			error: 'Failed to validate invitation',
			code: 500
		});
	});

	it('rejects with a conflict when the username is already taken in Keycloak', async () => {
		sinon.stub(repo, 'findByCode').resolves(invitation);
		const createUser = sinon
			.stub(keycloakAdmin, 'createUser')
			.rejects(new KeycloakUsernameTakenError('newuser1'));
		const redeem = sinon.stub(repo, 'redeem');
		const deleteUser = sinon.stub(keycloakAdmin, 'deleteUser');

		const result = await service.register(
			'newuser1',
			'newuser1@example.com',
			'pw123',
			'pw123',
			'abc123'
		);

		expect(result).toEqual({
			ok: false,
			error: 'Username is already taken',
			code: 409
		});
		sinon.assert.calledOnce(createUser);
		sinon.assert.notCalled(redeem);
		sinon.assert.notCalled(deleteUser);
	});

	it('returns a 500 when Keycloak user creation throws a generic error', async () => {
		sinon.stub(repo, 'findByCode').resolves(invitation);
		sinon.stub(keycloakAdmin, 'createUser').rejects(new Error('network error'));

		const result = await service.register(
			'newuser1',
			'newuser1@example.com',
			'pw123',
			'pw123',
			'abc123'
		);

		expect(result).toEqual({
			ok: false,
			error: 'Failed to create user',
			code: 500
		});
	});

	it('rolls back the Keycloak user when login fails after creation', async () => {
		sinon.stub(repo, 'findByCode').resolves(invitation);
		sinon.stub(keycloakAdmin, 'createUser').resolves(session.sub);
		sinon.stub(keycloakLogin, 'passwordLogin').rejects(new Error('login failed'));
		const deleteUser = sinon.stub(keycloakAdmin, 'deleteUser').resolves();

		const result = await service.register(
			'newuser1',
			'newuser1@example.com',
			'pw123',
			'pw123',
			'abc123'
		);

		expect(result).toEqual({
			ok: false,
			error: 'Failed to finalize registration',
			code: 500
		});
		sinon.assert.calledWith(deleteUser, session.sub);
	});

	it('rolls back the Keycloak user when the invitation is no longer redeemable at write time', async () => {
		sinon.stub(repo, 'findByCode').resolves(invitation);
		sinon.stub(keycloakAdmin, 'createUser').resolves(session.sub);
		sinon.stub(keycloakLogin, 'passwordLogin').resolves(session);
		sinon.stub(repo, 'redeem').resolves({ ok: false, reason: 'not_redeemable' });
		const deleteUser = sinon.stub(keycloakAdmin, 'deleteUser').resolves();

		const result = await service.register(
			'newuser1',
			'newuser1@example.com',
			'pw123',
			'pw123',
			'abc123'
		);

		expect(result).toEqual({
			ok: false,
			error: 'Invitation is not available',
			code: 409
		});
		sinon.assert.calledWith(deleteUser, session.sub);
	});

	it('rolls back the Keycloak user when redeeming the invitation throws', async () => {
		sinon.stub(repo, 'findByCode').resolves(invitation);
		sinon.stub(keycloakAdmin, 'createUser').resolves(session.sub);
		sinon.stub(keycloakLogin, 'passwordLogin').resolves(session);
		sinon.stub(repo, 'redeem').throwsException(new Error('db error'));
		const deleteUser = sinon.stub(keycloakAdmin, 'deleteUser').resolves();

		const result = await service.register(
			'newuser1',
			'newuser1@example.com',
			'pw123',
			'pw123',
			'abc123'
		);

		expect(result).toEqual({
			ok: false,
			error: 'Failed to finalize registration',
			code: 500
		});
		sinon.assert.calledWith(deleteUser, session.sub);
	});

	it('persists a local user record with the registered username on success', async () => {
		sinon.stub(repo, 'findByCode').resolves(invitation);
		sinon.stub(keycloakAdmin, 'createUser').resolves(session.sub);
		sinon.stub(keycloakLogin, 'passwordLogin').resolves(session);
		sinon
			.stub(repo, 'redeem')
			.resolves({ ok: true, invitation: { ...invitation, status: 'accepted', use_count: 1 } });
		const upsertUser = sinon.stub(usersOps, 'upsertUser').resolves();

		const result = await service.register(
			'newuser1',
			'newuser1@example.com',
			'pw123',
			'pw123',
			'abc123'
		);

		expect(result).toEqual({ ok: true, data: session, code: 201 });
		sinon.assert.calledWith(
			upsertUser,
			session.sub,
			session.iss,
			'newuser1',
			'newuser1@example.com',
			false
		);
	});

	it('still succeeds when persisting the local user record fails', async () => {
		sinon.stub(repo, 'findByCode').resolves(invitation);
		sinon.stub(keycloakAdmin, 'createUser').resolves(session.sub);
		sinon.stub(keycloakLogin, 'passwordLogin').resolves(session);
		sinon
			.stub(repo, 'redeem')
			.resolves({ ok: true, invitation: { ...invitation, status: 'accepted', use_count: 1 } });
		sinon.stub(usersOps, 'upsertUser').rejects(new Error('db error'));

		const result = await service.register(
			'newuser1',
			'newuser1@example.com',
			'pw123',
			'pw123',
			'abc123'
		);

		expect(result).toEqual({ ok: true, data: session, code: 201 });
	});
});
