import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { RegistrationService } from '$lib/system/registration/registrationService.server';
import {
	createKeycloakSessionCookieValue,
	KEYCLOAK_SESSION_COOKIE_NAME,
	KEYCLOAK_SESSION_MAX_AGE
} from '$lib/system/auth/keycloakSession.server';

export async function POST({ request, cookies }: RequestEvent) {
	const { username, password, confirmation, invite_code } = await request.json();

	const result = await new RegistrationService().register(
		username,
		password,
		confirmation,
		invite_code
	);

	if (result.ok) {
		const { data, code } = result;
		cookies.set(
			KEYCLOAK_SESSION_COOKIE_NAME,
			await createKeycloakSessionCookieValue(
				{ sub: data.sub, id_token: data.id_token },
				KEYCLOAK_SESSION_MAX_AGE
			),
			{ path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: KEYCLOAK_SESSION_MAX_AGE }
		);
		return new Response(null, { status: code });
	} else {
		const { error, code } = result;
		return json({ error }, { status: code });
	}
}
