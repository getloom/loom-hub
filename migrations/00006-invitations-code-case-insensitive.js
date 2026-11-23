export const up = async (sql) => {
	await sql`
		create unique index if not exists invitations_invite_code_lower_idx
		on invitations (lower(invite_code))
	`;
};
