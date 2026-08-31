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
import type { Invitation } from '$lib/system/invitations/invitationsService';

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
		used_by: null,
		status: 'pending',
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
			markAccepted: () => {}
		} as any as InvitationRepo;

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

		service = new RegistrationService(repo, keycloakAdmin, keycloakLogin, usersOps);
	});

	it('succeeds with a valid username, matching passwords, and a pending invite', async () => {
		const findByCode = sinon.stub(repo, 'findByCode').resolves(invitation);
		const createUser = sinon.stub(keycloakAdmin, 'createUser').resolves(session.sub);
		const passwordLoginStub = sinon.stub(keycloakLogin, 'passwordLogin').resolves(session);
		const markAccepted = sinon.stub(repo, 'markAccepted').resolves({
			...invitation,
			status: 'accepted',
			used_by: session.sub
		});

		const result = await service.register('newuser1', 'pw123', 'pw123', 'abc123');

		expect(result).toEqual({ ok: true, data: session, code: 201 });
		sinon.assert.calledWith(findByCode, 'abc123');
		sinon.assert.calledWith(createUser, 'newuser1', 'pw123');
		sinon.assert.calledWith(passwordLoginStub, 'newuser1', 'pw123');
		sinon.assert.calledWith(markAccepted, 'abc123', session.sub);
	});

	it('rejects a missing username', async () => {
		const result = await service.register('', 'pw123', 'pw123', 'abc123');

		expect(result).toEqual({
			ok: false,
			error: 'username must contain only letters and numbers',
			code: 400
		});
	});

	it('rejects a username with non-alphanumeric characters', async () => {
		const result = await service.register('new_user!', 'pw123', 'pw123', 'abc123');

		expect(result).toEqual({
			ok: false,
			error: 'username must contain only letters and numbers',
			code: 400
		});
	});

	it('rejects a username that looks like an email', async () => {
		const result = await service.register('new_user@gmail.com', 'pw123', 'pw123', 'abc123');

		expect(result).toEqual({
			ok: false,
			error: 'username must contain only letters and numbers',
			code: 400
		});
	});

	it('rejects a missing password or confirmation', async () => {
		const noPassword = await service.register('newuser1', '', 'pw123', 'abc123');
		const noConfirmation = await service.register('newuser1', 'pw123', '', 'abc123');

		const expected = {
			ok: false,
			error: 'password and confirmation are required',
			code: 400
		};
		expect(noPassword).toEqual(expected);
		expect(noConfirmation).toEqual(expected);
	});

	it('rejects a password/confirmation mismatch', async () => {
		const result = await service.register('newuser1', 'pw123', 'pw456', 'abc123');

		expect(result).toEqual({
			ok: false,
			error: 'password and confirmation must match',
			code: 400
		});
	});

	it('rejects a missing invite_code', async () => {
		const result = await service.register('newuser1', 'pw123', 'pw123', '');

		expect(result).toEqual({
			ok: false,
			error: 'invite_code is required',
			code: 400
		});
	});

	it('returns not found when no invitation matches the code', async () => {
		sinon.stub(repo, 'findByCode').resolves(undefined);

		const result = await service.register('newuser1', 'pw123', 'pw123', 'bad-code');

		expect(result).toEqual({
			ok: false,
			error: 'Invitation not found',
			code: 404
		});
	});

	it('returns a conflict when the invitation is not pending', async () => {
		sinon.stub(repo, 'findByCode').resolves({ ...invitation, status: 'accepted' });

		const result = await service.register('newuser1', 'pw123', 'pw123', 'abc123');

		expect(result).toEqual({
			ok: false,
			error: 'Invitation is not pending',
			code: 409
		});
	});

	it('handles thrown errors while validating the invitation', async () => {
		sinon.stub(repo, 'findByCode').throwsException(new Error('Thrown error for testing'));

		const result = await service.register('newuser1', 'pw123', 'pw123', 'abc123');

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
		const markAccepted = sinon.stub(repo, 'markAccepted');
		const deleteUser = sinon.stub(keycloakAdmin, 'deleteUser');

		const result = await service.register('newuser1', 'pw123', 'pw123', 'abc123');

		expect(result).toEqual({
			ok: false,
			error: 'Username is already taken',
			code: 409
		});
		sinon.assert.calledOnce(createUser);
		sinon.assert.notCalled(markAccepted);
		sinon.assert.notCalled(deleteUser);
	});

	it('returns a 500 when Keycloak user creation throws a generic error', async () => {
		sinon.stub(repo, 'findByCode').resolves(invitation);
		sinon.stub(keycloakAdmin, 'createUser').rejects(new Error('network error'));

		const result = await service.register('newuser1', 'pw123', 'pw123', 'abc123');

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

		const result = await service.register('newuser1', 'pw123', 'pw123', 'abc123');

		expect(result).toEqual({
			ok: false,
			error: 'Failed to finalize registration',
			code: 500
		});
		sinon.assert.calledWith(deleteUser, session.sub);
	});

	it('rolls back the Keycloak user when the invitation is no longer pending at write time', async () => {
		sinon.stub(repo, 'findByCode').resolves(invitation);
		sinon.stub(keycloakAdmin, 'createUser').resolves(session.sub);
		sinon.stub(keycloakLogin, 'passwordLogin').resolves(session);
		sinon.stub(repo, 'markAccepted').resolves(undefined);
		const deleteUser = sinon.stub(keycloakAdmin, 'deleteUser').resolves();

		const result = await service.register('newuser1', 'pw123', 'pw123', 'abc123');

		expect(result).toEqual({
			ok: false,
			error: 'Invitation is not pending',
			code: 409
		});
		sinon.assert.calledWith(deleteUser, session.sub);
	});

	it('rolls back the Keycloak user when marking the invitation accepted throws', async () => {
		sinon.stub(repo, 'findByCode').resolves(invitation);
		sinon.stub(keycloakAdmin, 'createUser').resolves(session.sub);
		sinon.stub(keycloakLogin, 'passwordLogin').resolves(session);
		sinon.stub(repo, 'markAccepted').throwsException(new Error('db error'));
		const deleteUser = sinon.stub(keycloakAdmin, 'deleteUser').resolves();

		const result = await service.register('newuser1', 'pw123', 'pw123', 'abc123');

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
		sinon.stub(repo, 'markAccepted').resolves({
			...invitation,
			status: 'accepted',
			used_by: session.sub
		});
		const upsertUser = sinon.stub(usersOps, 'upsertUser').resolves();

		const result = await service.register('newuser1', 'pw123', 'pw123', 'abc123');

		expect(result).toEqual({ ok: true, data: session, code: 201 });
		sinon.assert.calledWith(upsertUser, session.sub, session.iss, 'newuser1', null, false);
	});

	it('still succeeds when persisting the local user record fails', async () => {
		sinon.stub(repo, 'findByCode').resolves(invitation);
		sinon.stub(keycloakAdmin, 'createUser').resolves(session.sub);
		sinon.stub(keycloakLogin, 'passwordLogin').resolves(session);
		sinon.stub(repo, 'markAccepted').resolves({
			...invitation,
			status: 'accepted',
			used_by: session.sub
		});
		sinon.stub(usersOps, 'upsertUser').rejects(new Error('db error'));

		const result = await service.register('newuser1', 'pw123', 'pw123', 'abc123');

		expect(result).toEqual({ ok: true, data: session, code: 201 });
	});
});
