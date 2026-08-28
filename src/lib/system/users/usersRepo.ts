import { Repo } from '$lib/db/repo';
import type { User } from '$lib/system/users/usersService';

//TODO replace with a proper logger system
const log = console;

export class UsersRepo extends Repo {
	async upsert(
		sub: string,
		username: string,
		email: string | null,
		email_verified: boolean
	): Promise<User> {
		log.debug(`[upsert] user ${sub}`);
		const data = await this.sql<User[]>`
			INSERT INTO users (sub, username, email, email_verified)
			VALUES (${sub}, ${username}, ${email}, ${email_verified})
			ON CONFLICT (sub) DO UPDATE
			SET username = EXCLUDED.username,
			    email = EXCLUDED.email,
			    email_verified = EXCLUDED.email_verified,
			    updated_at = now()
			RETURNING sub, username, email, email_verified, created_at, updated_at
		`;
		log.debug('[upsert] result', data);
		return data[0];
	}

	async findAll(): Promise<User[]> {
		log.debug('[findAll] all users');
		const data = await this.sql<User[]>`
			SELECT sub, username, email, email_verified, created_at, updated_at
			FROM users
		`;
		log.debug('[findAll] result', data);
		return data;
	}

	async findBySub(sub: string): Promise<User | undefined> {
		log.debug(`[findBySub] user ${sub}`);
		const data = await this.sql<User[]>`
			SELECT sub, username, email, email_verified, created_at, updated_at
			FROM users
			WHERE sub = ${sub}
		`;
		log.debug('[findBySub] result', data);
		return data[0];
	}
}
