# Authentication

## SSO & OIDC

Loom only supports signing in via Oauth2 & is developed against [Keycloak](https://github.com/keycloak/keycloak).

Ideally it will be compatible with any OAuth2/OIDC provider, but we're starting with a Keycloak integration since that's what we use.

The Keycloak flow is a server-side OIDC Authorization Code + PKCE exchange, handled entirely in `src/hooks.server.ts` and `src/routes/auth/`:

- `/auth/keycloak/login` starts the flow
- `/auth/keycloak/callback` exchanges the authorization code for tokens, then sets a `kc_session` cookie
- `/auth/logout` clears the `kc_session` cookie
- `hooks.server.ts` authenticates a request if a valid, non-expired `kc_session` cookie is present.

### Configuration

The Keycloak integration is configured via env vars (see `.env.example`):

- `OIDC_URL` — the realm's issuer URL, e.g. `http://localhost:8080/realms/loom`
- `OIDC_CLIENTID` / `OIDC_SECRET` — the confidential client's ID and secret
- `OIDC_SCOPES` — space-separated OIDC scopes to request (defaults to `openid`)
- `COOKIE_KEYS` — three `__`-delimited, random secrets in order of newest to oldest) used to derive the encryption key for the `kc_session` and `kc_oauth_state` cookies.
- `KEYCLOAK_ADMIN_CLIENT_ID` / `KEYCLOAK_ADMIN_CLIENT_SECRET` — a service-account client (with the `manage-users` role from `realm-management`) used by registration to create and, if needed, roll back Keycloak users via the Admin API. For local dev, `npm run keycloak:bootstrap` creates this client; see the README.

`OIDC_DISABLE_PASSWORD` is declared but not yet wired up — the local password flow always stays on regardless of its value.

The local `users` table records the issuing provider's `iss` alongside `sub` at every login, since the OIDC spec only guarantees `sub` is unique within a single issuer.

### Roles

Admin-only features (e.g. `/admin`) are gated on Keycloak role claims — see `src/lib/system/auth/roles.server.ts`. Roles are read from the ID token at login (`tokens.claims()` in `/auth/keycloak/callback`) and cached on the `kc_session` cookie for the session's lifetime, so a role change in Keycloak only takes effect the next time the user signs in.

`extractRoles` merges roles from two possible claim locations, since either is a valid place to assign a role in Keycloak:

- `realm_access.roles` — realm roles
- `resource_access.<OIDC_CLIENTID>.roles` — client roles, scoped to the `loom-app` client

**Client setup gotcha:** in the Keycloak admin console, the mapper that puts roles on the token (Client Scopes → the relevant scope → Mappers → "realm roles" and/or "client roles") has separate toggles for "Add to access token", "Add to userinfo", and **"Add to ID token"**. Only the ID token is read here — if "Add to ID token" is off (Keycloak's default for the built-in mapper often only has access token/userinfo on), the role claim silently won't reach the app even though the mapper exists and the user has the role assigned. If you're assigning roles as **client** roles rather than realm roles, make sure the mapper is a "client roles" mapper (not just "realm roles") with the same "Add to ID token" toggle enabled, and that it targets the `loom-app` client. For local dev, `npm run keycloak:bootstrap` turns on "Add to ID token" for both the "realm roles" and "client roles" mappers in the `roles` client scope.

### Registration

`POST /api/registration` turns a redeemable (`pending` or `active`) invitation into a real account:

1. Creates a permanent, enabled user in Keycloak via the Admin API, using `KEYCLOAK_ADMIN_CLIENT_ID`/`KEYCLOAK_ADMIN_CLIENT_SECRET` (a service-account client with `manage-users`).
2. Logs the new user in immediately via a Direct Access Grant (Resource Owner Password Credentials) against the `loom-app` client, setting the same `kc_session` cookie the OIDC callback sets.
3. Redeems the invitation in a single transaction (the invitation row is locked): it records a row in `invitation_redemptions` with the new user's Keycloak subject, increments `use_count`, and sets the status to `active` (uses remain) or `accepted` (`use_count` reached `max_uses`). The redemption is rejected if the code is no longer redeemable (409) or the creator's `invite_count_limit` has been reached (429).

If anything after step 1 fails (including a rejected redemption), the just-created Keycloak user is deleted so Keycloak and the invitation stay consistent.

**Realm setup:** registration needs direct access grants enabled on the `loom-app` client, and because it doesn't collect first/last names, `firstName`/`lastName` must be optional in the realm's user profile (Realm settings → User profile). Keycloak requires both by default, and a user missing them is blocked from password login with `invalid_grant: Account is not fully set up`, which fails step 2. `npm run keycloak:bootstrap` applies both for local dev; a production realm needs the same settings.

### Invite codes

When creating an invitation, the creator may supply their own code (the **Create** button on `/invitations` opens a dialog with an optional "Custom code" field). A custom code is 4-64 characters from `a-z A-Z 0-9 _ -`. If the field is left blank, a random code is generated.

Codes are matched case-insensitively: the case the creator typed is stored and displayed, but `?invite_code=Welcome` finds an invitation created as `welcome`, and a code that differs from an existing one only by case is rejected as already taken (409). This is enforced by a unique index on `lower(invite_code)`.

#### Multi-use codes

A code can be configured to be redeemed more than once. The creator picks **Max uses** in the create dialog (an integer of at least 1, default 1) or ticks **Unlimited**. Over the API this is `max_uses`: omitted means 1, `null` means unlimited, and anything else must be a positive integer.

An invitation moves through these statuses:

- `pending` — no redemptions yet.
- `active` — at least one redemption, and uses remain (unlimited codes stay `active`).
- `accepted` — `use_count` has reached `max_uses`.
- `revoked` — an `accepted` code whose redemptions have all been revoked.
- `expired` — a `pending` or `active` code past its `expires_at`. Existing redemptions remain visible and revocable.

Every redemption is its own row in `invitation_redemptions`, so admins can revoke individual users: on `/admin` each redeemer has a Revoke button that deactivates that Keycloak user and marks that redemption `revoked`. A revoked redemption still counts toward `max_uses` and toward the creator's invite limit; slots are not reused.

`invite_count_limit` / `invite_count_cycle` count **redemptions** per creator (not invitation rows). The limit is checked when creating a code (the creator must have headroom) and again, authoritatively, at redemption. Creators with an exempt role (`founder`) skip the limit; because the redeemer's request has no access to the creator's roles, this is persisted on the invitation as `limit_exempt` when it is created.

A code can be deleted only while it is `pending` or `expired` **and** has never been redeemed.

### Current scope

Loom uses Keycloak as the source of truth for:

- Managing user accounts (i.e. accounts & account settings are stored here)
- Managing user roles
