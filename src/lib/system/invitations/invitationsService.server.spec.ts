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
		expires_at: new Date('2026-11-19'),
		created_at: new Date(),
		updated_at: null
	};

	beforeEach(() => {
		repo = {
			create: () => {}
		} as any as InvitationRepo;

		service = new InvitationService(repo);
	});

	it('creates an invitation with a default expiration when none is provided', async () => {
		const stub = sinon.stub(repo, 'create').resolves(invitation);

		const result = await service.create('user-sub');

		expect(result).toEqual({ ok: true, data: invitation, code: 201 });
		const [createdBy, expiresAt] = stub.firstCall.args;
		expect(createdBy).toBe('user-sub');
		const daysOut = Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
		expect(daysOut).toBe(90);
	});

	it('creates an invitation with a caller-supplied expiration', async () => {
		const customExpiresAt = new Date('2027-01-01');
		const stub = sinon.stub(repo, 'create').resolves(invitation);

		const result = await service.create('user-sub', customExpiresAt);

		expect(result).toEqual({ ok: true, data: invitation, code: 201 });
		sinon.assert.calledWith(stub, 'user-sub', customExpiresAt);
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
