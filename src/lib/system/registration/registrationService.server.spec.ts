import type { InvitationRepo } from '$lib/system/invitations/invitationsRepo';
import { RegistrationService } from '$lib/system/registration/registrationService.server';
import { describe, it, expect, beforeEach } from 'vitest';
import sinon from 'sinon';
import type { Invitation } from '$lib/system/invitations/invitationsService';

describe('registering an account', () => {
	let service: RegistrationService;
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
			findByCode: () => {}
		} as any as InvitationRepo;

		service = new RegistrationService(repo);
	});

	it('succeeds with a valid username, matching passwords, and a pending invite', async () => {
		const stub = sinon.stub(repo, 'findByCode').resolves(invitation);

		const result = await service.register('newuser1', 'pw123', 'pw123', 'abc123');

		expect(result).toEqual({ ok: true, data: null, code: 202 });
		sinon.assert.calledWith(stub, 'abc123');
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

	it('handles thrown errors', async () => {
		sinon.stub(repo, 'findByCode').throwsException(new Error('Thrown error for testing'));

		const result = await service.register('newuser1', 'pw123', 'pw123', 'abc123');

		expect(result).toEqual({
			ok: false,
			error: 'Failed to validate invitation',
			code: 500
		});
	});
});
