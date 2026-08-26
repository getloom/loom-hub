import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { InvitationService } from '$lib/system/invitations/invitationsService.server';
import { requireRole, ADMIN_ROLES } from '$lib/system/auth/roles.server';

export async function POST({ params, locals }: RequestEvent) {
	requireRole(locals, ADMIN_ROLES);

	const invite_id = Number(params.invite_id);

	if (!Number.isInteger(invite_id)) {
		return json('invite_id must be a valid integer', { status: 400 });
	}

	const result = await new InvitationService().revoke(invite_id);

	if (result.ok) {
		const { data, code } = result;
		return json(data, { status: code });
	} else {
		const { error, code } = result;
		return json(error, { status: code });
	}
}
