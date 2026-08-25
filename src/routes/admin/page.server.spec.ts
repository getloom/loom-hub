import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Invitation } from '$lib/system/invitations/invitationsService';
import type { PageServerLoad } from './$types';

const { load } = await import('./+page.server');

function loadEvent(
	roles: string[] | undefined,
	fetch: ReturnType<typeof vi.fn>
): Parameters<PageServerLoad>[0] {
	return { locals: { roles }, fetch } as unknown as Parameters<PageServerLoad>[0];
}

describe('/admin load', () => {
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

	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
	});

	it('throws a 403 without calling fetch when the user lacks an admin role', async () => {
		await expect(load(loadEvent(['member'], fetchMock))).rejects.toMatchObject({ status: 403 });

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('returns invitations from the /api/admin response body when authorized', async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => [invitation]
		});

		const result = await load(loadEvent(['founder'], fetchMock));

		expect(result).toEqual({ invitations: [invitation] });
		expect(fetchMock).toHaveBeenCalledWith('/api/admin');
	});

	it('throws a SvelteKit error with the upstream status when the fetch response is not ok', async () => {
		fetchMock.mockResolvedValue({
			ok: false,
			status: 500,
			json: async () => 'Failed to list all invitations'
		});

		await expect(load(loadEvent(['leader'], fetchMock))).rejects.toMatchObject({
			status: 500,
			body: { message: 'Failed to list all invitations' }
		});
	});
});
