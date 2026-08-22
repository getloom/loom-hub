import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { InvitationService } from '$lib/system/invitations/invitationsService.server';

export async function PUT({ request, params, locals }: RequestEvent) {
	const created_by = locals.keycloakSubject!;
	const invite_id = Number(params.invite_id);

	if (!Number.isInteger(invite_id)) {
		return json('invite_id must be a valid integer', { status: 400 });
	}

	const { expires_at } = await request.json();
	const parsedExpiresAt = new Date(expires_at);

	const result = await new InvitationService().update(created_by, invite_id, parsedExpiresAt);

	if (result.ok) {
		const { data, code } = result;
		return json(data, { status: code });
	} else {
		const { error, code } = result;
		return json(error, { status: code });
	}
}

export async function DELETE({ params, locals }: RequestEvent) {
	const created_by = locals.keycloakSubject!;
	const invite_id = Number(params.invite_id);

	if (!Number.isInteger(invite_id)) {
		return json('invite_id must be a valid integer', { status: 400 });
	}

	const result = await new InvitationService().delete(created_by, invite_id);

	if (result.ok) {
		const { data, code } = result;
		return json(data, { status: code });
	} else {
		const { error, code } = result;
		return json(error, { status: code });
	}
}
