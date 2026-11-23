import { isInviteCountCycle, type InviteCountCycle } from './invitationsService';
import type { SettingsService } from '$lib/system/settings/settingsService.server';

export const INVITE_COUNT_UNLIMITED = -1;

//TODO replace with a proper logger system
const log = console;

export interface InviteLimit {
	max: number;
	since: Date | null;
}

export type ResolveInviteLimitResult =
	| { ok: true; limit: InviteLimit | null } // null = unlimited
	| { ok: false; error: string; code: number };

export function resolveCycleCutoff(cycle: InviteCountCycle, now: Date = new Date()): Date | null {
	if (cycle === 'lifetime') {
		return null;
	}
	const cutoff = new Date(now);
	if (cycle === 'year') {
		cutoff.setFullYear(cutoff.getFullYear() - 1);
	} else {
		cutoff.setMonth(cutoff.getMonth() - 1);
	}
	return cutoff;
}

const misconfigured = (): ResolveInviteLimitResult => ({
	ok: false,
	error: 'Invite limit is misconfigured',
	code: 500
});

/**
 * Loads and validates the invite_count_limit / invite_count_cycle settings.
 * A null limit means unlimited (-1). Misconfiguration fails closed with a 500.
 */
export async function resolveInviteLimit(
	settingsService: SettingsService
): Promise<ResolveInviteLimitResult> {
	const [limitResult, cycleResult] = await Promise.all([
		settingsService.getSetting('invite_count_limit'),
		settingsService.getSetting('invite_count_cycle')
	]);

	if (!limitResult.ok) {
		log.error('[resolveInviteLimit] failed to load invite_count_limit:', limitResult.error);
		return misconfigured();
	}

	const max = Number(limitResult.data.value);
	if (!Number.isInteger(max) || (max < 0 && max !== INVITE_COUNT_UNLIMITED)) {
		log.error(`[resolveInviteLimit] invalid invite_count_limit value: "${limitResult.data.value}"`);
		return misconfigured();
	}

	if (max === INVITE_COUNT_UNLIMITED) {
		return { ok: true, limit: null };
	}

	if (!cycleResult.ok) {
		log.error('[resolveInviteLimit] failed to load invite_count_cycle:', cycleResult.error);
		return misconfigured();
	}

	const cycleValue = cycleResult.data.value;
	if (!isInviteCountCycle(cycleValue)) {
		log.error(`[resolveInviteLimit] invalid invite_count_cycle value: "${cycleValue}"`);
		return misconfigured();
	}

	return { ok: true, limit: { max, since: resolveCycleCutoff(cycleValue) } };
}
