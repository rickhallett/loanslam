# secrets

SOPS lifecycle. Doctrine: `AGENTS.md` (Secret Discipline).

- Status first: `just secrets-status` (never prints values).
- Local run: `just secrets-render <env>` (writes the ignored `.env.local` cache)
  or `just secrets-run <env> -- <command>` (no-file execution).
- Source of truth: encrypted `secrets/*.env.sops`. `.env.local`/`.env.staging`/
  `.env.production` are ignored generated caches; never commit them, never copy
  a stale one between worktrees, never paste decrypted values into logs/PRs.
- Deployment sinks (Vercel/Railway): `just secrets-sync-* <env> -- --dry-run`
  first, then `--apply` only when explicitly asked.

`scripts/gate-slice.ts` blocks a staged `.env*` cache or an API-key-shaped line;
the source-policy check blocks Anthropic imports (OpenAI-only mandate).
