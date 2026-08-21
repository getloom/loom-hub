export type InvitationId = number;

export interface Invitation {
	invite_id: InvitationId;
	invite_code: string;
	created_by: string;
	used_by: string | null;
	expires_at: Date | null;
	created_at: Date;
	updated_at: Date | null;
}
