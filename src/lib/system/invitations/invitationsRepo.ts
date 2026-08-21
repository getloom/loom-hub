import { Repo } from '$lib/db/repo';
import type { Invitation } from '$lib/system/invitations/invitationsService';

//TODO replace with a proper logger system
const log = console;

export class InvitationRepo extends Repo {
	async create(created_by: string, invite_code: string, expires_at?: Date): Promise<Invitation> {		
		log.debug(`[create] invitation for ${created_by}`);
		const data = await this.sql<Invitation[]>`
			INSERT INTO invitations (invite_code, created_by, expires_at) VALUES (
				${invite_code}, ${created_by}, ${expires_at}
			) RETURNING invite_id, invite_code, created_by, used_by, expires_at, created_at, updated_at
		`;
		log.debug('[create] result', data);
		return data[0];
	}

	async findAllByCreator(created_by: string): Promise<Invitation[]> {
		log.debug(`[findAllByCreator] invitations for ${created_by}`);
		const data = await this.sql<Invitation[]>`
			SELECT invite_id, invite_code, created_by, used_by, expires_at, created_at, updated_at
			FROM invitations
			WHERE created_by = ${created_by}
		`;
		log.debug('[findAllByCreator] result', data);
		return data;
	}
}
