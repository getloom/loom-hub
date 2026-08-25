import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { InvitationService } from '$lib/system/invitations/invitationsService.server';
import { requireRole, ADMIN_ROLES } from '$lib/system/auth/roles.server';

export async function GET({ locals }: RequestEvent) {
	requireRole(locals, ADMIN_ROLES);

	const result = await new InvitationService().listAllInvitations();

	if (result.ok) {
		const { data, code } = result;
		return json(data, { status: code });
	} else {
		const { error, code } = result;
		return json(error, { status: code });
	}
}
