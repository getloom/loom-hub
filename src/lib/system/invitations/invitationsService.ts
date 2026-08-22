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
