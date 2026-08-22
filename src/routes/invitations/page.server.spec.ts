import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Invitation } from '$lib/system/invitations/invitationsService';
import type { PageServerLoad } from './$types';

const listInvitations = vi.fn();

vi.mock('$lib/system/invitations/invitationsService.server', () => ({
	InvitationService: vi.fn().mockImplementation(function (this: {
		listInvitations: typeof listInvitations;
	}) {
		this.listInvitations = listInvitations;
	})
}));

const { load } = await import('./+page.server');

function loadEvent(keycloakSubject: string): Parameters<PageServerLoad>[0] {
	return { locals: { keycloakSubject } } as unknown as Parameters<PageServerLoad>[0];
}

describe('/invitations load', () => {
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
		listInvitations.mockReset();
	});

	it('returns the invitations for the signed-in user', async () => {
		listInvitations.mockResolvedValue({ ok: true, data: [invitation], code: 200 });

		const result = await load(loadEvent('user-sub'));

		expect(result).toEqual({ invitations: [invitation] });
		expect(listInvitations).toHaveBeenCalledWith('user-sub');
	});

	it('throws a SvelteKit error when the service call fails', async () => {
		listInvitations.mockResolvedValue({
			ok: false,
			error: 'Failed to list invitations',
			code: 500
		});

		await expect(load(loadEvent('user-sub'))).rejects.toMatchObject({
			status: 500,
			body: { message: 'Failed to list invitations' }
		});
	});
});
