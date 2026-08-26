import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { SettingsService } from '$lib/system/settings/settingsService.server';
import { requireRole, ADMIN_ROLES } from '$lib/system/auth/roles.server';

export async function GET({ params, locals }: RequestEvent) {
	requireRole(locals, ADMIN_ROLES);

	const result = await new SettingsService().getSetting(params.key!);

	if (result.ok) {
		const { data, code } = result;
		return json(data, { status: code });
	} else {
		const { error, code } = result;
		return json(error, { status: code });
	}
}

export async function PUT({ params, request, locals }: RequestEvent) {
	requireRole(locals, ADMIN_ROLES);

	const { value } = await request.json();

	const result = await new SettingsService().upsertSetting(params.key!, value);

	if (result.ok) {
		const { data, code } = result;
		return json(data, { status: code });
	} else {
		const { error, code } = result;
		return json(error, { status: code });
	}
}

export async function DELETE({ params, locals }: RequestEvent) {
	requireRole(locals, ADMIN_ROLES);

	const result = await new SettingsService().deleteSetting(params.key!);

	if (result.ok) {
		const { data, code } = result;
		return json(data, { status: code });
	} else {
		const { error, code } = result;
		return json(error, { status: code });
	}
}
