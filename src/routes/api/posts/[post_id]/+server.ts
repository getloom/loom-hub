import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { PostsService } from '$lib/system/posts/postsService.server';
import { requireRole, ADMIN_ROLES } from '$lib/system/auth/roles.server';

export async function GET({ params }: RequestEvent) {
	const post_id = Number(params.post_id);

	if (!Number.isInteger(post_id)) {
		return json('post_id must be a valid integer', { status: 400 });
	}

	const result = await new PostsService().get(post_id);

	if (result.ok) {
		const { data, code } = result;
		return json(data, { status: code });
	} else {
		const { error, code } = result;
		return json(error, { status: code });
	}
}

export async function PATCH({ params, request, locals }: RequestEvent) {
	requireRole(locals, ADMIN_ROLES);

	const post_id = Number(params.post_id);

	if (!Number.isInteger(post_id)) {
		return json('post_id must be a valid integer', { status: 400 });
	}

	const patch = await request.json();

	const result = await new PostsService().update(post_id, patch);

	if (result.ok) {
		const { data, code } = result;
		return json(data, { status: code });
	} else {
		const { error, code } = result;
		return json(error, { status: code });
	}
}

export async function DELETE({ params, locals }: RequestEvent) {
	requireRole(locals, ADMIN_ROLES);

	const post_id = Number(params.post_id);

	if (!Number.isInteger(post_id)) {
		return json('post_id must be a valid integer', { status: 400 });
	}

	const result = await new PostsService().delete(post_id);

	if (result.ok) {
		const { data, code } = result;
		return json(data, { status: code });
	} else {
		const { error, code } = result;
		return json(error, { status: code });
	}
}
