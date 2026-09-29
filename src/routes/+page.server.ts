import { error } from '@sveltejs/kit';
import type { Post } from '$lib/system/posts/postsService';
import { PostsService } from '$lib/system/posts/postsService.server';
import type { PageServerLoad } from './$types';

const DEFAULT_MOTD_CREATED_BY = 'system';
const DEFAULT_MOTD_TITLE = 'Message of the Day';
const DEFAULT_MOTD_BODY = 'Welcome to your new Loom hub!';

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

	let motd = ((motdBody as Post[])[0] ?? null) as Post | null;

	if (!motd) {
		const result = await new PostsService().create(
			DEFAULT_MOTD_CREATED_BY,
			'motd',
			DEFAULT_MOTD_TITLE,
			DEFAULT_MOTD_BODY,
			null,
			null,
			true
		);
		if (result.ok) {
			motd = result.data;
		}
	}

	return {
		posts: newsBody as Post[],
		motd
	};
};
