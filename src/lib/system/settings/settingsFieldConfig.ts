import { INVITE_COUNT_CYCLES } from '$lib/system/invitations/invitationsService';

export type SettingFieldConfig =
	| {
			type: 'select';
			label: string;
			description: string;
			options: { label: string; value: string }[];
	  }
	| {
			type: 'number';
			label: string;
			description: string;
			validate: (value: string) => string | null;
	  };

function capitalize(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

export const SETTINGS_FIELD_CONFIG: Record<string, SettingFieldConfig> = {
	invite_count_limit: {
		type: 'number',
		label: 'Invite Count Limit',
		description:
			'Invitations a user can create per cycle. Use -1 for unlimited, 0 to restrict to founders only.',
		validate: (value) => {
			if (!/^-?\d+$/.test(value.trim())) {
				return 'Must be -1 (unlimited) or a non-negative integer';
			}
			const parsed = Number(value);
			if (parsed < 0 && parsed !== -1) {
				return 'Must be -1 (unlimited) or a non-negative integer';
			}
			return null;
		}
	},
	invite_count_cycle: {
		type: 'select',
		label: 'Invite Count Cycle',
		description: 'Cadence over which the invite count limit is tracked.',
		options: INVITE_COUNT_CYCLES.map((cycle) => ({ label: capitalize(cycle), value: cycle }))
	}
};
