# Loanslam chat widget — operator command front door.
# `just` with no args lists recipes.

set dotenv-load := true

default:
    @just --list

# Install all workspace dependencies.
setup:
    npm install

# Run the backend API (file-backed memory store, hot reload).
dev-backend:
    npm run dev:backend

# Run the Vue widget dev server.
dev-widget:
    npm run dev:widget

# Run backend + widget together (needs two terminals normally; this backgrounds the API).
dev:
    @echo "Starting backend (8787) and widget (5173)…"
    npm run dev:backend & npm run dev:widget

# Typecheck every workspace.
typecheck:
    npm run typecheck

# Run all tests once.
test:
    npm run test

# Watch tests.
test-watch:
    npm run test:watch

# Lint + format check.
lint:
    npm run lint

format:
    npm run format

# Build all workspaces.
build:
    npm run build

# Scripted demo: drive the pipeline through every customer journey and print
# the transcript + audit trail. The flagship "does it earn cheers" command.
demo:
    npm run demo

# Production persistence path: bring up Dockerized SQL Server (see backend/prisma).
sqlserver-up:
    docker compose -f backend/docker-compose.sqlserver.yml up -d

sqlserver-down:
    docker compose -f backend/docker-compose.sqlserver.yml down

# Full local gate: typecheck + lint + test + build.
check: typecheck lint test build
