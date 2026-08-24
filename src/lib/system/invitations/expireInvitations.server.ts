import { InvitationService } from '$lib/system/invitations/invitationsService.server';

const INTERVAL_MS = 60_000;
const GLOBAL_KEY = '__invitationExpirySchedulerHandle';

//TODO replace with a proper logger system
const log = console;

type GlobalWithHandle = typeof globalThis & { [GLOBAL_KEY]?: NodeJS.Timeout };

export function startInvitationExpiryScheduler(
	service: InvitationService = new InvitationService(),
	intervalMs: number = INTERVAL_MS
): NodeJS.Timeout {
	const globalWithHandle = globalThis as GlobalWithHandle;
	log.debug("[startInvitationExpiryScheduler] starting up expiration service");
	if (globalWithHandle[GLOBAL_KEY]) {
		clearInterval(globalWithHandle[GLOBAL_KEY]);
	}

	const tick = async () => {
		const result = await service.expireOverdue();
		if (!result.ok) {
			log.error('[invitation-expiry] tick failed:', result.error);
		} else if (result.data.length > 0) {
			log.debug(`[invitation-expiry] expired ${result.data.length} invitation(s)`);
		}
	};

	tick();
	const handle = setInterval(tick, intervalMs);
	globalWithHandle[GLOBAL_KEY] = handle;
	return handle;
}
