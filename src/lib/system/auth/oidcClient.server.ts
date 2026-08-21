import * as client from 'openid-client';
import { env } from '$env/dynamic/private';

let configPromise: Promise<client.Configuration> | null = null;

export function getOidcConfig(): Promise<client.Configuration> {
	if (!configPromise) {
		configPromise = client.discovery(new URL(env.OIDC_URL!), env.OIDC_CLIENTID!, env.OIDC_SECRET);
	}
	return configPromise;
}

export const oidcScopes = () => env.OIDC_SCOPES || 'openid';
