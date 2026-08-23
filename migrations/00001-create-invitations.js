export const up = async (sql) => {
	await sql`
		create table if not exists invitations (
			invite_id serial primary key,
			invite_code text UNIQUE NOT NULL,
			created_by text NOT NULL,
			used_by text,
			status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
			expires_at timestamptz,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz
		)
	`;
};
