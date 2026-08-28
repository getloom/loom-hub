export interface User {
	sub: string;
	username: string;
	email: string | null;
	email_verified: boolean;
	created_at: Date;
	updated_at: Date | null;
}
