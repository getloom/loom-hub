import {
	INVITE_CODE_PATTERN,
	MAX_USES_UPPER_BOUND,
	isDeletable,
	type Invitation,
	type InvitationId,
	type InvitationWithUsernames
} from './invitationsService';
import { resolveInviteLimit } from './inviteLimit.server';
import { InvitationRepo } from '$lib/system/invitations/invitationsRepo';
import postgres from 'postgres';
import { defaultPostgresOptions } from '$lib/db/postgres.server';
import { generateInviteCode } from '$lib/util/crypto.server';
import { deactivateKeycloakUser } from '$lib/system/admin/keycloakAdmin.server';
import { SettingsService } from '$lib/system/settings/settingsService.server';

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

const DEFAULT_EXPIRATION_DAYS = 90;

//TODO replace with a proper logger system
const log = console;

//TODO create a Service class to extend
//TODO implement zod for schema validation at the API layer
export interface KeycloakAdminOps {
	deactivateUser(id: string): Promise<void>;
}

const INVITE_LIMIT_EXEMPT_ROLES = ['founder'];

export class InvitationService {
	invitationRepo: InvitationRepo;
	keycloakAdmin: KeycloakAdminOps;
	settingsService: SettingsService;

	constructor(
		invitationRepo?: InvitationRepo,
		keycloakAdmin?: KeycloakAdminOps,
		settingsService?: SettingsService
	) {
		this.invitationRepo = invitationRepo || new InvitationRepo(postgres(defaultPostgresOptions));
		this.keycloakAdmin = keycloakAdmin || { deactivateUser: deactivateKeycloakUser };
		this.settingsService = settingsService || new SettingsService();
	}

	async create(
		created_by: string,
		expires_at?: Date,
		roles: string[] = [],
		invite_code?: string,
		max_uses?: number | null
	): Promise<Result<Invitation> | Error> {
		if (!created_by) {
			return { ok: false, error: 'created_by is required', code: 400 };
		}

		const custom = invite_code?.trim();
		if (custom && !INVITE_CODE_PATTERN.test(custom)) {
			return {
				ok: false,
				error: 'Invite code must be 4-64 characters: letters, numbers, - or _',
				code: 400
			};
		}

		const resolvedMaxUses = max_uses === undefined ? 1 : max_uses;
		if (
			resolvedMaxUses !== null &&
			(!Number.isInteger(resolvedMaxUses) ||
				resolvedMaxUses < 1 ||
				resolvedMaxUses > MAX_USES_UPPER_BOUND)
		) {
			return {
				ok: false,
				error: 'max_uses must be a positive integer or unlimited',
				code: 400
			};
		}

		const limit_exempt = roles.some((role) => INVITE_LIMIT_EXEMPT_ROLES.includes(role));
		if (!limit_exempt) {
			const limitError = await this.checkInviteLimit(created_by);
			if (limitError) {
				return limitError;
			}
		}

		try {
			const resolvedExpiresAt = expires_at ?? addDays(new Date(), DEFAULT_EXPIRATION_DAYS);
			const invitation = await this.invitationRepo.create(
				created_by,
				custom || generateInviteCode(),
				resolvedExpiresAt,
				resolvedMaxUses,
				limit_exempt
			);

			return { ok: true, data: invitation, code: 201 };
		} catch (error) {
			if (custom && (error as { code?: string }).code === '23505') {
				return { ok: false, error: 'Invite code is already taken', code: 409 };
			}
			log.error('Error creating invitation:', error);
			return { ok: false, error: 'Failed to create invitation', code: 500 };
		}
	}

	private async checkInviteLimit(created_by: string): Promise<Error | undefined> {
		const resolved = await resolveInviteLimit(this.settingsService);
		if (!resolved.ok) {
			return resolved;
		}
		if (!resolved.limit) {
			return undefined;
		}

		const count = await this.invitationRepo.countRedemptionsByCreatorSince(
			created_by,
			resolved.limit.since
		);

		if (count >= resolved.limit.max) {
			return { ok: false, error: 'Invite creation limit reached for the current cycle', code: 429 };
		}

		return undefined;
	}

	async listInvitations(created_by: string): Promise<Result<InvitationWithUsernames[]> | Error> {
		if (!created_by) {
			return { ok: false, error: 'created_by is required', code: 400 };
		}

		try {
			const invitations = await this.invitationRepo.findAllByCreator(created_by);
			return { ok: true, data: invitations, code: 200 };
		} catch (error) {
			log.error('Error listing invitations:', error);
			return { ok: false, error: 'Failed to list invitations', code: 500 };
		}
	}

	async listAllInvitations(): Promise<Result<InvitationWithUsernames[]> | Error> {
		try {
			const invitations = await this.invitationRepo.findAll();
			return { ok: true, data: invitations, code: 200 };
		} catch (error) {
			log.error('Error listing all invitations:', error);
			return { ok: false, error: 'Failed to list all invitations', code: 500 };
		}
	}

	async delete(created_by: string, invite_id: InvitationId): Promise<Result<Invitation> | Error> {
		if (!created_by) {
			return { ok: false, error: 'created_by is required', code: 400 };
		}
		if (!Number.isInteger(invite_id) || invite_id <= 0) {
			return { ok: false, error: 'invite_id must be a positive integer', code: 400 };
		}

		try {
			const existing = await this.invitationRepo.findById(invite_id, created_by);

			if (!existing) {
				return { ok: false, error: 'Invitation not found', code: 404 };
			}
			if (!isDeletable(existing)) {
				return {
					ok: false,
					error: 'Invitation cannot be deleted in its current status',
					code: 409
				};
			}

			const invitation = await this.invitationRepo.delete(invite_id, created_by);

			if (!invitation) {
				// found above, so a concurrent redemption (or removal) won the race
				return {
					ok: false,
					error: 'Invitation cannot be deleted in its current status',
					code: 409
				};
			}

			return { ok: true, data: invitation, code: 200 };
		} catch (error) {
			log.error('Error deleting invitation:', error);
			return { ok: false, error: 'Failed to delete invitation', code: 500 };
		}
	}

	async revokeRedemption(
		invite_id: InvitationId,
		redemption_id: number
	): Promise<Result<Invitation> | Error> {
		if (!Number.isInteger(invite_id) || invite_id <= 0) {
			return { ok: false, error: 'invite_id must be a positive integer', code: 400 };
		}
		if (!Number.isInteger(redemption_id) || redemption_id <= 0) {
			return { ok: false, error: 'redemption_id must be a positive integer', code: 400 };
		}

		try {
			const redemption = await this.invitationRepo.findRedemption(invite_id, redemption_id);

			if (!redemption || redemption.invite_id !== invite_id) {
				return { ok: false, error: 'Redemption not found', code: 404 };
			}
			if (redemption.status !== 'active') {
				return {
					ok: false,
					error: 'Redemption cannot be revoked in its current status',
					code: 422
				};
			}

			try {
				await this.keycloakAdmin.deactivateUser(redemption.user_sub);
			} catch (error) {
				log.error(`Failed to deactivate Keycloak user for redemption ${redemption_id}:`, error);
				return { ok: false, error: 'Failed to deactivate user', code: 500 };
			}

			const revoked = await this.invitationRepo.revokeRedemption(redemption_id);
			if (!revoked) {
				return {
					ok: false,
					error: 'Redemption cannot be revoked in its current status',
					code: 422
				};
			}

			await this.invitationRepo.markRevokedIfAllRevoked(invite_id);

			const invitation = await this.invitationRepo.findByIdAdmin(invite_id);
			if (!invitation) {
				return { ok: false, error: 'Invitation not found', code: 404 };
			}

			return { ok: true, data: invitation, code: 200 };
		} catch (error) {
			log.error('Error revoking redemption:', error);
			return { ok: false, error: 'Failed to revoke redemption', code: 500 };
		}
	}

	async expireOverdue(): Promise<Result<Invitation[]> | Error> {
		try {
			const expired = await this.invitationRepo.expireOverdue();
			return { ok: true, data: expired, code: 200 };
		} catch (error) {
			log.error('Error expiring overdue invitations:', error);
			return { ok: false, error: 'Failed to expire overdue invitations', code: 500 };
		}
	}
}

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}
