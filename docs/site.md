# Site

## Deploying a static site

A `founder`/`leader` can visit `/site` to upload a `.zip` of a static site. The server extracts it into a new release directory under `SITE_UPLOAD_PATH` (default `/var/www/html`) and records the deploy (filename, size, file count, who, when) in the `site_deploys` table.

The zip must contain `index.html` at its root (not inside a wrapper folder, and matched case-sensitively). Otherwise the upload is rejected with HTTP 422 before anything is written, and the live site is unchanged.

`SITE_UPLOAD_PATH` is the release root and is never removed or renamed, as it may be a bind-mount point:

```
$SITE_UPLOAD_PATH/
  releases/2026-11-21T14-30-00-123Z/...   # one directory per deploy
  site -> releases/2026-11-21T14-30-00-123Z   # relative symlink to the live release
```

Each deploy is staged inside `releases/`, then `site` is atomically repointed at it, so readers see either the old or the new release and a failed upload leaves `site` on the previous release. The 5 most recent releases are kept; older ones are pruned. If `site` is an existing real directory (first deploy after upgrading), it is moved to `releases/legacy-<timestamp>` before being replaced by the symlink. Every zip entry's resolved path is checked to stay inside the staging directory before anything is written, rejecting path-traversal (zip-slip) entries with no files written outside it.

## Serving the uploaded files

This app only writes files to `SITE_UPLOAD_PATH`; it does not serve them to the public internet itself. Serving is the operator's responsibility — mount `SITE_UPLOAD_PATH` into whatever external process serves it (e.g. an nginx container with a shared volume), and use `<SITE_UPLOAD_PATH>/site` as its document root, following symlinks.

## Configuration

- `SITE_UPLOAD_PATH`: the release root deploys are written into; the served content is at `$SITE_UPLOAD_PATH/site`. Defaults to `/var/www/html`.
- `BODY_SIZE_LIMIT`: adapter-node defaults this to `512K`, which is too small for a site zip upload. Raise it via this env var (e.g. `BODY_SIZE_LIMIT="50M"`) to allow larger uploads.
