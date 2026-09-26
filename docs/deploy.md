# Deploy (VPS)

Production runs on the `server-pras-1` VPS (nginx + PM2, no Docker), not Vercel.
Server tooling and conventions: <https://github.com/PrasGi/server-pras-1>.

| | |
|---|---|
| URL | https://bot-review.prasme.id |
| Project | `personal/bot-review` → `/workspace/personal/bot-review` |
| Runtime user | `app-personal-bot-review` (own PM2 daemon), `127.0.0.1:3300` |
| Databases | MongoDB `personal_bot_review`, Redis user `personal_bot_review` (Redis is not used by the code yet) |

## Pipeline

`.github/workflows/ci-cd.yml`:

- **Every PR and push**: `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm typecheck`.
- **Push to `main`**: the checkout (source + `.next`, without `node_modules`) is rsynced to
  `releases/<sha>`. `srv-deploy` then gets `node_modules` on the server (hardlinked from the
  active release when `pnpm-lock.yaml` is unchanged, otherwise `pnpm install --frozen-lockfile`,
  ~16 s), reloads PM2 (`next start`), checks `/api/health`, and rolls back to the previous
  release if the check fails.

`node_modules` is not uploaded because GitHub → Jakarta is slow (~270 KB/s); the server pulls
from npm at ~34 MB/s.

`rsync --link-dest` hardlinks files unchanged since the active release, so each release only uses
disk for what changed. Because of that, **never edit files under `releases/`**: an edit leaks into
every release that shares the file.

Scripts can run on the server from the active release. They do not load `.env` on their own,
so pass it (`current/.env` links to `shared/.env`):

```bash
sudo -u app-personal-bot-review -H bash -c \
  'cd /workspace/personal/bot-review/current && pnpm exec tsx --env-file=.env --tsconfig tsconfig.json scripts/seed.ts'
```

Repository secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SCOPE`, `DEPLOY_KNOWN_HOSTS` and
`DEPLOY_SSH_KEY` come from `srv deploy-key personal/bot-review` (run as root on the server;
re-running it rotates the key).

## Environment

Runtime env lives only on the server, in `shared/.env`. CI never writes it.

```bash
ssh server-pras-1
srv env edit personal/bot-review      # edit and reload
```

The local `.env` points at the same MongoDB/Redis as production (owner's choice), so local
runs read and write production data.

## Server-side extras

- **Rollup cron**: the former Vercel cron runs from `app-personal-bot-review`'s crontab at
  08:00 WIB (01:00 UTC) and calls `/api/cron/rollup` with `CRON_SECRET`. Output goes to
  `logs/cron.log`.
- **Graceful reload**: `ecosystem.config.cjs` sets `kill_timeout: 120000` so reviews started
  with `after()` can finish when a deploy reloads the app.

## Operations

```bash
srv pm2 status personal/bot-review
srv pm2 logs personal/bot-review
srv pm2 restart personal/bot-review
```

Roll back by re-running an earlier successful workflow run, or on the server as the app user:
`srv-deploy personal/bot-review <older sha>` (the last 5 releases are kept).
