import type { Invitation } from './invitationsService';
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
			const invitation = await this.invitationRepo.create(created_by, invite_code, resolvedExpiresAt);

			return { ok: true, data: invitation, code: 201 };
		} catch (error) {
			log.error('Error creating invitation:', error);
			return { ok: false, error: 'Failed to create invitation', code: 500 };
		}
	}
}

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}
