import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { PostsService } from '$lib/system/posts/postsService.server';

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
