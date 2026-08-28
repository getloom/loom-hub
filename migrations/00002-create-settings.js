export const up = async (sql) => {
	await sql`
		create table if not exists settings (
			key text primary key,
			value text NOT NULL,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz
		)
	`;
};
