import { Repo } from '$lib/db/repo';
import {
	REDEEMABLE_STATUSES,
	type Invitation,
	type InvitationId,
	type InvitationWithUsernames,
	type Redemption
} from '$lib/system/invitations/invitationsService';

//TODO replace with a proper logger system
const log = console;

export type RedeemResult =
	| { ok: true; invitation: Invitation }
	| { ok: false; reason: 'not_found' | 'not_redeemable' | 'limit_reached' };

export class InvitationRepo extends Repo {
	/** Shared column list for single-table queries on `invitations`. */
	private get columns() {
		return this.sql`
			invite_id, invite_code, created_by, status, max_uses, use_count, limit_exempt,
			expires_at, created_at, updated_at
		`;
	}

	/** Select list + joins for listing invitations with creator username and redemptions. */
	private get listSelect() {
		return this.sql`
			SELECT
				invitations.invite_id, invitations.invite_code, invitations.created_by,
				invitations.status, invitations.max_uses, invitations.use_count, invitations.limit_exempt,
				invitations.expires_at, invitations.created_at, invitations.updated_at,
				creator.username AS created_by_username,
				redeemers.redemptions
			FROM invitations
			LEFT JOIN users creator ON creator.sub = invitations.created_by
			LEFT JOIN LATERAL (
				SELECT COALESCE(json_agg(json_build_object(
					'redemption_id', r.redemption_id, 'invite_id', r.invite_id, 'user_sub', r.user_sub,
					'username', u.username, 'status', r.status,
					'created_at', r.created_at, 'revoked_at', r.revoked_at
				) ORDER BY r.created_at), '[]'::json) AS redemptions
				FROM invitation_redemptions r LEFT JOIN users u ON u.sub = r.user_sub
				WHERE r.invite_id = invitations.invite_id
			) redeemers ON true
		`;
	}

	async create(
		created_by: string,
		invite_code: string,
		expires_at: Date | undefined,
		max_uses: number | null,
		limit_exempt: boolean
	): Promise<Invitation> {
		log.debug(`[create] invitation for ${created_by}`);
		const data = await this.sql<Invitation[]>`
			INSERT INTO invitations (invite_code, created_by, expires_at, max_uses, limit_exempt) VALUES (
				${invite_code}, ${created_by}, ${expires_at ?? null}, ${max_uses}, ${limit_exempt}
			) RETURNING ${this.columns}
		`;
		log.debug('[create] result', data);
		return data[0];
	}

	async findAll(): Promise<InvitationWithUsernames[]> {
		log.debug('[findAll] all invitations');
		const data = await this.sql<InvitationWithUsernames[]>`${this.listSelect}`;
		log.debug('[findAll] result', data);
		return data;
	}

	async findAllByCreator(created_by: string): Promise<InvitationWithUsernames[]> {
		log.debug(`[findAllByCreator] invitations for ${created_by}`);
		const data = await this.sql<InvitationWithUsernames[]>`
			${this.listSelect}
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
			RETURNING ${this.columns}
		`;
		log.debug('[updateExpiration] result', data);
		return data[0];
	}

	/**
	 * Atomically redeems one use of an invitation: locks the row, validates that it is
	 * redeemable, enforces the creator's cycle limit, records the redemption and bumps use_count.
	 */
	async redeem(
		invite_code: string,
		user_sub: string,
		limit: { max: number; since: Date | null } | null // null = unlimited
	): Promise<RedeemResult> {
		log.debug(`[redeem] invitation ${invite_code} by ${user_sub}`);
		return this.sql.begin(async (tx): Promise<RedeemResult> => {
			const rows = await tx<(Invitation & { overdue: boolean })[]>`
				SELECT invite_id, created_by, status, max_uses, use_count, limit_exempt,
					(expires_at IS NOT NULL AND expires_at < now()) AS overdue
				FROM invitations
				WHERE lower(invite_code) = lower(${invite_code})
				FOR UPDATE
			`;
			const row = rows[0];
			if (!row) return { ok: false, reason: 'not_found' };

			const exhausted = row.max_uses !== null && row.use_count >= row.max_uses;
			if (!REDEEMABLE_STATUSES.includes(row.status) || row.overdue || exhausted) {
				return { ok: false, reason: 'not_redeemable' };
			}

			if (!row.limit_exempt && limit) {
				const counted = await tx<{ count: number }[]>`
					SELECT COUNT(*)::int AS count
					FROM invitation_redemptions r
					JOIN invitations i ON i.invite_id = r.invite_id
					WHERE i.created_by = ${row.created_by}
					  AND (${limit.since}::timestamptz IS NULL OR r.created_at >= ${limit.since})
				`;
				if (counted[0].count >= limit.max) return { ok: false, reason: 'limit_reached' };
			}

			await tx`
				INSERT INTO invitation_redemptions (invite_id, user_sub)
				VALUES (${row.invite_id}, ${user_sub})
			`;
			const updated = await tx<Invitation[]>`
				UPDATE invitations
				SET use_count = use_count + 1,
					status = CASE
						WHEN max_uses IS NOT NULL AND use_count + 1 >= max_uses THEN 'accepted'
						ELSE 'active'
					END,
					updated_at = now()
				WHERE invite_id = ${row.invite_id}
				RETURNING ${this.columns}
			`;
			log.debug('[redeem] result', updated);
			return { ok: true, invitation: updated[0] };
		});
	}

	async findRedemption(
		invite_id: InvitationId,
		redemption_id: number
	): Promise<Redemption | undefined> {
		log.debug(`[findRedemption] redemption ${redemption_id} of invitation ${invite_id}`);
		const data = await this.sql<Redemption[]>`
			SELECT r.redemption_id, r.invite_id, r.user_sub, u.username, r.status, r.created_at, r.revoked_at
			FROM invitation_redemptions r
			LEFT JOIN users u ON u.sub = r.user_sub
			WHERE r.invite_id = ${invite_id} AND r.redemption_id = ${redemption_id}
		`;
		log.debug('[findRedemption] result', data);
		return data[0];
	}

	async revokeRedemption(redemption_id: number): Promise<Redemption | undefined> {
		log.debug(`[revokeRedemption] redemption ${redemption_id}`);
		const data = await this.sql<Redemption[]>`
			UPDATE invitation_redemptions
			SET status = 'revoked', revoked_at = now()
			WHERE redemption_id = ${redemption_id} AND status = 'active'
			RETURNING redemption_id, invite_id, user_sub, NULL::text AS username, status, created_at, revoked_at
		`;
		log.debug('[revokeRedemption] result', data);
		return data[0];
	}

	/** Flips an exhausted (`accepted`) invitation to `revoked` once none of its redemptions is active. */
	async markRevokedIfAllRevoked(invite_id: InvitationId): Promise<Invitation | undefined> {
		log.debug(`[markRevokedIfAllRevoked] invitation ${invite_id}`);
		const data = await this.sql<Invitation[]>`
			UPDATE invitations SET status = 'revoked', updated_at = now()
			WHERE invite_id = ${invite_id} AND status = 'accepted'
			  AND NOT EXISTS (
				SELECT 1 FROM invitation_redemptions
				WHERE invite_id = ${invite_id} AND status = 'active'
			  )
			RETURNING ${this.columns}
		`;
		log.debug('[markRevokedIfAllRevoked] result', data);
		return data[0];
	}

	async findById(invite_id: InvitationId, created_by: string): Promise<Invitation | undefined> {
		log.debug(`[findById] invitation ${invite_id} for ${created_by}`);
		const data = await this.sql<Invitation[]>`
			SELECT ${this.columns}
			FROM invitations
			WHERE invite_id = ${invite_id} AND created_by = ${created_by}
		`;
		log.debug('[findById] result', data);
		return data[0];
	}

	async findByCode(invite_code: string): Promise<Invitation | undefined> {
		log.debug(`[findByCode] invitation for code ${invite_code}`);
		const data = await this.sql<Invitation[]>`
			SELECT ${this.columns}
			FROM invitations
			WHERE lower(invite_code) = lower(${invite_code})
		`;
		log.debug('[findByCode] result', data);
		return data[0];
	}

	async findByIdAdmin(invite_id: InvitationId): Promise<Invitation | undefined> {
		log.debug(`[findByIdAdmin] invitation ${invite_id}`);
		const data = await this.sql<Invitation[]>`
			SELECT ${this.columns}
			FROM invitations
			WHERE invite_id = ${invite_id}
		`;
		log.debug('[findByIdAdmin] result', data);
		return data[0];
	}

	async delete(invite_id: InvitationId, created_by: string): Promise<Invitation | undefined> {
		log.debug(`[delete] invitation ${invite_id} for ${created_by}`);
		const data = await this.sql<Invitation[]>`
			DELETE FROM invitations
			WHERE invite_id = ${invite_id} AND created_by = ${created_by}
			  AND NOT EXISTS (
				SELECT 1 FROM invitation_redemptions r WHERE r.invite_id = invitations.invite_id
			  )
			RETURNING ${this.columns}
		`;
		log.debug('[delete] result', data);
		return data[0];
	}

	async countRedemptionsByCreatorSince(created_by: string, since: Date | null): Promise<number> {
		log.debug(
			`[countRedemptionsByCreatorSince] counting redemptions for ${created_by} since ${since}`
		);
		const data = since
			? await this.sql<{ count: number }[]>`
				SELECT COUNT(*)::int AS count
				FROM invitation_redemptions r
				JOIN invitations i ON i.invite_id = r.invite_id
				WHERE i.created_by = ${created_by}
				  AND r.created_at >= ${since}
			`
			: await this.sql<{ count: number }[]>`
				SELECT COUNT(*)::int AS count
				FROM invitation_redemptions r
				JOIN invitations i ON i.invite_id = r.invite_id
				WHERE i.created_by = ${created_by}
			`;
		log.debug('[countRedemptionsByCreatorSince] result', data);
		return data[0].count;
	}

	async expireOverdue(): Promise<Invitation[]> {
		const data = await this.sql<Invitation[]>`
			UPDATE invitations
			SET status = 'expired', updated_at = now()
			WHERE status IN ('pending', 'active') AND expires_at IS NOT NULL AND expires_at < now()
			RETURNING ${this.columns}
		`;
		if (data.length > 0) {
			log.debug('[expireOverdue] expired ', data.length);
		}
		return data;
	}
}
