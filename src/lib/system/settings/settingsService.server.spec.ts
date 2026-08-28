import type { SettingsRepo } from '$lib/system/settings/settingsRepo';
import { SettingsService } from '$lib/system/settings/settingsService.server';
import { describe, it, expect, beforeEach } from 'vitest';
import sinon from 'sinon';
import type { Setting } from './settingsService';

const setting: Setting = {
	key: 'invite_count_limit',
	value: '5',
	created_at: new Date(),
	updated_at: null
};

describe('listing settings', () => {
	let service: SettingsService;
	let repo: SettingsRepo;

	beforeEach(() => {
		repo = { findAll: () => {} } as any as SettingsRepo;
		service = new SettingsService(repo);
	});

	it('returns all settings', async () => {
		sinon.stub(repo, 'findAll').resolves([setting]);

		const result = await service.listSettings();

		expect(result).toEqual({ ok: true, data: [setting], code: 200 });
	});

	it('handles thrown errors', async () => {
		sinon.stub(repo, 'findAll').throwsException(new Error('boom'));

		const result = await service.listSettings();

		expect(result).toEqual({ ok: false, error: 'Failed to list settings', code: 500 });
	});
});

describe('getting a setting', () => {
	let service: SettingsService;
	let repo: SettingsRepo;

	beforeEach(() => {
		repo = { findByKey: () => {} } as any as SettingsRepo;
		service = new SettingsService(repo);
	});

	it('returns the setting for a known key', async () => {
		const stub = sinon.stub(repo, 'findByKey').resolves(setting);

		const result = await service.getSetting('invite_count_limit');

		expect(result).toEqual({ ok: true, data: setting, code: 200 });
		sinon.assert.calledWith(stub, 'invite_count_limit');
	});

	it('returns 404 for an unknown key', async () => {
		sinon.stub(repo, 'findByKey').resolves(undefined);

		const result = await service.getSetting('missing');

		expect(result).toEqual({ ok: false, error: 'Setting not found', code: 404 });
	});

	it('handles validation errors', async () => {
		const result = await service.getSetting('');

		expect(result).toEqual({ ok: false, error: 'key is required', code: 400 });
	});

	it('handles thrown errors', async () => {
		sinon.stub(repo, 'findByKey').throwsException(new Error('boom'));

		const result = await service.getSetting('invite_count_limit');

		expect(result).toEqual({ ok: false, error: 'Failed to get setting', code: 500 });
	});
});

describe('upserting a setting', () => {
	let service: SettingsService;
	let repo: SettingsRepo;

	beforeEach(() => {
		repo = { upsert: () => {} } as any as SettingsRepo;
		service = new SettingsService(repo);
	});

	it('creates or updates the setting', async () => {
		const stub = sinon.stub(repo, 'upsert').resolves(setting);

		const result = await service.upsertSetting('invite_count_limit', '5');

		expect(result).toEqual({ ok: true, data: setting, code: 200 });
		sinon.assert.calledWith(stub, 'invite_count_limit', '5');
	});

	it('handles missing key', async () => {
		const result = await service.upsertSetting('', '5');

		expect(result).toEqual({ ok: false, error: 'key is required', code: 400 });
	});

	it('handles missing value', async () => {
		const result = await service.upsertSetting('invite_count_limit', undefined);

		expect(result).toEqual({ ok: false, error: 'value is required', code: 400 });
	});

	it('rejects a non-string value', async () => {
		const stub = sinon.stub(repo, 'upsert').resolves(setting);

		const result = await service.upsertSetting('invite_count_limit', { max: 5 });

		expect(result).toEqual({ ok: false, error: 'value must be a string', code: 400 });
		sinon.assert.notCalled(stub);
	});

	it('rejects a null value', async () => {
		const stub = sinon.stub(repo, 'upsert').resolves(setting);

		const result = await service.upsertSetting('invite_count_limit', null);

		expect(result).toEqual({ ok: false, error: 'value must be a string', code: 400 });
		sinon.assert.notCalled(stub);
	});

	it('handles thrown errors', async () => {
		sinon.stub(repo, 'upsert').throwsException(new Error('boom'));

		const result = await service.upsertSetting('invite_count_limit', '5');

		expect(result).toEqual({ ok: false, error: 'Failed to upsert setting', code: 500 });
	});
});

describe('applying a default setting', () => {
	let service: SettingsService;
	let repo: SettingsRepo;

	beforeEach(() => {
		repo = { insertIfMissing: () => {} } as any as SettingsRepo;
		service = new SettingsService(repo);
	});

	it('reports a newly created default', async () => {
		const stub = sinon.stub(repo, 'insertIfMissing').resolves(setting);

		const result = await service.applyDefault('invite_count_limit', '5');

		expect(result).toEqual({ ok: true, data: setting, code: 201 });
		sinon.assert.calledWith(stub, 'invite_count_limit', '5');
	});

	it('reports a no-op when the key already exists', async () => {
		sinon.stub(repo, 'insertIfMissing').resolves(undefined);

		const result = await service.applyDefault('invite_count_limit', '5');

		expect(result).toEqual({ ok: true, data: undefined, code: 200 });
	});

	it('handles thrown errors', async () => {
		sinon.stub(repo, 'insertIfMissing').throwsException(new Error('boom'));

		const result = await service.applyDefault('invite_count_limit', '5');

		expect(result).toEqual({ ok: false, error: 'Failed to apply default setting', code: 500 });
	});
});

describe('deleting a setting', () => {
	let service: SettingsService;
	let repo: SettingsRepo;

	beforeEach(() => {
		repo = { delete: () => {} } as any as SettingsRepo;
		service = new SettingsService(repo);
	});

	it('deletes the setting for a known key', async () => {
		const stub = sinon.stub(repo, 'delete').resolves(setting);

		const result = await service.deleteSetting('invite_count_limit');

		expect(result).toEqual({ ok: true, data: setting, code: 200 });
		sinon.assert.calledWith(stub, 'invite_count_limit');
	});

	it('returns 404 for an unknown key', async () => {
		sinon.stub(repo, 'delete').resolves(undefined);

		const result = await service.deleteSetting('missing');

		expect(result).toEqual({ ok: false, error: 'Setting not found', code: 404 });
	});

	it('handles validation errors', async () => {
		const result = await service.deleteSetting('');

		expect(result).toEqual({ ok: false, error: 'key is required', code: 400 });
	});

	it('handles thrown errors', async () => {
		sinon.stub(repo, 'delete').throwsException(new Error('boom'));

		const result = await service.deleteSetting('invite_count_limit');

		expect(result).toEqual({ ok: false, error: 'Failed to delete setting', code: 500 });
	});
});
