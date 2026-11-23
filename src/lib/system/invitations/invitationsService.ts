export type InvitationId = number;

export type InvitationStatus = 'pending' | 'active' | 'accepted' | 'revoked' | 'expired';
export type RedemptionStatus = 'active' | 'revoked';

export interface Invitation {
	invite_id: InvitationId;
	invite_code: string;
	created_by: string;
	status: InvitationStatus;
	max_uses: number | null; // null = unlimited
	use_count: number;
	limit_exempt: boolean;
	expires_at: Date | null;
	created_at: Date;
	updated_at: Date | null;
}

export interface Redemption {
	redemption_id: number;
	invite_id: InvitationId;
	user_sub: string;
	username: string | null;
	status: RedemptionStatus;
	created_at: Date | string;
	revoked_at: Date | string | null;
}

export interface InvitationWithUsernames extends Invitation {
	created_by_username: string | null;
	redemptions: Redemption[];
}

export const DELETABLE_STATUSES: InvitationStatus[] = ['pending', 'expired']; // necessary but not sufficient: also requires zero redemptions

export function isDeletable(inv: Pick<Invitation, 'status' | 'use_count'>): boolean {
	return DELETABLE_STATUSES.includes(inv.status) && inv.use_count === 0;
}
export const REDEEMABLE_STATUSES: InvitationStatus[] = ['pending', 'active'];
export const MAX_USES_UPPER_BOUND = 2147483647;

export const INVITE_CODE_MIN_LENGTH = 4;
export const INVITE_CODE_MAX_LENGTH = 64;
export const INVITE_CODE_PATTERN = /^[a-zA-Z0-9_-]{4,64}$/;

export const INVITE_COUNT_CYCLES = ['year', 'month', 'lifetime'] as const;
export type InviteCountCycle = (typeof INVITE_COUNT_CYCLES)[number];

export function isInviteCountCycle(value: string): value is InviteCountCycle {
	return (INVITE_COUNT_CYCLES as readonly string[]).includes(value);
}
