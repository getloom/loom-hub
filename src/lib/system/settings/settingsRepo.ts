import { Repo } from '$lib/db/repo';
import type { Setting } from '$lib/system/settings/settingsService';

//TODO replace with a proper logger system
const log = console;

export class SettingsRepo extends Repo {
	async findAll(): Promise<Setting[]> {
		log.debug('[findAll] all settings');
		const data = await this.sql<Setting[]>`
			SELECT settings_id, key, value, created_at, updated_at
			FROM settings
		`;
		log.debug('[findAll] result', data);
		return data;
	}

	async findByKey(key: string): Promise<Setting | undefined> {
		log.debug(`[findByKey] setting ${key}`);
		const data = await this.sql<Setting[]>`
			SELECT settings_id, key, value, created_at, updated_at
			FROM settings
			WHERE key = ${key}
		`;
		log.debug('[findByKey] result', data);
		return data[0];
	}

	async upsert(key: string, value: string): Promise<Setting> {
		log.debug(`[upsert] setting ${key}`);
		const data = await this.sql<Setting[]>`
			INSERT INTO settings (key, value)
			VALUES (${key}, ${value})
			ON CONFLICT (key) DO UPDATE
			SET value = EXCLUDED.value, updated_at = now()
			RETURNING settings_id, key, value, created_at, updated_at
		`;
		log.debug('[upsert] result', data);
		return data[0];
	}

	async delete(key: string): Promise<Setting | undefined> {
		log.debug(`[delete] setting ${key}`);
		const data = await this.sql<Setting[]>`
			DELETE FROM settings
			WHERE key = ${key}
			RETURNING settings_id, key, value, created_at, updated_at
		`;
		log.debug('[delete] result', data);
		return data[0];
	}
}
