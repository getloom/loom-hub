import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { RegistrationService } from '$lib/system/registration/registrationService.server';

export async function POST({ request }: RequestEvent) {
	const { username, password, confirmation, invite_code } = await request.json();

	const result = await new RegistrationService().register(
		username,
		password,
		confirmation,
		invite_code
	);

	if (result.ok) {
		const { code } = result;
		return new Response(null, { status: code });
	} else {
		const { error, code } = result;
		return json(error, { status: code });
	}
}
