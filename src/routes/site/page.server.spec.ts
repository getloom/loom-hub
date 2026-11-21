import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SiteDeploy } from '$lib/system/site/siteService';
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

describe('/site load', () => {
	const deploy: SiteDeploy = {
		deploy_id: 1,
		filename: 'site.zip',
		size_bytes: 1234,
		file_count: 3,
		deployed_by: 'user-sub',
		deployed_at: new Date()
	};

	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
	});

	it('throws a 403 without calling fetch when the user lacks an admin role', async () => {
		await expect(load(loadEvent(['member'], fetchMock))).rejects.toMatchObject({ status: 403 });

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('returns deploys from the endpoint when authorized', async () => {
		fetchMock = mockFetchImpl({
			'/api/site': { ok: true, body: [deploy] }
		});

		const result = await load(loadEvent(['founder'], fetchMock));

		expect(result).toEqual({ deploys: [deploy] });
		expect(fetchMock).toHaveBeenCalledWith('/api/site');
	});

	it('throws a SvelteKit error with the upstream status when the deploys fetch is not ok', async () => {
		fetchMock = mockFetchImpl({
			'/api/site': { ok: false, status: 500, body: 'Failed to list site deploys' }
		});

		await expect(load(loadEvent(['leader'], fetchMock))).rejects.toMatchObject({
			status: 500,
			body: { message: 'Failed to list site deploys' }
		});
	});
});
