set dotenv-load := true
set dotenv-filename := ".env.local"

# =============================================================================
# General
# =============================================================================

# Show the available Phase 0 operator commands.
default:
    @just --list

# =============================================================================
# Quality Gates
# =============================================================================

# Run all Vitest suites.
test:
    npm test

# Enforce local TypeScript import-source policy.
source-policy:
    npm run source-policy:check

# Type-check all npm workspaces.
typecheck:
    npm run typecheck

# Build all npm workspaces.
build:
    npm run build

# Run the reviewable local verification chain.
verify:
    npm run verify

# Check formatting without changing files.
format-check:
    npm run format:check

# =============================================================================
# Database And Deploy
# =============================================================================

# Generate the Prisma client from the committed Postgres schema.
prisma-generate:
    npx prisma generate

# Apply committed Prisma migrations to the configured Postgres database.
prisma-migrate-deploy:
    npx prisma migrate deploy

# Run the Vercel build locally against the configured Neon/Postgres database.
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
core-turn *turn_flags:
    @npm --silent run core:turn -- {{ turn_flags }}

# Drive the Phase 0 engine turn by turn; use -- --trace for compact trace output.
core-chat *chat_flags:
    @npm --silent run core:chat -- {{ chat_flags }}

# Start the dev-only lab API; default port is 8787, override with -- --port <port>.
core-serve *server_flags:
    @npm --silent run core:serve -- {{ server_flags }}

# Run journey fixtures, e.g. -- --trace-output artifacts/phase0/traces.jsonl
core-simulate *simulation_flags:
    @npm --silent run core:simulate -- {{ simulation_flags }}

# Write a model comparison report, e.g. -- --output artifacts/phase0/comparison.json
core-compare *comparison_flags:
    @npm --silent run core:compare -- {{ comparison_flags }}

# Run persona scenarios, e.g. -- --transcripts-output <jsonl> --report-output <json>
core-persona-simulate *persona_flags:
    @npm --silent run core:persona-simulate -- {{ persona_flags }}

# Run stochastic scenarios, e.g. -- --profile smoke|review|soak --seed <value>
core-stochastic *stochastic_flags:
    @npm --silent run core:stochastic -- {{ stochastic_flags }}

# Generate a route audit from a completed lab API run folder.
route-audit *audit_flags:
    @npm --silent run core:route-audit -- {{ audit_flags }}

# =============================================================================
# Hell Week Evidence
# =============================================================================

# Run the Hell Week gauntlet (full battery) and write an HTML dashboard. e.g. -- --profile smoke
hell-week *hell_flags:
    @npm --silent run core:hell-week -- {{ hell_flags }}

# Compare two Hell Week report.json files or run folders.
hell-week-compare *compare_flags:
    @npm --silent run core:hell-week-compare -- {{ compare_flags }}

# Classify repeated Hell Week runs already persisted in Postgres.
hell-week-stability *stability_flags:
    @npm --silent run core:hell-week-stability -- {{ stability_flags }}

# =============================================================================
# Demo Logs
# =============================================================================

# Summarize stakeholder demo interactions from Postgres.
demo-log-summary *log_flags:
    @npm --silent run core:demo-log -- summary {{ log_flags }}

# Show a stakeholder demo conversation, e.g. just demo-log-session -- conv-ref --full
demo-log-session *log_flags:
    @npm --silent run core:demo-log -- session {{ log_flags }}

# Show one logged stakeholder demo turn, e.g. just demo-log-turn -- conv-ref 2 --full
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

# Start the Astro site dev server; pass Astro flags after -- when needed.
site-dev *astro_args:
    @set -- {{ astro_args }}; \
      if [ "${1:-}" = "--" ]; then \
        shift; \
      fi; \
      npm --prefix site run dev -- "$@"

# Build the Astro site surface.
site-build:
    @npm --prefix site run build

# Preview the built Astro site; pass Astro flags after -- when needed.
site-preview *astro_args:
    @set -- {{ astro_args }}; \
      if [ "${1:-}" = "--" ]; then \
        shift; \
      fi; \
      npm --prefix site run preview -- "$@"

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

# Start engine (8788), customer widget (5174) and host page (5180) together.
demo:
    @set -e; \
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
      npm --silent run core:serve -- --port 8788 --demo-only & \
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

# Start engine (8788), MAL review widget (5175) and MAL contact page (5181).

# This is the original mock Sam saw, driven by the loanslam engine.
review:
    @set -e; \
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
      npm --silent run core:serve -- --port 8788 --demo-only & \
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

# Start the local Vue lab console; pass Vite flags after -- when needed.
lab-ui *vite_args:
    @set -- {{ vite_args }}; \
      if [ "${1:-}" = "--" ]; then \
        shift; \
      fi; \
      npm --silent run lab-ui:dev -- "$@"

# Build the local Phase 0 Vue lab console.
lab-ui-build:
    @npm --silent run lab-ui:build
