export const up = async (sql) => {
	await sql`
		create table if not exists site_deploys (
			deploy_id serial primary key,
			filename text NOT NULL,
			size_bytes bigint NOT NULL,
			file_count integer NOT NULL,
			deployed_by text NOT NULL,
			deployed_at timestamptz NOT NULL DEFAULT now()
		)
	`;
};
