import { error } from '@sveltejs/kit';
import type { Post } from '$lib/system/posts/postsService';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	const [newsResponse, motdResponse] = await Promise.all([
		fetch('/api/posts?limit=4&type=news'),
		fetch('/api/posts?limit=1&type=motd')
	]);

	const newsBody = await newsResponse.json();
	if (!newsResponse.ok) {
		error(newsResponse.status, newsBody as string);
	}

	const motdBody = await motdResponse.json();
	if (!motdResponse.ok) {
		error(motdResponse.status, motdBody as string);
	}

	return {
		posts: newsBody as Post[],
		motd: ((motdBody as Post[])[0] ?? null) as Post | null
	};
};
