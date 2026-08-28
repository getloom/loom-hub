import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { SettingsService } from '$lib/system/settings/settingsService.server';

//TODO replace with a proper logger system
const log = console;

export const DEFAULT_SETTINGS: Record<string, string> = {
	invite_count_limit: '2',
	invite_count_cycle: 'year',	
};

const DEFAULT_CONFIG_PATH = path.resolve(process.cwd(), 'config.json');

export async function loadSettingsConfigOverrides(
	configPath: string = DEFAULT_CONFIG_PATH
): Promise<Record<string, unknown>> {
	let raw: string;
	try {
		raw = await readFile(configPath, 'utf-8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			log.debug(`[loadSettingsConfigOverrides] no config.json found at ${configPath}`);
			return {};
		}
		throw error;
	}

	const parsed: unknown = JSON.parse(raw);
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw new Error(`config.json must contain a flat JSON object, got: ${raw}`);
	}
	return parsed as Record<string, unknown>;
}

export async function applyDefaultSettings(
	service: SettingsService = new SettingsService(),
	defaults: Record<string, string> = DEFAULT_SETTINGS,
	loadOverrides: () => Promise<Record<string, unknown>> = loadSettingsConfigOverrides
): Promise<void> {
	const overrides = await loadOverrides();

	for (const key of Object.keys(overrides)) {
		if (!(key in defaults)) {
			log.warn(`[applyDefaultSettings] ignoring unknown config.json key "${key}"`);
		}
	}

	for (const [key, defaultValue] of Object.entries(defaults)) {
		const override = overrides[key];
		let value = defaultValue;
		if (override !== undefined) {
			if (typeof override === 'string') {
				value = override;
			} else {
				log.warn(`[applyDefaultSettings] ignoring non-string config.json value for "${key}"`);
			}
		}

		try {
			const result = await service.applyDefault(key, value);
			if (!result.ok) {
				log.error(`[applyDefaultSettings] failed to apply default for "${key}":`, result.error);
			} else if (result.data) {
				log.debug(`[applyDefaultSettings] inserted default for "${key}"`);
			}
		} catch (error) {
			log.error(`[applyDefaultSettings] unexpected error applying default for "${key}":`, error);
		}
	}
}
