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

// Keycloak's client_credentials grant has no user to refresh a session for, so the
// token response has no refresh_token. KcAdminClient#auth() doesn't handle that: it
// unconditionally decodes whatever refresh_token it got, and decodeToken(undefined)
// throws. Fetch the access token ourselves and skip auth()'s refresh-token handling.
async function fetchAdminAccessToken(baseUrl: string, realmName: string): Promise<string> {
	const response = await fetch(`${baseUrl}/realms/${realmName}/protocol/openid-connect/token`, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'client_credentials',
			client_id: env.KEYCLOAK_ADMIN_CLIENT_ID!,
			client_secret: env.KEYCLOAK_ADMIN_CLIENT_SECRET!
		})
	});
	if (!response.ok) {
		throw new Error(
			`Failed to obtain Keycloak admin access token: ${response.status} ${response.statusText}`
		);
	}
	const { access_token } = await response.json();
	return access_token;
}

async function getAuthenticatedAdminClient(): Promise<{
	client: KcAdminClient;
	realmName: string;
}> {
	const { baseUrl, realmName } = parseIssuerUrl(env.OIDC_URL!);
	const client = new KcAdminClient({ baseUrl, realmName });
	client.setAccessToken(await fetchAdminAccessToken(baseUrl, realmName));
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
