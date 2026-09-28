export const up = async (sql) => {
	await sql`
		create table if not exists posts (
			post_id serial primary key,
			type text NOT NULL,
			title text NOT NULL,
			body text,
			link text,
			image text,
			active boolean NOT NULL DEFAULT true,
			created_by text NOT NULL,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz
		)
	`;
};
