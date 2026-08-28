import { error } from '@sveltejs/kit';
import { requireRole, ADMIN_ROLES } from '$lib/system/auth/roles.server';
import type { InvitationWithUsernames } from '$lib/system/invitations/invitationsService';
import type { Setting } from '$lib/system/settings/settingsService';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, fetch }) => {
	requireRole(locals, ADMIN_ROLES);

	const [invitationsResponse, settingsResponse] = await Promise.all([
		fetch('/api/admin'),
		fetch('/api/admin/settings')
	]);

	const invitationsBody = await invitationsResponse.json();
	if (!invitationsResponse.ok) {
		error(invitationsResponse.status, invitationsBody as string);
	}

	const settingsBody = await settingsResponse.json();
	if (!settingsResponse.ok) {
		error(settingsResponse.status, settingsBody as string);
	}

	return {
		invitations: invitationsBody as InvitationWithUsernames[],
		settings: settingsBody as Setting[]
	};
};
