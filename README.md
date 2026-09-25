# Loom-hub

This is the core template that drives Loom's programmable social platform applications.

It provides the core styling & OAuth2 integrations, as well as a DB migrations framework.

## Developing

Once you've cloned the project and installed dependencies with `npm install` start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

Make a copy of the .env.example file to have local env variables setup. The defaults should work with the docker-compose stack.

Run

```sh
npm run db:migrate
```

to get your DB schema up to date.

You'll also want to make sure you have docker (or other containerization tools) are installed on you system.

The front end is [Svelte-UX](https://svelte-ux.techniq.dev/)

To test locally with a running Keycloak instance & Postgres DB, use

```sh
docker compose up -d
```

### Setting up Keycloak sign-in locally

`docker compose up -d` brings up a fully configured Keycloak instance alongside Postgres — the `loom` realm, the `loom-app` confidential client, and a seed user are created automatically by the `ghcr.io/getloom/keycloak-dev` image.

1. `docker compose up -d`
2. Copy `.env.example` to `.env` — the defaults already match the seeded client's secret and the admin client the bootstrap creates.
3. Run `npm run keycloak:bootstrap` once. It configures what account registration (`POST /api/registration`) needs on top of the seeded realm:
   - enables direct access grants on `loom-app`, so a newly-registered user can be logged in immediately
   - creates the `loom-hub-admin` service-account client (secret from `KEYCLOAK_ADMIN_CLIENT_SECRET`) with the `realm-management` → `manage-users` role
   - makes `firstName`/`lastName` optional in the realm's user profile, since registration doesn't collect them
   - adds realm and client roles to the ID token, which is where the app reads roles from (so `founder` sees the admin panel)

   Keycloak can take up to a minute on first boot; the script waits for it. It's safe to re-run any time, and you'll need to re-run it after `docker compose down -v`.

4. Sign in with the seed account: username `founder`, password `founder` (has the `founder` realm role, used for initial admin testing).
5. The Keycloak admin console is at `http://localhost:8080` (`admin`/`admin`). To customize the realm name, client, redirect URIs, or seed user, set the corresponding environment variables on the `keycloak` service in `compose.yaml` — see the [getloom/keycloak-dev-container](https://github.com/getloom/keycloak-dev-container) README for the full list. If you change `CLIENT_ID`/`CLIENT_SECRET`, update `OIDC_CLIENTID`/`OIDC_SECRET` in your `.env` to match.

`COOKIE_KEYS` backs the encrypted Keycloak session cookie. `.env.example` has a working dev value; for anything else use three `__`-delimited random secrets, newest first. See `docs/authentication.md` for details.

**Note:** this compose file uses the same Keycloak container name (`keycloak-loom-dev`) and host ports (8080, 5432) as loom-app, so stop one stack (`docker compose down`) before starting the other.

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

To build a test docker image, run

```sh
npm run build:image
```

And then test it runs with

```sh
docker run -p 3000:3000 loom-hub
```

To test that it runs properly alongside keycloak you can use

```sh
docker compose up
```

## Production

Loom utilizes Docker, docker-compose, & the OCI format for production deployments.

Once you've built your image, you can use the following command to test a full production stack locally.

We recommend following this guide for getting set up on Docker: https://linuxiac.com/how-to-install-docker-on-linux-mint-21/

```
docker compose up
```

## Dependencies

Keycloak

Postgresql
