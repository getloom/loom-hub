import {
	DELETABLE_STATUSES,
	REVOCABLE_STATUSES,
	type Invitation,
	type InvitationId
} from './invitationsService';
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
const INVITE_COUNT_UNLIMITED = -1;
const INVITE_COUNT_CYCLES = ['year', 'month', 'lifetime'] as const;
type InviteCountCycle = (typeof INVITE_COUNT_CYCLES)[number];

function isInviteCountCycle(value: string): value is InviteCountCycle {
	return (INVITE_COUNT_CYCLES as readonly string[]).includes(value);
}

function resolveCycleCutoff(cycle: InviteCountCycle, now: Date = new Date()): Date | null {
	if (cycle === 'lifetime') {
		return null;
	}
	const cutoff = new Date(now);
	if (cycle === 'year') {
		cutoff.setFullYear(cutoff.getFullYear() - 1);
	} else {
		cutoff.setMonth(cutoff.getMonth() - 1);
	}
	return cutoff;
}

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
		roles: string[] = []
	): Promise<Result<Invitation> | Error> {
		if (!created_by) {
			return { ok: false, error: 'created_by is required', code: 400 };
		}

		if (!roles.some((role) => INVITE_LIMIT_EXEMPT_ROLES.includes(role))) {
			const limitError = await this.checkInviteLimit(created_by);
			if (limitError) {
				return limitError;
			}
		}

		try {
			const resolvedExpiresAt = expires_at ?? addDays(new Date(), DEFAULT_EXPIRATION_DAYS);
			const invite_code = generateInviteCode();
			const invitation = await this.invitationRepo.create(
				created_by,
				invite_code,
				resolvedExpiresAt
			);

			return { ok: true, data: invitation, code: 201 };
		} catch (error) {
			log.error('Error creating invitation:', error);
			return { ok: false, error: 'Failed to create invitation', code: 500 };
		}
	}

	private async checkInviteLimit(created_by: string): Promise<Error | undefined> {
		const [limitResult, cycleResult] = await Promise.all([
			this.settingsService.getSetting('invite_count_limit'),
			this.settingsService.getSetting('invite_count_cycle')
		]);

		if (!limitResult.ok) {
			log.error('[checkInviteLimit] failed to load invite_count_limit:', limitResult.error);
			return { ok: false, error: 'Invite limit is misconfigured', code: 500 };
		}

		const limit = Number(limitResult.data.value);
		if (!Number.isInteger(limit) || (limit < 0 && limit !== INVITE_COUNT_UNLIMITED)) {
			log.error(`[checkInviteLimit] invalid invite_count_limit value: "${limitResult.data.value}"`);
			return { ok: false, error: 'Invite limit is misconfigured', code: 500 };
		}

		if (limit === INVITE_COUNT_UNLIMITED) {
			return undefined;
		}

		if (!cycleResult.ok) {
			log.error('[checkInviteLimit] failed to load invite_count_cycle:', cycleResult.error);
			return { ok: false, error: 'Invite limit is misconfigured', code: 500 };
		}

		const cycleValue = cycleResult.data.value;
		if (!isInviteCountCycle(cycleValue)) {
			log.error(`[checkInviteLimit] invalid invite_count_cycle value: "${cycleValue}"`);
			return { ok: false, error: 'Invite limit is misconfigured', code: 500 };
		}

		const since = resolveCycleCutoff(cycleValue);
		const count = await this.invitationRepo.countActiveByCreatorSince(created_by, since);

		if (count >= limit) {
			return { ok: false, error: 'Invite creation limit reached for the current cycle', code: 429 };
		}

		return undefined;
	}

	async listInvitations(created_by: string): Promise<Result<Invitation[]> | Error> {
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

	async listAllInvitations(): Promise<Result<Invitation[]> | Error> {
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
			if (!DELETABLE_STATUSES.includes(existing.status)) {
				return {
					ok: false,
					error: 'Invitation cannot be deleted in its current status',
					code: 409
				};
			}

			const invitation = await this.invitationRepo.delete(invite_id, created_by);

			if (!invitation) {
				return { ok: false, error: 'Invitation not found', code: 404 };
			}

			return { ok: true, data: invitation, code: 200 };
		} catch (error) {
			log.error('Error deleting invitation:', error);
			return { ok: false, error: 'Failed to delete invitation', code: 500 };
		}
	}

	async revoke(invite_id: InvitationId): Promise<Result<Invitation> | Error> {
		if (!Number.isInteger(invite_id) || invite_id <= 0) {
			return { ok: false, error: 'invite_id must be a positive integer', code: 400 };
		}

		try {
			const existing = await this.invitationRepo.findByIdAdmin(invite_id);

			if (!existing) {
				return { ok: false, error: 'Invitation not found', code: 404 };
			}
			if (!REVOCABLE_STATUSES.includes(existing.status)) {
				return {
					ok: false,
					error: 'Invitation cannot be revoked in its current status',
					code: 422
				};
			}

			try {
				await this.keycloakAdmin.deactivateUser(existing.used_by!);
			} catch (error) {
				log.error(`Failed to deactivate Keycloak user for invitation ${invite_id}:`, error);
				return { ok: false, error: 'Failed to deactivate user', code: 500 };
			}

			const invitation = await this.invitationRepo.revoke(invite_id);

			if (!invitation) {
				return { ok: false, error: 'Invitation not found', code: 404 };
			}

			return { ok: true, data: invitation, code: 200 };
		} catch (error) {
			log.error('Error revoking invitation:', error);
			return { ok: false, error: 'Failed to revoke invitation', code: 500 };
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
