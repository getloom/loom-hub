import { error } from '@sveltejs/kit';
import { InvitationService } from '$lib/system/invitations/invitationsService.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const result = await new InvitationService().listInvitations(locals.keycloakSubject!);

	if (!result.ok) {
		error(result.code, result.error);
	}

	return { invitations: result.data };
};
