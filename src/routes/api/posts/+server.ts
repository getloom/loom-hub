import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { PostsService } from '$lib/system/posts/postsService.server';
import { requireRole, ADMIN_ROLES } from '$lib/system/auth/roles.server';

export async function POST({ request, locals }: RequestEvent) {
	requireRole(locals, ADMIN_ROLES);

	const { type, title, body, link, image, active } = await request.json();
	const created_by = locals.keycloakSubject!;

	const result = await new PostsService().create(
		created_by,
		type,
		title,
		body ?? null,
		link ?? null,
		image ?? null,
		active ?? true
	);

	if (result.ok) {
		const { data, code } = result;
		return json(data, { status: code });
	} else {
		const { error, code } = result;
		return json(error, { status: code });
	}
}
