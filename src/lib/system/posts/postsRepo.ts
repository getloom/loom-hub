import { Repo } from '$lib/db/repo';
import type { Post, PostId, PostPatch } from '$lib/system/posts/postsService';

//TODO replace with a proper logger system
const log = console;

const EDITABLE_COLUMNS = ['type', 'title', 'body', 'link', 'image', 'active'] as const;

export class PostsRepo extends Repo {
	async create(
		created_by: string,
		type: string,
		title: string,
		body: string | null,
		link: string | null,
		image: string | null,
		active: boolean
	): Promise<Post> {
		log.debug(`[create] post for ${created_by}`);
		const data = await this.sql<Post[]>`
			INSERT INTO posts (type, title, body, link, image, active, created_by)
			VALUES (${type}, ${title}, ${body}, ${link}, ${image}, ${active}, ${created_by})
			RETURNING post_id, type, title, body, link, image, active, created_by, created_at, updated_at
		`;
		log.debug('[create] result', data);
		return data[0];
	}

	async findAll(): Promise<Post[]> {
		log.debug('[findAll] all posts');
		const data = await this.sql<Post[]>`
			SELECT post_id, type, title, body, link, image, active, created_by, created_at, updated_at
			FROM posts
		`;
		log.debug('[findAll] result', data);
		return data;
	}

	async findLatest(limit: number, type?: string): Promise<Post[]> {
		log.debug(`[findLatest] latest ${limit} posts`, { type });
		const data = await this.sql<Post[]>`
			SELECT post_id, type, title, body, link, image, active, created_by, created_at, updated_at
			FROM posts
			WHERE active = true
			${type ? this.sql`AND type = ${type}` : this.sql``}
			ORDER BY created_at DESC
			LIMIT ${limit}
		`;
		log.debug('[findLatest] result', data);
		return data;
	}

	async findById(post_id: PostId): Promise<Post | undefined> {
		log.debug(`[findById] post ${post_id}`);
		const data = await this.sql<Post[]>`
			SELECT post_id, type, title, body, link, image, active, created_by, created_at, updated_at
			FROM posts
			WHERE post_id = ${post_id}
		`;
		log.debug('[findById] result', data);
		return data[0];
	}

	async update(post_id: PostId, patch: PostPatch): Promise<Post | undefined> {
		log.debug(`[update] post ${post_id}`);
		const columns = EDITABLE_COLUMNS.filter((column) => patch[column] !== undefined);
		if (columns.length === 0) {
			log.debug('[update] empty patch, no-op');
			return this.findById(post_id);
		}
		const data = await this.sql<Post[]>`
			UPDATE posts
			SET ${this.sql(patch, ...columns)}, updated_at = now()
			WHERE post_id = ${post_id}
			RETURNING post_id, type, title, body, link, image, active, created_by, created_at, updated_at
		`;
		log.debug('[update] result', data);
		return data[0];
	}

	async delete(post_id: PostId): Promise<Post | undefined> {
		log.debug(`[delete] post ${post_id}`);
		const data = await this.sql<Post[]>`
			DELETE FROM posts
			WHERE post_id = ${post_id}
			RETURNING post_id, type, title, body, link, image, active, created_by, created_at, updated_at
		`;
		log.debug('[delete] result', data);
		return data[0];
	}
}
