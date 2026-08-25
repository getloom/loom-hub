import { error } from '@sveltejs/kit';
import { requireRole, ADMIN_ROLES } from '$lib/system/auth/roles.server';
import type { Invitation } from '$lib/system/invitations/invitationsService';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, fetch }) => {
	requireRole(locals, ADMIN_ROLES);

	const response = await fetch('/api/admin');
	const body = await response.json();

	if (!response.ok) {
		error(response.status, body as string);
	}

	return { invitations: body as Invitation[] };
};
