# Site

## Deploying a static site

A `founder`/`leader` can visit `/site` to upload a `.zip` of a static site. The server extracts it into `SITE_UPLOAD_PATH` (default `/var/www/html`), fully replacing whatever was there before, and records the deploy (filename, size, file count, who, when) in the `site_deploys` table.

Extraction stages the new content in a sibling temp directory before atomically swapping it into place, so a failed or interrupted upload never leaves the target directory half-replaced. Every zip entry's resolved path is checked to stay inside the target directory before anything is written, rejecting path-traversal (zip-slip) entries with no files written outside the target.

## Serving the uploaded files

This app only writes files to `SITE_UPLOAD_PATH`; it does not serve them to the public internet itself. Serving that directory is the operator's responsibility — mount `SITE_UPLOAD_PATH` into whatever external process serves it (e.g. an nginx container with a shared volume).

## Configuration

- `SITE_UPLOAD_PATH`: the directory deploys are extracted into. Defaults to `/var/www/html`.
- `BODY_SIZE_LIMIT`: adapter-node defaults this to `512K`, which is too small for a site zip upload. Raise it via this env var (e.g. `BODY_SIZE_LIMIT="50M"`) to allow larger uploads.
