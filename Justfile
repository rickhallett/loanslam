set dotenv-load := true
set dotenv-filename := ".env.local"

# =============================================================================
# General
# =============================================================================

# Show the public Loanslam operator commands.
default:
    @just --list

# =============================================================================
# Quality Gates
# =============================================================================

# Run all Vitest suites.
[private]
test:
    npm test

# Enforce local TypeScript import-source policy.
source-policy:
    npm run source-policy:check

# Type-check all npm workspaces.
[private]
typecheck:
    npm run typecheck

# Build all npm workspaces.
[private]
build:
    npm run build

# Run the reviewable local verification chain, including report manifest drift.
verify:
    npm run verify

# Check formatting without changing files.
[private]
format-check:
    npm run format:check

# =============================================================================
# Database And Deploy
# =============================================================================

# Generate the Prisma client from the committed Postgres schema.
[private]
prisma-generate:
    npx prisma generate

# Apply committed Prisma migrations to the configured Postgres database.
[private]
prisma-migrate-deploy:
    npx prisma migrate deploy

# Run the Vercel build path locally; applies committed Prisma migrations to the configured database.
[private]
vercel-build:
    npm run vercel-build

# =============================================================================
# Secrets
# =============================================================================

# Show encrypted secret status without printing values.
secrets-status *args:
    @node scripts/secrets.mjs status {{ args }}

# Initialize an encrypted environment file with empty keys.
secrets-init env *args:
    @node scripts/secrets.mjs init {{ env }} {{ args }}

# Edit an encrypted environment with SOPS.
secrets-edit env:
    @node scripts/secrets.mjs edit {{ env }}

# Set one encrypted value from stdin, e.g. openssl rand -hex 32 | just secrets-set staging DEMO_STATE_TOKEN_SECRET.
secrets-set env key:
    @node scripts/secrets.mjs set {{ env }} {{ key }}

# Render an encrypted environment to its ignored local cache, e.g. local -> .env.local.
secrets-render env:
    @node scripts/secrets.mjs render {{ env }}

# Run a command with decrypted secrets without writing a plaintext env file.
secrets-run env *command:
    @node scripts/secrets.mjs run {{ env }} -- {{ command }}

# Dry-run by default. Add --apply to mutate Vercel environment variables.
secrets-sync-vercel env *args:
    @node scripts/secrets.mjs sync-vercel {{ env }} {{ args }}

# Dry-run by default. Add --apply to mutate Railway variables.
secrets-sync-railway env *args:
    @node scripts/secrets.mjs sync-railway {{ env }} {{ args }}

# =============================================================================
# Core Engine
# =============================================================================

# Probe one planner-backed turn, e.g. -- --message "How do I apply?"
[private]
core-turn *turn_flags:
    @npm --silent run core:turn -- {{ turn_flags }}

# Drive the Phase 0 engine turn by turn; use -- --trace for compact trace output.
[private]
core-chat *chat_flags:
    @npm --silent run core:chat -- {{ chat_flags }}

# Start the dev-only lab API; default port is 8787, override with -- --port <port>.
[private]
core-serve *server_flags:
    @npm --silent run core:serve -- {{ server_flags }}

# Start the demo-safe API; default port is 8787, override with -- --port <port>.
[private]
core-demo-serve *server_flags:
    @npm --silent run core:demo-serve -- {{ server_flags }}

# Run journey fixtures, e.g. -- --trace-output artifacts/phase0/traces.jsonl
[private]
core-simulate *simulation_flags:
    @npm --silent run core:simulate -- {{ simulation_flags }}

# Write a model comparison report, e.g. -- --output artifacts/phase0/comparison.json
[private]
core-compare *comparison_flags:
    @npm --silent run core:compare -- {{ comparison_flags }}

# Run persona scenarios, e.g. -- --transcripts-output <jsonl> --report-output <json>
[private]
core-persona-simulate *persona_flags:
    @npm --silent run core:persona-simulate -- {{ persona_flags }}

# Run stochastic scenarios, e.g. -- --profile smoke|review|soak --seed <value>
[private]
core-stochastic *stochastic_flags:
    @npm --silent run core:stochastic -- {{ stochastic_flags }}

# Generate a route audit from a completed lab API run folder.
[private]
route-audit *audit_flags:
    @npm --silent run core:route-audit -- {{ audit_flags }}

# Verify the assistant-first contact route finder UX against a running site-nuxt server.
contact-assistant-proof *proof_flags:
    @node scripts/contact-assistant-ux-proof.mjs {{ proof_flags }}

# Verify the concierge/engine seam (badges, header temperature, transcript dividers) against a running site-nuxt server.
seam-walk-proof *proof_flags:
    @node scripts/seam-walk-proof.mjs {{ proof_flags }}

# =============================================================================
# Hell Week Evidence
# =============================================================================

# Run the Hell Week gauntlet (full battery) and write an HTML dashboard. e.g. -- --profile smoke
hell-week *hell_flags:
    @npm --silent run core:hell-week -- {{ hell_flags }}

# Run the review-tier Hell Week pipeline: full battery -> ladder judge -> regrade.
hell-week-review *review_flags:
    @npm --silent run core:hell-week-review -- {{ review_flags }}

# Judge a captured Hell Week run with OpenAI and write judge-verdicts.json.
hell-week-judge *judge_flags:
    @npm --silent run core:hell-week-judge -- {{ judge_flags }}

# Run the frozen Hell Week judge gold-set calibration with OpenAI.
[private]
hell-week-judge-calibrate *calibration_flags:
    @npm --silent run core:hell-week-judge-calibrate -- {{ calibration_flags }}

# Compare two Hell Week report.json files or run folders.
[private]
hell-week-compare *compare_flags:
    @npm --silent run core:hell-week-compare -- {{ compare_flags }}

# Classify repeated Hell Week runs already persisted in Postgres.
hell-week-stability *stability_flags:
    @npm --silent run core:hell-week-stability -- {{ stability_flags }}

# =============================================================================
# Ops Loop Gates
# =============================================================================

# Score a candidate Hell Week run vs the committed baseline anchor; writes a
# REPAIRED|HOLDING|REGRESSED|INCONCLUSIVE receipt and exits non-zero on a
# regression.
# Score a candidate Hell Week run against the committed baseline.
floor-delta *delta_flags:
    @npm --silent run floor-delta -- {{ delta_flags }}

# Deterministic keep-commit gate over the staged diff: blocks staged secret
# caches/evidence.json, decrypted key content, engine changes without a valid
# floor-delta receipt, and demo<->review widget cross-pollination.
# Run the deterministic staged-diff keep-commit gate.
gate-slice *gate_flags:
    @npm --silent run gate-slice -- {{ gate_flags }}

# Cheap zero-token self-gate: the full verify chain plus a best-effort fallow
# audit. Behaviour proof still requires Hell Week; this only proves wiring and reports.
# Run verify plus a best-effort fallow audit.
self-gate:
    @npm run --silent verify
    @command -v fallow >/dev/null 2>&1 && fallow audit --format json || echo "self-gate: fallow not on PATH; ran verify only"

# Activate the ops-loop pre-commit gate (sets the shared core.hooksPath).
# Install the shared pre-commit gate.
hooks-install:
    @git config core.hooksPath scripts/hooks
    @echo "ops-loop pre-commit gate active (core.hooksPath=scripts/hooks)"

# Privacy-preserving Hell Week digest (typed numbers from report.json only,
# never evidence.json transcripts).
# Build a privacy-preserving Hell Week digest.
digest *digest_flags:
    @npm --silent run digest -- {{ digest_flags }}

# Prepare an isolated worktree for one disjoint-scope slice; refuses to touch
# protected/checked-out branches.
# Prepare an isolated worktree for one slice.
slice-new *slice_flags:
    @bash scripts/slice-worktree.sh {{ slice_flags }}

# Read-only orientation snapshot: branch, upstream, dirty state, worktrees, hook.
status-snapshot:
    @bash scripts/status-snapshot.sh

# Regenerate the /reports static pages from the publish manifest
# (packages/review-host/reports-manifest.json). Add -- --check to verify only.
# Build or check sanitized public report pages.
reports-build *reports_flags:
    @node scripts/build-reports.mjs {{ reports_flags }}

# Map this branch's changed files to the proof bar they require. e.g. -- --base dev
branch-risk *risk_flags:
    @npm --silent run branch-risk -- {{ risk_flags }}

# Compact checkpoint packet (orient + proof bar + evidence) for review/PR bodies.
# e.g. just checkpoint-packet -- <run-dir>
checkpoint-packet *packet_flags:
    @bash scripts/checkpoint-packet.sh {{ packet_flags }}

# =============================================================================
# Demo Logs
# =============================================================================

# Summarize stakeholder demo interactions from Postgres.
[private]
demo-log-summary *log_flags:
    @npm --silent run core:demo-log -- summary {{ log_flags }}

# Show a stakeholder demo conversation, e.g. just demo-log-session -- conv-ref --full
[private]
demo-log-session *log_flags:
    @npm --silent run core:demo-log -- session {{ log_flags }}

# Show one logged stakeholder demo turn, e.g. just demo-log-turn -- conv-ref 2 --full
[private]
demo-log-turn *log_flags:
    @npm --silent run core:demo-log -- turn {{ log_flags }}

# =============================================================================
# MCP
# =============================================================================

# Start the local stdio MCP server for the lab API simulator.
mcp-lab-api:
    @npm --silent run mcp:lab-api

# =============================================================================
# Site
# =============================================================================

# Start the current Nuxt keeper site; pass Nuxt flags after -- when needed.
site-nuxt-dev *nuxt_args:
    @set -- {{ nuxt_args }}; \
      if [ "${1:-}" = "--" ]; then \
        shift; \
      fi; \
      npm --workspace @loanslam/site-nuxt run dev -- "$@"

# Build the current Nuxt keeper site.
site-nuxt-build:
    @npm run site-nuxt-build

# =============================================================================
# Local Apps
# =============================================================================

# Start the lab API on 8787 and Vue console on 5173 together.
lab:
    @set -e; \
      server_pid=""; \
      ui_pid=""; \
      kill_tree() { \
        pid="$1"; \
        for child_pid in $(pgrep -P "$pid" 2>/dev/null || true); do \
          kill_tree "$child_pid"; \
        done; \
        kill "$pid" 2>/dev/null || true; \
      }; \
      cleanup() { \
        if [ -n "$ui_pid" ]; then \
          kill_tree "$ui_pid"; \
        fi; \
        if [ -n "$server_pid" ]; then \
          kill_tree "$server_pid"; \
        fi; \
        wait 2>/dev/null || true; \
      }; \
      trap cleanup EXIT INT TERM; \
      npm --silent run core:serve -- --port 8787 & \
      server_pid=$!; \
      sleep 1; \
      if ! kill -0 "$server_pid" 2>/dev/null; then \
        wait "$server_pid"; \
        exit 1; \
      fi; \
      LAB_API_TARGET="http://127.0.0.1:8787" npm --silent run lab-ui:dev -- --port 5173 & \
      ui_pid=$!; \
      wait "$ui_pid"

# Start engine (8788), customer widget (5174) and host page (5180) together; pass core:serve flags after --.
[private]
demo *server_flags:
    @set -e; \
      set -- {{ server_flags }}; \
      if [ "${1:-}" = "--" ]; then \
        shift; \
      fi; \
      server_pid=""; \
      widget_pid=""; \
      host_pid=""; \
      kill_tree() { \
        pid="$1"; \
        for child_pid in $(pgrep -P "$pid" 2>/dev/null || true); do \
          kill_tree "$child_pid"; \
        done; \
        kill "$pid" 2>/dev/null || true; \
      }; \
      cleanup() { \
        for pid in "$host_pid" "$widget_pid" "$server_pid"; do \
          if [ -n "$pid" ]; then \
            kill_tree "$pid"; \
          fi; \
        done; \
        wait 2>/dev/null || true; \
      }; \
      trap cleanup EXIT INT TERM; \
      npm --silent run core:demo-serve -- --port 8788 "$@" & \
      server_pid=$!; \
      sleep 1; \
      if ! kill -0 "$server_pid" 2>/dev/null; then \
        wait "$server_pid"; \
        exit 1; \
      fi; \
      LAB_API_TARGET="http://127.0.0.1:8788" npm --silent run demo-widget:dev & \
      widget_pid=$!; \
      npm --silent run demo-host:dev & \
      host_pid=$!; \
      echo "LoanSlam demo -> open http://127.0.0.1:5180 (widget 5174, demo API 8788)"; \
      wait "$host_pid"

# Start the Loanslam demo locally without Postgres owner logging.
[private]
demo-local:
    @just demo -- --no-demo-log

# Start engine (8788), MAL review widget (5175) and MAL contact page (5181).

# This is the original mock Sam saw, driven by the loanslam engine; pass core:serve flags after --.
[private]
review *server_flags:
    @set -e; \
      set -- {{ server_flags }}; \
      if [ "${1:-}" = "--" ]; then \
        shift; \
      fi; \
      server_pid=""; \
      widget_pid=""; \
      host_pid=""; \
      kill_tree() { \
        pid="$1"; \
        for child_pid in $(pgrep -P "$pid" 2>/dev/null || true); do \
          kill_tree "$child_pid"; \
        done; \
        kill "$pid" 2>/dev/null || true; \
      }; \
      cleanup() { \
        for pid in "$host_pid" "$widget_pid" "$server_pid"; do \
          if [ -n "$pid" ]; then \
            kill_tree "$pid"; \
          fi; \
        done; \
        wait 2>/dev/null || true; \
      }; \
      trap cleanup EXIT INT TERM; \
      npm --silent run core:demo-serve -- --port 8788 "$@" & \
      server_pid=$!; \
      sleep 1; \
      if ! kill -0 "$server_pid" 2>/dev/null; then \
        wait "$server_pid"; \
        exit 1; \
      fi; \
      LAB_API_TARGET="http://127.0.0.1:8788" npm --silent run review-widget:dev & \
      widget_pid=$!; \
      npm --silent run review-host:dev & \
      host_pid=$!; \
      echo "MAL review demo -> open http://127.0.0.1:5181 (widget 5175, demo API 8788)"; \
      wait "$host_pid"

# Start the legacy review demo locally without Postgres owner logging.
[private]
review-local:
    @just review -- --no-demo-log

# Start the local Vue lab console; pass Vite flags after -- when needed.
[private]
lab-ui *vite_args:
    @set -- {{ vite_args }}; \
      if [ "${1:-}" = "--" ]; then \
        shift; \
      fi; \
      npm --silent run lab-ui:dev -- "$@"

# Build the local Phase 0 Vue lab console.
[private]
lab-ui-build:
    @npm --silent run lab-ui:build
