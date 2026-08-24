import KcAdminClient from '@keycloak/keycloak-admin-client';
import { env } from '$env/dynamic/private';

//TODO replace with a proper logger system
const log = console;

export class KeycloakUsernameTakenError extends Error {
	constructor(username: string) {
		super(`Username "${username}" is already taken`);
	}
}

function parseIssuerUrl(oidcUrl: string): { baseUrl: string; realmName: string } {
	const url = new URL(oidcUrl);
	const match = url.pathname.match(/^\/realms\/([^/]+)\/?$/);
	if (!match) {
		throw new Error(`OIDC_URL is not in the expected .../realms/{realm} shape: ${oidcUrl}`);
	}
	return { baseUrl: url.origin, realmName: match[1] };
}

async function getAuthenticatedAdminClient(): Promise<{
	client: KcAdminClient;
	realmName: string;
}> {
	const { baseUrl, realmName } = parseIssuerUrl(env.OIDC_URL!);
	const client = new KcAdminClient({ baseUrl, realmName });
	await client.auth({
		grantType: 'client_credentials',
		clientId: env.KEYCLOAK_ADMIN_CLIENT_ID!,
		clientSecret: env.KEYCLOAK_ADMIN_CLIENT_SECRET!
	});
	return { client, realmName };
}

function isConflict(error: unknown): boolean {
	return (
		!!error &&
		typeof error === 'object' &&
		'response' in error &&
		(error as { response?: Response }).response?.status === 409
	);
}

export async function createKeycloakUser(username: string, password: string): Promise<string> {
	const { client, realmName } = await getAuthenticatedAdminClient();
	try {
		const { id } = await client.users.create({
			realm: realmName,
			username,
			enabled: true,
			credentials: [{ type: 'password', value: password, temporary: false }]
		});
		return id;
	} catch (error) {
		if (isConflict(error)) throw new KeycloakUsernameTakenError(username);
		throw error;
	}
}

export async function deleteKeycloakUser(id: string): Promise<void> {
	const { client, realmName } = await getAuthenticatedAdminClient();
	try {
		await client.users.del({ id, realm: realmName });
	} catch (error) {
		log.error(`Failed to delete Keycloak user ${id}:`, error);
		throw error;
	}
}
