import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { InvitationService } from '$lib/system/invitations/invitationsService.server';

export async function POST({ request, locals }: RequestEvent) {
	const { expires_at } = await request.json();

	const created_by = locals.keycloakSubject!;
	const parsedExpiresAt = expires_at ? new Date(expires_at) : undefined;

	const result = await new InvitationService().create(created_by, parsedExpiresAt);

	if (result.ok) {
		const { data, code } = result;
		return json(data, { status: code });
	} else {
		const { error, code } = result;
		return json(error, { status: code });
	}
}
