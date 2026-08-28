import { describe, it, expect } from 'vitest';
import { SETTINGS_FIELD_CONFIG } from './settingsFieldConfig';
import { INVITE_COUNT_CYCLES } from '$lib/system/invitations/invitationsService';

describe('SETTINGS_FIELD_CONFIG.invite_count_limit.validate', () => {
	const config = SETTINGS_FIELD_CONFIG.invite_count_limit;
	if (config.type !== 'number') throw new Error('expected invite_count_limit to be a number field');

	it.each(['-1', '0', '2', '100'])('accepts %s', (value) => {
		expect(config.validate(value)).toBeNull();
	});

	it.each(['-2', '1.5', 'abc', ''])('rejects %s', (value) => {
		expect(config.validate(value)).not.toBeNull();
	});
});

describe('SETTINGS_FIELD_CONFIG.invite_count_cycle.options', () => {
	const config = SETTINGS_FIELD_CONFIG.invite_count_cycle;
	if (config.type !== 'select') throw new Error('expected invite_count_cycle to be a select field');

	it('matches INVITE_COUNT_CYCLES exactly', () => {
		expect(config.options.map((option) => option.value).sort()).toEqual(
			[...INVITE_COUNT_CYCLES].sort()
		);
	});
});
