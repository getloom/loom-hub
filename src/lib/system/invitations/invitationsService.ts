export type InvitationId = number;

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface Invitation {
	invite_id: InvitationId;
	invite_code: string;
	created_by: string;
	used_by: string | null;
	status: InvitationStatus;
	expires_at: Date | null;
	created_at: Date;
	updated_at: Date | null;
}

export interface InvitationWithUsernames extends Invitation {
	created_by_username: string | null;
	used_by_username: string | null;
}

export const DELETABLE_STATUSES: InvitationStatus[] = ['pending', 'expired'];
export const REVOCABLE_STATUSES: InvitationStatus[] = ['accepted'];

export const INVITE_COUNT_CYCLES = ['year', 'month', 'lifetime'] as const;
export type InviteCountCycle = (typeof INVITE_COUNT_CYCLES)[number];

export function isInviteCountCycle(value: string): value is InviteCountCycle {
	return (INVITE_COUNT_CYCLES as readonly string[]).includes(value);
}
