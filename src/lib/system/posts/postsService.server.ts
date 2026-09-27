import type { Post } from './postsService';
import { PostsRepo } from '$lib/system/posts/postsRepo';
import postgres from 'postgres';
import { defaultPostgresOptions } from '$lib/db/postgres.server';

export interface Result<T> {
	ok: true;
	data: T;
	code: number;
}

export interface Error {
	ok: false;
	error: string;
	code: number;
}

//TODO replace with a proper logger system
const log = console;

//TODO create a Service class to extend
//TODO implement zod for schema validation at the API layer
export class PostsService {
	postsRepo: PostsRepo;

	constructor(postsRepo?: PostsRepo) {
		this.postsRepo = postsRepo || new PostsRepo(postgres(defaultPostgresOptions));
	}

	async create(
		created_by: string,
		type: string,
		title: string,
		body: string | null,
		link: string | null,
		image: string | null,
		active: boolean
	): Promise<Result<Post> | Error> {
		if (!created_by) {
			return { ok: false, error: 'created_by is required', code: 400 };
		}
		if (!type) {
			return { ok: false, error: 'type is required', code: 400 };
		}
		if (!title) {
			return { ok: false, error: 'title is required', code: 400 };
		}

		try {
			const post = await this.postsRepo.create(created_by, type, title, body, link, image, active);
			return { ok: true, data: post, code: 201 };
		} catch (error) {
			log.error('Error creating post:', error);
			return { ok: false, error: 'Failed to create post', code: 500 };
		}
	}
}
