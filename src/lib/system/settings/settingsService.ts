export type SettingId = number;

export interface Setting {
	settings_id: SettingId;
	key: string;
	value: unknown;
	created_at: Date;
	updated_at: Date | null;
}
