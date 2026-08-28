# Settings

## Default settings and initialization

Loom stores application configuration as key/value rows in the `settings` table. On every server boot, `applyDefaultSettings()` (called from `src/hooks.server.ts`) ensures a row exists for every key defined in `DEFAULT_SETTINGS` (`src/lib/system/settings/settingsConfig.server.ts`).

To add a new setting, add a key to `DEFAULT_SETTINGS` with its default value. The next server boot backfills it into every existing deployment's database — no migration or manual step needed.

## Overriding defaults with `config.json`

A deployment can override the default value used for a key's _first_ insert by placing a `config.json` file at the app's working directory (the repo root in `vite dev`, `/app` in the Docker image). This file is gitignored; `config.example.json` is the tracked template showing its shape — a flat object of setting key to string value.

```
cp config.example.json config.json
```

- Keys omitted from `config.json` fall back to their value in `DEFAULT_SETTINGS`.
- An unrecognized key in `config.json` (not present in `DEFAULT_SETTINGS`) is logged as a warning and ignored — it does not create a row and does not fail the boot.
- A non-string value for a known key is logged as a warning and ignored, falling back to the code default.

## Overrides only apply once

Overrides (and defaults) only affect the _first_ time a key is inserted. Once a row exists — whether created from a default/override or edited later by an admin via the settings API (`PUT /api/admin/settings/[key]`) — subsequent boots never touch it, even if `config.json` or `DEFAULT_SETTINGS` changes afterward.


## Settings Definitions
* invite_count_limit: the number of invitations a user will be able to create in a given time-period (defined by `invite_count_cycle`);
* invite_count_cycle: the cadence against which the invitation count limit is tracked (i.e. 10 / year, 2 / month, 100 / lifetime);
