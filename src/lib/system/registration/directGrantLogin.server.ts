import * as client from 'openid-client';
import { getOidcConfig, oidcScopes } from '$lib/system/auth/oidcClient.server';

export interface PasswordLoginResult {
	sub: string;
	id_token: string;
}

export async function passwordLogin(
	username: string,
	password: string
): Promise<PasswordLoginResult> {
	const config = await getOidcConfig();
	const tokens = await client.genericGrantRequest(config, 'password', {
		username,
		password,
		scope: oidcScopes()
	});

	const claims = tokens.claims();
	if (!claims?.sub || !tokens.id_token) {
		throw new Error('Keycloak did not return a usable session after password login');
	}
	return { sub: claims.sub, id_token: tokens.id_token };
}
