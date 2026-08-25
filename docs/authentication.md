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

- `OIDC_URL` — the realm's issuer URL, e.g. `https://localhost:8080/realms/loom`
- `OIDC_CLIENTID` / `OIDC_SECRET` — the confidential client's ID and secret
- `OIDC_SCOPES` — space-separated OIDC scopes to request (defaults to `openid`)
- `COOKIE_KEYS` — three `__`-delimited, random secrets in order of newest to oldest) used to derive the encryption key for the `kc_session` and `kc_oauth_state` cookies.
- `KEYCLOAK_ADMIN_CLIENT_ID` / `KEYCLOAK_ADMIN_CLIENT_SECRET` — a service-account client (with the `manage-users` role from `realm-management`) used by registration to create and, if needed, roll back Keycloak users via the Admin API.

`OIDC_DISABLE_PASSWORD` is declared but not yet wired up — the local password flow always stays on regardless of its value.

### Roles

Admin-only features (e.g. `/admin`) are gated on Keycloak role claims — see `src/lib/system/auth/roles.server.ts`. Roles are read from the ID token at login (`tokens.claims()` in `/auth/keycloak/callback`) and cached on the `kc_session` cookie for the session's lifetime, so a role change in Keycloak only takes effect the next time the user signs in.

`extractRoles` merges roles from two possible claim locations, since either is a valid place to assign a role in Keycloak:

- `realm_access.roles` — realm roles
- `resource_access.<OIDC_CLIENTID>.roles` — client roles, scoped to the `loom-app` client

**Client setup gotcha:** in the Keycloak admin console, the mapper that puts roles on the token (Client Scopes → the relevant scope → Mappers → "realm roles" and/or "client roles") has separate toggles for "Add to access token", "Add to userinfo", and **"Add to ID token"**. Only the ID token is read here — if "Add to ID token" is off (Keycloak's default for the built-in mapper often only has access token/userinfo on), the role claim silently won't reach the app even though the mapper exists and the user has the role assigned. If you're assigning roles as **client** roles rather than realm roles, make sure the mapper is a "client roles" mapper (not just "realm roles") with the same "Add to ID token" toggle enabled, and that it targets the `loom-app` client.

### Registration

`POST /api/registration` turns a pending invitation into a real account:

1. Creates a permanent, enabled user in Keycloak via the Admin API, using `KEYCLOAK_ADMIN_CLIENT_ID`/`KEYCLOAK_ADMIN_CLIENT_SECRET` (a service-account client with `manage-users`).
2. Logs the new user in immediately via a Direct Access Grant (Resource Owner Password Credentials) against the `loom-app` client, setting the same `kc_session` cookie the OIDC callback sets.
3. Marks the invitation `accepted`, recording the new user's Keycloak subject as `used_by`.

If anything after step 1 fails, the just-created Keycloak user is deleted so Keycloak and the invitation stay consistent.

### Current scope

Loom uses Keycloak as the source of truth for:

- Managing user accounts (i.e. accounts & account settings are stored here)
- Managing user roles
