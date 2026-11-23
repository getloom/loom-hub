export const up = async (sql) => {
	await sql`
		alter table invitations
			add column if not exists max_uses integer CHECK (max_uses IS NULL OR max_uses >= 1),
			add column if not exists use_count integer NOT NULL DEFAULT 0,
			add column if not exists limit_exempt boolean NOT NULL DEFAULT false
	`;
	// existing codes were single-use; max_uses = 1 for all existing rows
	await sql`update invitations set max_uses = 1 where max_uses is null`;
	await sql`alter table invitations alter column max_uses set default 1`;

	await sql`alter table invitations drop constraint if exists invitations_status_check`;
	await sql`
		alter table invitations add constraint invitations_status_check
		check (status in ('pending','active','accepted','revoked','expired'))
	`;

	await sql`
		create table if not exists invitation_redemptions (
			redemption_id serial primary key,
			invite_id integer NOT NULL REFERENCES invitations(invite_id),
			user_sub text NOT NULL,
			status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
			created_at timestamptz NOT NULL DEFAULT now(),
			revoked_at timestamptz
		)
	`;
	await sql`create index if not exists invitation_redemptions_invite_idx on invitation_redemptions (invite_id)`;
	await sql`create unique index if not exists invitation_redemptions_user_idx on invitation_redemptions (user_sub)`;

	// backfill from used_by (only if the column still exists, so re-runs are safe)
	const [{ exists }] = await sql`
		select exists (
			select 1 from information_schema.columns
			where table_name = 'invitations' and column_name = 'used_by'
		) as exists
	`;
	if (exists) {
		await sql`
			insert into invitation_redemptions (invite_id, user_sub, status, created_at, revoked_at)
			select invite_id, used_by,
			       case when status = 'revoked' then 'revoked' else 'active' end,
			       coalesce(updated_at, created_at),
			       case when status = 'revoked' then updated_at end
			from invitations where used_by is not null
			on conflict do nothing
		`;
		await sql`update invitations set use_count = 1 where used_by is not null`;
		await sql`alter table invitations drop column used_by`;
	}
};
