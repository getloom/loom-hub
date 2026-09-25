// Configures the keycloak-dev realm for loom-hub's registration flow:
// - enables direct access grants on the app client (password login after registration)
// - creates/updates the admin service-account client with realm-management/manage-users
// - makes firstName/lastName optional in the user profile (registration doesn't collect them)
// - adds realm/client roles to the ID token (the app reads roles from the ID token at login)
// Idempotent: safe to re-run at any time, and repairs drift. Local dev only.
import KcAdminClient from '@keycloak/keycloak-admin-client';
import 'dotenv/config';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const RETRY_INTERVAL_MS = 2_000;
const RETRY_TIMEOUT_MS = 90_000;

function fail(message: string): never {
	console.error(`keycloak:bootstrap failed: ${message}`);
	process.exit(1);
}

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) fail(`${name} is not set (copy .env.example to .env)`);
	return value;
}

// Copied from src/lib/system/admin/keycloakAdmin.server.ts, which can't be imported
// outside SvelteKit because it depends on $env.
function parseIssuerUrl(oidcUrl: string): { url: URL; baseUrl: string; realmName: string } {
	const url = new URL(oidcUrl);
	const match = url.pathname.match(/^\/realms\/([^/]+)\/?$/);
	if (!match) {
		fail(`OIDC_URL is not in the expected .../realms/{realm} shape: ${oidcUrl}`);
	}
	return { url, baseUrl: url.origin, realmName: match[1] };
}

const oidcUrl = requireEnv('OIDC_URL');
const appClientId = requireEnv('OIDC_CLIENTID');
const adminClientId = requireEnv('KEYCLOAK_ADMIN_CLIENT_ID');
const adminClientSecret = requireEnv('KEYCLOAK_ADMIN_CLIENT_SECRET');
const bootstrapUsername = process.env.KEYCLOAK_BOOTSTRAP_ADMIN_USERNAME || 'admin';
const bootstrapPassword = process.env.KEYCLOAK_BOOTSTRAP_ADMIN_PASSWORD || 'admin';

const { url, baseUrl, realmName } = parseIssuerUrl(oidcUrl);

// This script uses default admin credentials and sets a known client secret,
// so it must never run against a real deployment.
if (!LOOPBACK_HOSTS.has(url.hostname)) {
	fail(`refusing to run against non-local Keycloak ${url.origin} (local dev only)`);
}

async function fetchMasterAdminToken(): Promise<string> {
	const deadline = Date.now() + RETRY_TIMEOUT_MS;
	for (;;) {
		let retryReason: string;
		try {
			const response = await fetch(`${baseUrl}/realms/master/protocol/openid-connect/token`, {
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					grant_type: 'password',
					client_id: 'admin-cli',
					username: bootstrapUsername,
					password: bootstrapPassword
				})
			});
			if (response.ok) {
				const { access_token } = await response.json();
				return access_token;
			}
			if (response.status < 500) {
				fail(
					`master realm admin login returned ${response.status} ${response.statusText} ` +
						'(check KEYCLOAK_BOOTSTRAP_ADMIN_USERNAME/PASSWORD)'
				);
			}
			retryReason = `${response.status} ${response.statusText}`;
		} catch (error) {
			retryReason = error instanceof Error ? error.message : String(error);
		}
		if (Date.now() >= deadline) {
			fail(
				`Keycloak at ${baseUrl} not reachable after ${RETRY_TIMEOUT_MS / 1000}s (${retryReason})`
			);
		}
		console.log(`waiting for Keycloak at ${baseUrl}… (${retryReason})`);
		await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
	}
}

const kc = new KcAdminClient({ baseUrl, realmName: 'master' });
kc.setAccessToken(await fetchMasterAdminToken());
kc.setConfig({ realmName });
console.log(`connected to Keycloak at ${baseUrl}, realm "${realmName}"`);

// App client: needs direct access grants for passwordLogin() after registration.
const [appClient] = await kc.clients.find({ clientId: appClientId });
if (!appClient?.id) {
	fail(
		`client "${appClientId}" not found in realm "${realmName}" (check CLIENT_ID in compose.yaml)`
	);
}
if (appClient.directAccessGrantsEnabled) {
	console.log(`- ${appClientId}: direct access grants already enabled`);
} else {
	await kc.clients.update({ id: appClient.id }, { ...appClient, directAccessGrantsEnabled: true });
	console.log(`- ${appClientId}: enabled direct access grants`);
}

// Admin client: confidential, service-account only.
const adminClientSettings = {
	secret: adminClientSecret,
	serviceAccountsEnabled: true,
	standardFlowEnabled: false,
	directAccessGrantsEnabled: false,
	implicitFlowEnabled: false
};
let [adminClient] = await kc.clients.find({ clientId: adminClientId });
if (!adminClient?.id) {
	await kc.clients.create({
		clientId: adminClientId,
		enabled: true,
		protocol: 'openid-connect',
		publicClient: false,
		clientAuthenticatorType: 'client-secret',
		...adminClientSettings
	});
	[adminClient] = await kc.clients.find({ clientId: adminClientId });
	if (!adminClient?.id) fail(`client "${adminClientId}" was not found after creating it`);
	console.log(`- ${adminClientId}: created`);
} else {
	const drifted = (Object.keys(adminClientSettings) as (keyof typeof adminClientSettings)[]).some(
		(key) => adminClient[key] !== adminClientSettings[key]
	);
	if (drifted || !adminClient.enabled) {
		await kc.clients.update(
			{ id: adminClient.id },
			{ ...adminClient, enabled: true, ...adminClientSettings }
		);
		console.log(`- ${adminClientId}: updated settings/secret`);
	} else {
		console.log(`- ${adminClientId}: already configured`);
	}
}

// Service account role: realm-management/manage-users covers users.create/del/update.
const serviceAccountUser = await kc.clients.getServiceAccountUser({ id: adminClient.id });
const [realmManagement] = await kc.clients.find({ clientId: 'realm-management' });
if (!serviceAccountUser.id || !realmManagement?.id) {
	fail('could not resolve the service account user or the realm-management client');
}
const manageUsers = await kc.clients.findRole({ id: realmManagement.id, roleName: 'manage-users' });
if (!manageUsers?.id || !manageUsers.name) fail('realm-management has no manage-users role');
const mappings = await kc.users.listClientRoleMappings({
	id: serviceAccountUser.id,
	clientUniqueId: realmManagement.id
});
if (mappings.some((role) => role.name === 'manage-users')) {
	console.log(`- ${adminClientId}: service account already has manage-users`);
} else {
	await kc.users.addClientRoleMappings({
		id: serviceAccountUser.id,
		clientUniqueId: realmManagement.id,
		roles: [{ id: manageUsers.id, name: manageUsers.name }]
	});
	console.log(`- ${adminClientId}: granted realm-management/manage-users`);
}

// User profile: Keycloak requires firstName/lastName by default, and users without them
// get VERIFY_PROFILE on login ("Account is not fully set up"), which blocks passwordLogin().
const OPTIONAL_PROFILE_ATTRIBUTES = new Set(['firstName', 'lastName']);
const profile = await kc.users.getProfile();
const requiredNames = (profile.attributes ?? []).filter(
	(attribute) =>
		attribute.name && OPTIONAL_PROFILE_ATTRIBUTES.has(attribute.name) && attribute.required
);
if (requiredNames.length) {
	for (const attribute of requiredNames) delete attribute.required;
	await kc.users.updateProfile(profile);
	console.log(
		`- user profile: made ${requiredNames.map((attribute) => attribute.name).join(', ')} optional`
	);
} else {
	console.log('- user profile: firstName/lastName already optional');
}

// Role mappers: the app reads roles from the ID token (see docs/authentication.md), but
// Keycloak's built-in "roles" scope mappers only add them to the access token by default.
const ROLE_MAPPERS = new Set(['realm roles', 'client roles']);
const rolesScope = await kc.clientScopes.findOneByName({ name: 'roles' });
if (!rolesScope?.id) fail('client scope "roles" not found');
const roleMappers = (await kc.clientScopes.listProtocolMappers({ id: rolesScope.id })).filter(
	(mapper) => mapper.name && ROLE_MAPPERS.has(mapper.name)
);
if (roleMappers.length !== ROLE_MAPPERS.size) {
	fail(`client scope "roles" is missing its "realm roles"/"client roles" mappers`);
}
for (const mapper of roleMappers) {
	if (mapper.config?.['id.token.claim'] === 'true') {
		console.log(`- roles scope: "${mapper.name}" already added to ID token`);
		continue;
	}
	await kc.clientScopes.updateProtocolMapper(
		{ id: rolesScope.id, mapperId: mapper.id! },
		{ ...mapper, config: { ...mapper.config, 'id.token.claim': 'true' } }
	);
	console.log(`- roles scope: added "${mapper.name}" to ID token`);
}

// End-to-end check: the same client_credentials call keycloakAdmin.server.ts makes.
const verify = await fetch(`${baseUrl}/realms/${realmName}/protocol/openid-connect/token`, {
	method: 'POST',
	headers: { 'content-type': 'application/x-www-form-urlencoded' },
	body: new URLSearchParams({
		grant_type: 'client_credentials',
		client_id: adminClientId,
		client_secret: adminClientSecret
	})
});
if (!verify.ok) {
	fail(`${adminClientId} client_credentials check returned ${verify.status} ${verify.statusText}`);
}
console.log(
	`verified: ${adminClientId} can obtain an access token. Keycloak is ready for loom-hub.`
);
