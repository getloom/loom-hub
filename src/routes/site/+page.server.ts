import { error } from '@sveltejs/kit';
import { requireRole, ADMIN_ROLES } from '$lib/system/auth/roles.server';
import type { SiteDeploy } from '$lib/system/site/siteService';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, fetch }) => {
	requireRole(locals, ADMIN_ROLES);

	const response = await fetch('/api/site');
	const body = await response.json();
	if (!response.ok) {
		error(response.status, body as string);
	}

	return {
		deploys: body as SiteDeploy[]
	};
};
