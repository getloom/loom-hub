export const up = async (sql) => {
	await sql`
		create table if not exists settings (
			settings_id serial primary key,
			key text UNIQUE NOT NULL,
			value text NOT NULL,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz
		)
	`;
};
