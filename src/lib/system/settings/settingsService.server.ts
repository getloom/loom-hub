import type { Setting } from './settingsService';
import { SettingsRepo } from '$lib/system/settings/settingsRepo';
import postgres from 'postgres';
import { defaultPostgresOptions } from '$lib/db/postgres.server';

export interface Result<T> {
	ok: true;
	data: T;
	code: number;
}

export interface Error {
	ok: false;
	error: string;
	code: number;
}

//TODO replace with a proper logger system
const log = console;

//TODO create a Service class to extend
//TODO implement zod for schema validation at the API layer
export class SettingsService {
	settingsRepo: SettingsRepo;

	constructor(settingsRepo?: SettingsRepo) {
		this.settingsRepo = settingsRepo || new SettingsRepo(postgres(defaultPostgresOptions));
	}

	async listSettings(): Promise<Result<Setting[]> | Error> {
		try {
			const settings = await this.settingsRepo.findAll();
			return { ok: true, data: settings, code: 200 };
		} catch (error) {
			log.error('Error listing settings:', error);
			return { ok: false, error: 'Failed to list settings', code: 500 };
		}
	}

	async getSetting(key: string): Promise<Result<Setting> | Error> {
		if (!key) {
			return { ok: false, error: 'key is required', code: 400 };
		}

		try {
			const setting = await this.settingsRepo.findByKey(key);

			if (!setting) {
				return { ok: false, error: 'Setting not found', code: 404 };
			}

			return { ok: true, data: setting, code: 200 };
		} catch (error) {
			log.error('Error getting setting:', error);
			return { ok: false, error: 'Failed to get setting', code: 500 };
		}
	}

	async upsertSetting(key: string, value: unknown): Promise<Result<Setting> | Error> {
		if (!key) {
			return { ok: false, error: 'key is required', code: 400 };
		}
		if (value === undefined) {
			return { ok: false, error: 'value is required', code: 400 };
		}

		try {
			const setting = await this.settingsRepo.upsert(key, value);
			return { ok: true, data: setting, code: 200 };
		} catch (error) {
			log.error('Error upserting setting:', error);
			return { ok: false, error: 'Failed to upsert setting', code: 500 };
		}
	}

	async deleteSetting(key: string): Promise<Result<Setting> | Error> {
		if (!key) {
			return { ok: false, error: 'key is required', code: 400 };
		}

		try {
			const setting = await this.settingsRepo.delete(key);

			if (!setting) {
				return { ok: false, error: 'Setting not found', code: 404 };
			}

			return { ok: true, data: setting, code: 200 };
		} catch (error) {
			log.error('Error deleting setting:', error);
			return { ok: false, error: 'Failed to delete setting', code: 500 };
		}
	}
}
