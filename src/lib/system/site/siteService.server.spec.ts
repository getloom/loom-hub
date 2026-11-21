import type { SiteRepo } from '$lib/system/site/siteRepo';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import sinon from 'sinon';
import type { SiteDeploy } from './siteService';

const { extractZipToDirectory } = vi.hoisted(() => ({
	extractZipToDirectory: vi.fn()
}));

vi.mock('$lib/system/site/siteExtractor.server', () => ({ extractZipToDirectory }));

const { SiteService } = await import('./siteService.server');

const deploy: SiteDeploy = {
	deploy_id: 1,
	filename: 'site.zip',
	size_bytes: 1234,
	file_count: 3,
	deployed_by: 'user-sub',
	deployed_at: new Date()
};

describe('deploying a site', () => {
	let service: InstanceType<typeof SiteService>;
	let repo: SiteRepo;

	beforeEach(() => {
		repo = { create: () => {} } as any as SiteRepo;
		service = new SiteService(repo);
		extractZipToDirectory.mockReset();
	});

	it('deploys a site with valid input', async () => {
		extractZipToDirectory.mockResolvedValue({ fileCount: 3 });
		const stub = sinon.stub(repo, 'create').resolves(deploy);
		const zipBuffer = Buffer.from('fake zip contents');

		const result = await service.deploy('site.zip', zipBuffer, 'user-sub');

		expect(result).toEqual({ ok: true, data: deploy, code: 201 });
		sinon.assert.calledWith(stub, 'site.zip', zipBuffer.length, 3, 'user-sub');
	});

	it('requires filename', async () => {
		const result = await service.deploy('', Buffer.from('x'), 'user-sub');

		expect(result).toEqual({ ok: false, error: 'filename is required', code: 400 });
	});

	it('requires a non-empty file', async () => {
		const result = await service.deploy('site.zip', Buffer.alloc(0), 'user-sub');

		expect(result).toEqual({ ok: false, error: 'file is required', code: 400 });
	});

	it('requires deployed_by', async () => {
		const result = await service.deploy('site.zip', Buffer.from('x'), '');

		expect(result).toEqual({ ok: false, error: 'deployed_by is required', code: 400 });
	});

	it('surfaces the extractor error message when extraction fails', async () => {
		extractZipToDirectory.mockRejectedValue(new Error('Zip entry escapes the target directory'));

		const result = await service.deploy('site.zip', Buffer.from('x'), 'user-sub');

		expect(result).toEqual({
			ok: false,
			error: 'Zip entry escapes the target directory',
			code: 500
		});
	});

	it('handles thrown errors from the repo', async () => {
		extractZipToDirectory.mockResolvedValue({ fileCount: 3 });
		sinon.stub(repo, 'create').throwsException(new Error('boom'));

		const result = await service.deploy('site.zip', Buffer.from('x'), 'user-sub');

		expect(result).toEqual({ ok: false, error: 'boom', code: 500 });
	});
});

describe('listing site deploys', () => {
	let service: InstanceType<typeof SiteService>;
	let repo: SiteRepo;

	beforeEach(() => {
		repo = { findAll: () => {} } as any as SiteRepo;
		service = new SiteService(repo);
	});

	it('lists deploys', async () => {
		const stub = sinon.stub(repo, 'findAll').resolves([deploy]);

		const result = await service.listDeploys();

		expect(result).toEqual({ ok: true, data: [deploy], code: 200 });
		sinon.assert.calledOnce(stub);
	});

	it('handles thrown errors', async () => {
		sinon.stub(repo, 'findAll').throwsException(new Error('boom'));

		const result = await service.listDeploys();

		expect(result).toEqual({ ok: false, error: 'Failed to list site deploys', code: 500 });
	});
});
