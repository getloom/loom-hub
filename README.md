# Loom-app

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
docker compose up
```

### Setting up Keycloak sign-in locally

To exercise "Sign in with Keycloak" (and account registration via `POST /api/registration`), you need to create a realm and clients by hand — there's no automated realm import yet:

1. `docker compose up`, then open the Keycloak admin console at `http://localhost:8080` and log in with `admin`/`admin`.
2. Create a realm matching your `.env`'s `OIDC_URL` (the default `.env.example` expects a realm named `loom`, i.e. `OIDC_URL=".../realms/loom"`).
3. In that realm, create a confidential client with the client ID matching `OIDC_CLIENTID` (`loom-app` by default), with:
   - **Valid redirect URI**: `http://localhost:5173/auth/keycloak/callback` (the SvelteKit dev server's default port)
   - **Valid post logout redirect URI**: `http://localhost:5173/signin`
   - **Direct access grants**: Needed so `POST /api/registration` can log a newly-registered user in immediately
4. Copy the client's secret (Keycloak admin console → client → Credentials tab) into `OIDC_SECRET` in your `.env`.
5. Create a second confidential client for registration's Admin API access, e.g. `loom-admin`:
   - **Client authentication**: On
   - **Standard flow** / **Direct access grants**: both off (service-account only)
   - **Service accounts roles**: On
   - Under the client's _Service account roles_ tab, assign the `manage-users` role from the `realm-management` client.
   - Copy its secret into `KEYCLOAK_ADMIN_CLIENT_SECRET` in your `.env` (and set `KEYCLOAK_ADMIN_CLIENT_ID` to match whatever client ID you used, `loom-admin` by default).
6. Set `COOKIE_KEYS` in your `.env` to three `__`-delimited secrets in the form `latest_secret_<random>__older_secret_<random>__oldest_secret_<random>` — these back the encrypted Keycloak session cookie. See `docs/authentication.md` for details.

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
docker run -p 3000:3000 loom-app
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
