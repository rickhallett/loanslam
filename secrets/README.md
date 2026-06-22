# Secrets

- Canonical values live in encrypted `secrets/*.env.sops` files.
- Plain `.env.*` files are ignored generated caches for local runtime use.
- `local` renders to `.env.local`; `staging` renders to `.env.staging`; `production` renders to `.env.production`.
- Vercel and Railway variables are deployment sinks. Do not treat either platform as the source of truth.
- Do not print decrypted values in chat, logs, commits, or PR descriptions.

## Commands

```sh
just secrets-status
just secrets-init staging
just secrets-edit staging
openssl rand -hex 32 | just secrets-set staging DEMO_STATE_TOKEN_SECRET
just secrets-render local
just secrets-run local -- npm test
just secrets-sync-vercel staging -- --dry-run
just secrets-sync-railway staging -- --dry-run
```

Use `--apply` on sync commands only when intentionally mutating cloud environment variables.

## Local Required Keys

`local` must contain `OPENAI_API_KEY`, `DATABASE_URL`,
`DATABASE_URL_UNPOOLED`, `DEMO_INTERACTION_DATABASE_URL`, and `WAFER_API_KEY`.
The DB URLs should point at the local Postgres instance used by Hell Week and
demo-log evidence runs.
