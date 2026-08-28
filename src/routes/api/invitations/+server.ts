import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { InvitationService } from '$lib/system/invitations/invitationsService.server';

export async function POST({ request, locals }: RequestEvent) {
	const { expires_at } = await request.json();

	const created_by = locals.keycloakSubject!;
	const parsedExpiresAt = expires_at ? new Date(expires_at) : undefined;

	const result = await new InvitationService().create(
		created_by,
		parsedExpiresAt,
		locals.roles ?? []
	);

	if (result.ok) {
		const { data, code } = result;
		return json(data, { status: code });
	} else {
		const { error, code } = result;
		return json(error, { status: code });
	}
}

export async function GET({ locals }: RequestEvent) {
	const created_by = locals.keycloakSubject!;

	const result = await new InvitationService().listInvitations(created_by);

	if (result.ok) {
		const { data, code } = result;
		return json(data, { status: code });
	} else {
		const { error, code } = result;
		return json(error, { status: code });
	}
}
