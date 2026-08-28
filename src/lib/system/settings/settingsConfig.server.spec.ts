import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import sinon from 'sinon';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { SettingsService } from './settingsService.server';
import { loadSettingsConfigOverrides, applyDefaultSettings } from './settingsConfig.server';

let dir: string | undefined;

afterEach(() => {
	if (dir) {
		rmSync(dir, { recursive: true, force: true });
		dir = undefined;
	}
});

function writeConfig(contents: string): string {
	dir = mkdtempSync(path.join(tmpdir(), 'settings-config-'));
	const filePath = path.join(dir, 'config.json');
	writeFileSync(filePath, contents);
	return filePath;
}

describe('loading settings config overrides', () => {
	it('returns an empty object when the file does not exist', async () => {
		const missingPath = path.join(tmpdir(), 'does-not-exist', 'config.json');

		const overrides = await loadSettingsConfigOverrides(missingPath);

		expect(overrides).toEqual({});
	});

	it('parses a valid flat JSON object', async () => {
		const filePath = writeConfig('{"invite_count_limit": "10"}');

		const overrides = await loadSettingsConfigOverrides(filePath);

		expect(overrides).toEqual({ invite_count_limit: '10' });
	});

	it('throws on invalid JSON', async () => {
		const filePath = writeConfig('{ not valid json');

		await expect(loadSettingsConfigOverrides(filePath)).rejects.toThrow();
	});

	it('throws when the top level is not an object', async () => {
		const filePath = writeConfig('[1, 2, 3]');

		await expect(loadSettingsConfigOverrides(filePath)).rejects.toThrow(
			'config.json must contain a flat JSON object'
		);
	});
});

const defaults = { invite_count_limit: '5', other_setting: 'default-value' };

describe('applying default settings', () => {
	let service: SettingsService;

	beforeEach(() => {
		service = { applyDefault: () => {} } as any as SettingsService;
	});

	it('applies every default when there are no overrides', async () => {
		const stub = sinon
			.stub(service, 'applyDefault')
			.resolves({ ok: true, data: undefined, code: 200 });

		await applyDefaultSettings(service, defaults, async () => ({}));

		expect(stub.callCount).toBe(2);
		sinon.assert.calledWith(stub, 'invite_count_limit', '5');
		sinon.assert.calledWith(stub, 'other_setting', 'default-value');
	});

	it('uses a string override in place of the default', async () => {
		const stub = sinon
			.stub(service, 'applyDefault')
			.resolves({ ok: true, data: undefined, code: 200 });

		await applyDefaultSettings(service, defaults, async () => ({ invite_count_limit: '10' }));

		expect(stub.callCount).toBe(2);
		sinon.assert.calledWith(stub, 'invite_count_limit', '10');
		sinon.assert.calledWith(stub, 'other_setting', 'default-value');
	});

	it('ignores a non-string override and warns', async () => {
		const stub = sinon
			.stub(service, 'applyDefault')
			.resolves({ ok: true, data: undefined, code: 200 });
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await applyDefaultSettings(service, defaults, async () => ({ invite_count_limit: 10 }));

		sinon.assert.calledWith(stub, 'invite_count_limit', '5');
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it('ignores an unknown key and warns, without calling applyDefault for it', async () => {
		const stub = sinon
			.stub(service, 'applyDefault')
			.resolves({ ok: true, data: undefined, code: 200 });
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await applyDefaultSettings(service, defaults, async () => ({ mystery_key: 'x' }));

		sinon.assert.neverCalledWith(stub, 'mystery_key', sinon.match.any);
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it('continues applying remaining keys if one throws', async () => {
		const stub = sinon.stub(service, 'applyDefault');
		stub.withArgs('invite_count_limit', '5').throws(new Error('boom'));
		stub
			.withArgs('other_setting', 'default-value')
			.resolves({ ok: true, data: undefined, code: 200 });

		await applyDefaultSettings(service, defaults, async () => ({}));

		expect(stub.callCount).toBe(2);
		sinon.assert.calledWith(stub, 'other_setting', 'default-value');
	});
});
