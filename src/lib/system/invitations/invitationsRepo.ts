import { Repo } from '$lib/db/repo';
import type {
	Invitation,
	InvitationId,
	InvitationWithUsernames
} from '$lib/system/invitations/invitationsService';

//TODO replace with a proper logger system
const log = console;

export class InvitationRepo extends Repo {
	async create(created_by: string, invite_code: string, expires_at?: Date): Promise<Invitation> {
		log.debug(`[create] invitation for ${created_by}`);
		const data = await this.sql<Invitation[]>`
			INSERT INTO invitations (invite_code, created_by, expires_at) VALUES (
				${invite_code}, ${created_by}, ${expires_at}
			) RETURNING invite_id, invite_code, created_by, used_by, status, expires_at, created_at, updated_at
		`;
		log.debug('[create] result', data);
		return data[0];
	}

	async findAll(): Promise<InvitationWithUsernames[]> {
		log.debug('[findAll] all invitations');
		const data = await this.sql<InvitationWithUsernames[]>`
			SELECT
				invitations.invite_id, invitations.invite_code, invitations.created_by, invitations.used_by,
				invitations.status, invitations.expires_at, invitations.created_at, invitations.updated_at,
				creator.username AS created_by_username,
				acceptor.username AS used_by_username
			FROM invitations
			LEFT JOIN users creator ON creator.sub = invitations.created_by
			LEFT JOIN users acceptor ON acceptor.sub = invitations.used_by
		`;
		log.debug('[findAll] result', data);
		return data;
	}

	async findAllByCreator(created_by: string): Promise<InvitationWithUsernames[]> {
		log.debug(`[findAllByCreator] invitations for ${created_by}`);
		const data = await this.sql<InvitationWithUsernames[]>`
			SELECT
				invitations.invite_id, invitations.invite_code, invitations.created_by, invitations.used_by,
				invitations.status, invitations.expires_at, invitations.created_at, invitations.updated_at,
				creator.username AS created_by_username,
				acceptor.username AS used_by_username
			FROM invitations
			LEFT JOIN users creator ON creator.sub = invitations.created_by
			LEFT JOIN users acceptor ON acceptor.sub = invitations.used_by
			WHERE invitations.created_by = ${created_by}
		`;
		log.debug('[findAllByCreator] result', data);
		return data;
	}

	async updateExpiration(
		invite_id: InvitationId,
		created_by: string,
		expires_at: Date
	): Promise<Invitation | undefined> {
		log.debug(`[updateExpiration] invitation ${invite_id} for ${created_by}`);
		const data = await this.sql<Invitation[]>`
			UPDATE invitations
			SET expires_at = ${expires_at}, updated_at = now()
			WHERE invite_id = ${invite_id} AND created_by = ${created_by}
			RETURNING invite_id, invite_code, created_by, used_by, status, expires_at, created_at, updated_at
		`;
		log.debug('[updateExpiration] result', data);
		return data[0];
	}

	async markAccepted(invite_code: string, used_by: string): Promise<Invitation | undefined> {
		log.debug(`[markAccepted] invitation ${invite_code} used by ${used_by}`);
		const data = await this.sql<Invitation[]>`
			UPDATE invitations
			SET status = 'accepted', used_by = ${used_by}, updated_at = now()
			WHERE invite_code = ${invite_code} AND status = 'pending'
			RETURNING invite_id, invite_code, created_by, used_by, status, expires_at, created_at, updated_at
		`;
		log.debug('[markAccepted] result', data);
		return data[0];
	}

	async findById(invite_id: InvitationId, created_by: string): Promise<Invitation | undefined> {
		log.debug(`[findById] invitation ${invite_id} for ${created_by}`);
		const data = await this.sql<Invitation[]>`
			SELECT invite_id, invite_code, created_by, used_by, status, expires_at, created_at, updated_at
			FROM invitations
			WHERE invite_id = ${invite_id} AND created_by = ${created_by}
		`;
		log.debug('[findById] result', data);
		return data[0];
	}

	async findByCode(invite_code: string): Promise<Invitation | undefined> {
		log.debug(`[findByCode] invitation for code ${invite_code}`);
		const data = await this.sql<Invitation[]>`
			SELECT invite_id, invite_code, created_by, used_by, status, expires_at, created_at, updated_at
			FROM invitations
			WHERE invite_code = ${invite_code}
		`;
		log.debug('[findByCode] result', data);
		return data[0];
	}

	async findByIdAdmin(invite_id: InvitationId): Promise<Invitation | undefined> {
		log.debug(`[findByIdAdmin] invitation ${invite_id}`);
		const data = await this.sql<Invitation[]>`
			SELECT invite_id, invite_code, created_by, used_by, status, expires_at, created_at, updated_at
			FROM invitations
			WHERE invite_id = ${invite_id}
		`;
		log.debug('[findByIdAdmin] result', data);
		return data[0];
	}

	async revoke(invite_id: InvitationId): Promise<Invitation | undefined> {
		log.debug(`[revoke] invitation ${invite_id}`);
		const data = await this.sql<Invitation[]>`
			UPDATE invitations
			SET status = 'revoked', updated_at = now()
			WHERE invite_id = ${invite_id} AND status = 'accepted'
			RETURNING invite_id, invite_code, created_by, used_by, status, expires_at, created_at, updated_at
		`;
		log.debug('[revoke] result', data);
		return data[0];
	}

	async delete(invite_id: InvitationId, created_by: string): Promise<Invitation | undefined> {
		log.debug(`[delete] invitation ${invite_id} for ${created_by}`);
		const data = await this.sql<Invitation[]>`
			DELETE FROM invitations
			WHERE invite_id = ${invite_id} AND created_by = ${created_by}
			RETURNING invite_id, invite_code, created_by, used_by, status, expires_at, created_at, updated_at
		`;
		log.debug('[delete] result', data);
		return data[0];
	}

	async countActiveByCreatorSince(created_by: string, since: Date | null): Promise<number> {
		log.debug(`[countActiveByCreatorSince] counting invitations for ${created_by} since ${since}`);
		const data = since
			? await this.sql<{ count: number }[]>`
				SELECT COUNT(*)::int AS count
				FROM invitations
				WHERE created_by = ${created_by}
				  AND status != 'expired'
				  AND created_at >= ${since}
			`
			: await this.sql<{ count: number }[]>`
				SELECT COUNT(*)::int AS count
				FROM invitations
				WHERE created_by = ${created_by}
				  AND status != 'expired'
			`;
		log.debug('[countActiveByCreatorSince] result', data);
		return data[0].count;
	}

	async expireOverdue(): Promise<Invitation[]> {
		const data = await this.sql<Invitation[]>`
			UPDATE invitations
			SET status = 'expired', updated_at = now()
			WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < now()
			RETURNING invite_id, invite_code, created_by, used_by, status, expires_at, created_at, updated_at
		`;
		if (data.length > 0) {
			log.debug('[expireOverdue] expired ', data.length);
		}
		return data;
	}
}
