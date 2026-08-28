import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { InvitationWithUsernames } from '$lib/system/invitations/invitationsService';
import type { Setting } from '$lib/system/settings/settingsService';
import type { PageServerLoad } from './$types';

const { load } = await import('./+page.server');

function loadEvent(
	roles: string[] | undefined,
	fetch: ReturnType<typeof vi.fn>
): Parameters<PageServerLoad>[0] {
	return { locals: { roles }, fetch } as unknown as Parameters<PageServerLoad>[0];
}

function mockFetchImpl(
	responses: Record<string, { ok: boolean; status?: number; body: unknown }>
): ReturnType<typeof vi.fn> {
	return vi.fn((url: string) => {
		const response = responses[url];
		return Promise.resolve({
			ok: response.ok,
			status: response.status ?? (response.ok ? 200 : 500),
			json: async () => response.body
		});
	});
}

describe('/admin load', () => {
	const invitation: InvitationWithUsernames = {
		invite_id: 1,
		invite_code: 'abc123',
		created_by: 'user-sub',
		used_by: null,
		status: 'pending',
		expires_at: new Date('2026-11-19'),
		created_at: new Date(),
		updated_at: null,
		created_by_username: 'alice',
		used_by_username: null
	};

	const setting: Setting = {
		key: 'invite_count_limit',
		value: '2',
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

	it('returns invitations and settings from both endpoints when authorized', async () => {
		fetchMock = mockFetchImpl({
			'/api/admin': { ok: true, body: [invitation] },
			'/api/admin/settings': { ok: true, body: [setting] }
		});

		const result = await load(loadEvent(['founder'], fetchMock));

		expect(result).toEqual({ invitations: [invitation], settings: [setting] });
		expect(fetchMock).toHaveBeenCalledWith('/api/admin');
		expect(fetchMock).toHaveBeenCalledWith('/api/admin/settings');
	});

	it('throws a SvelteKit error with the upstream status when the invitations fetch is not ok', async () => {
		fetchMock = mockFetchImpl({
			'/api/admin': { ok: false, status: 500, body: 'Failed to list all invitations' },
			'/api/admin/settings': { ok: true, body: [setting] }
		});

		await expect(load(loadEvent(['leader'], fetchMock))).rejects.toMatchObject({
			status: 500,
			body: { message: 'Failed to list all invitations' }
		});
	});

	it('throws a SvelteKit error with the upstream status when the settings fetch is not ok', async () => {
		fetchMock = mockFetchImpl({
			'/api/admin': { ok: true, body: [invitation] },
			'/api/admin/settings': { ok: false, status: 500, body: 'Failed to list settings' }
		});

		await expect(load(loadEvent(['leader'], fetchMock))).rejects.toMatchObject({
			status: 500,
			body: { message: 'Failed to list settings' }
		});
	});
});
