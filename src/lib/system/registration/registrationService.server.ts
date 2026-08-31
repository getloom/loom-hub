import { InvitationRepo } from '$lib/system/invitations/invitationsRepo';
import postgres from 'postgres';
import { defaultPostgresOptions } from '$lib/db/postgres.server';
import {
	createKeycloakUser,
	deleteKeycloakUser,
	KeycloakUsernameTakenError
} from '$lib/system/admin/keycloakAdmin.server';
import {
	passwordLogin,
	type PasswordLoginResult
} from '$lib/system/registration/directGrantLogin.server';
import { upsertLocalUser } from '$lib/system/users/usersService.server';

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

export interface KeycloakAdminOps {
	createUser(username: string, password: string): Promise<string>;
	deleteUser(id: string): Promise<void>;
}

export interface KeycloakLoginOps {
	passwordLogin(username: string, password: string): Promise<PasswordLoginResult>;
}

export interface UsersOps {
	upsertUser(
		sub: string,
		iss: string,
		username: string,
		email: string | null,
		emailVerified: boolean
	): Promise<void>;
}

const USERNAME_PATTERN = /^[a-zA-Z0-9]+$/;

//TODO replace with a proper logger system
const log = console;

export class RegistrationService {
	invitationRepo: InvitationRepo;
	keycloakAdmin: KeycloakAdminOps;
	keycloakLogin: KeycloakLoginOps;
	usersOps: UsersOps;

	constructor(
		invitationRepo?: InvitationRepo,
		keycloakAdmin?: KeycloakAdminOps,
		keycloakLogin?: KeycloakLoginOps,
		usersOps?: UsersOps
	) {
		this.invitationRepo = invitationRepo || new InvitationRepo(postgres(defaultPostgresOptions));
		this.keycloakAdmin = keycloakAdmin || {
			createUser: createKeycloakUser,
			deleteUser: deleteKeycloakUser
		};
		this.keycloakLogin = keycloakLogin || { passwordLogin };
		this.usersOps = usersOps || { upsertUser: upsertLocalUser };
	}

	async register(
		username: string,
		password: string,
		confirmation: string,
		invite_code: string
	): Promise<Result<PasswordLoginResult> | Error> {
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
		} catch (error) {
			log.error('Error validating invitation:', error);
			return { ok: false, error: 'Failed to validate invitation', code: 500 };
		}

		let sub: string;
		try {
			sub = await this.keycloakAdmin.createUser(username, password);
		} catch (error) {
			if (error instanceof KeycloakUsernameTakenError) {
				return { ok: false, error: 'Username is already taken', code: 409 };
			}
			log.error('Error creating Keycloak user:', error);
			return { ok: false, error: 'Failed to create user', code: 500 };
		}

		try {
			const session = await this.keycloakLogin.passwordLogin(username, password);

			const accepted = await this.invitationRepo.markAccepted(invite_code, sub);
			if (!accepted) {
				await this.rollbackUser(sub, 'invitation no longer pending');
				return { ok: false, error: 'Invitation is not pending', code: 409 };
			}

			try {
				await this.usersOps.upsertUser(sub, session.iss, username, null, false);
			} catch (error) {
				log.error(`Failed to persist local user record for ${sub}:`, error);
			}

			return { ok: true, data: session, code: 201 };
		} catch (error) {
			await this.rollbackUser(sub, 'post-creation step failed');
			log.error('Error finalizing registration:', error);
			return { ok: false, error: 'Failed to finalize registration', code: 500 };
		}
	}

	private async rollbackUser(sub: string, reason: string): Promise<void> {
		try {
			await this.keycloakAdmin.deleteUser(sub);
		} catch (error) {
			log.error(`Failed to roll back Keycloak user ${sub} after ${reason}:`, error);
		}
	}
}
