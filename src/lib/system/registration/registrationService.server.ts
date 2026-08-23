import { InvitationRepo } from '$lib/system/invitations/invitationsRepo';
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

const USERNAME_PATTERN = /^[a-zA-Z0-9]+$/;

//TODO replace with a proper logger system
const log = console;

export class RegistrationService {
	invitationRepo: InvitationRepo;

	constructor(invitationRepo?: InvitationRepo) {
		this.invitationRepo = invitationRepo || new InvitationRepo(postgres(defaultPostgresOptions));
	}

	async register(
		username: string,
		password: string,
		confirmation: string,
		invite_code: string
	): Promise<Result<null> | Error> {
		if (!username || !USERNAME_PATTERN.test(username)) {
			return { ok: false, error: 'username must contain only letters and numbers', code: 400 };
		}
		if (!password || !confirmation) {
			return { ok: false, error: 'password and confirmation are required', code: 400 };
		}
		if (password !== confirmation) {
			return { ok: false, error: 'password and confirmation must match', code: 400 };
		}
		if (!invite_code) {
			return { ok: false, error: 'invite_code is required', code: 400 };
		}

		try {
			const invitation = await this.invitationRepo.findByCode(invite_code);

			if (!invitation) {
				return { ok: false, error: 'Invitation not found', code: 404 };
			}
			if (invitation.status !== 'pending') {
				return { ok: false, error: 'Invitation is not pending', code: 409 };
			}

			return { ok: true, data: null, code: 202 };
		} catch (error) {
			log.error('Error validating invitation:', error);
			return { ok: false, error: 'Failed to validate invitation', code: 500 };
		}
	}
}
