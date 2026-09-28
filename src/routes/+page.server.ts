import { error } from '@sveltejs/kit';
import type { Post } from '$lib/system/posts/postsService';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	const response = await fetch('/api/posts?limit=4');
	const body = await response.json();

	if (!response.ok) {
		error(response.status, body as string);
	}

	return {
		posts: body as Post[]
	};
};
