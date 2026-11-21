import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { SiteService } from '$lib/system/site/siteService.server';
import { requireRole, ADMIN_ROLES } from '$lib/system/auth/roles.server';

export async function POST({ request, locals }: RequestEvent) {
	requireRole(locals, ADMIN_ROLES);

	const formData = await request.formData();
	const file = formData.get('file');

	if (!(file instanceof File)) {
		return json('file is required', { status: 400 });
	}

	const buffer = Buffer.from(await file.arrayBuffer());
	const result = await new SiteService().deploy(file.name, buffer, locals.keycloakSubject!);

	if (result.ok) {
		const { data, code } = result;
		return json(data, { status: code });
	} else {
		const { error, code } = result;
		return json(error, { status: code });
	}
}

export async function GET({ locals }: RequestEvent) {
	requireRole(locals, ADMIN_ROLES);

	const result = await new SiteService().listDeploys();

	if (result.ok) {
		const { data, code } = result;
		return json(data, { status: code });
	} else {
		const { error, code } = result;
		return json(error, { status: code });
	}
}
