import { ADMIN_ROLES, hasAnyRole } from '$lib/system/auth/roles.server';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		isAuthenticated: !!locals.keycloakSubject,
		isAdmin: hasAnyRole(locals.roles, ADMIN_ROLES)
	};
};
