import type { Invitation, InvitationId } from './invitationsService';
import { InvitationRepo } from '$lib/system/invitations/invitationsRepo';
import postgres from 'postgres';
import { defaultPostgresOptions } from '$lib/db/postgres.server';
import { generateInviteCode } from '$lib/util/crypto.server';

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
export class InvitationService {
	invitationRepo: InvitationRepo;

	constructor(invitationRepo?: InvitationRepo) {
		this.invitationRepo = invitationRepo || new InvitationRepo(postgres(defaultPostgresOptions));
	}

	async create(created_by: string, expires_at?: Date): Promise<Result<Invitation> | Error> {
		if (!created_by) {
			return { ok: false, error: 'created_by is required', code: 400 };
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

	async update(
		created_by: string,
		invite_id: InvitationId,
		expires_at: Date
	): Promise<Result<Invitation> | Error> {
		if (!created_by) {
			return { ok: false, error: 'created_by is required', code: 400 };
		}
		if (!Number.isInteger(invite_id) || invite_id <= 0) {
			return { ok: false, error: 'invite_id must be a positive integer', code: 400 };
		}
		if (!expires_at || isNaN(expires_at.getTime())) {
			return { ok: false, error: 'expires_at must be a valid date', code: 400 };
		}

		try {
			const invitation = await this.invitationRepo.updateExpiration(
				invite_id,
				created_by,
				expires_at
			);

			if (!invitation) {
				return { ok: false, error: 'Invitation not found', code: 404 };
			}

			return { ok: true, data: invitation, code: 200 };
		} catch (error) {
			log.error('Error updating invitation:', error);
			return { ok: false, error: 'Failed to update invitation', code: 500 };
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
}

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}
