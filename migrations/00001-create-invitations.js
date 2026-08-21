export const up = async (sql) => {
	await sql`
		create table if not exists invitations (
			invite_id serial primary key,
			invite_code text UNIQUE NOT NULL,
			created_by text NOT NULL,
			used_by text,
			expires_at timestamp,
			created_at timestamp NOT NULL DEFAULT now(),
			updated_at timestamp
		)
	`;
};
