set dotenv-load

default:
    @just --list

# Run the TypeScript/Vitest test suite.
test:
    npm test

# Type-check all npm workspaces.
typecheck:
    npm run typecheck

# Build all npm workspaces.
build:
    npm run build

# Check formatting without changing files.
format-check:
    npm run format:check

# Run one local TurnPlanner turn through the Phase 0 CLI.
core-turn *args:
    @npm --silent run core:turn -- {{args}}

# Run the Phase 0 journey simulation.
core-simulate *args:
    @npm --silent run core:simulate -- {{args}}

# Compare configured Phase 0 planner models.
core-compare *args:
    @npm --silent run core:compare -- {{args}}

# Start the local SQL Server container.
mssql-up:
    @if docker inspect loanslam-mssql 2>/dev/null | grep -q '"Status": "healthy"'; then \
      echo "Using existing healthy loanslam-mssql container."; \
    else \
      docker compose -f docker-compose.mssql.yml up -d mssql; \
    fi

# Wait until the local SQL Server container healthcheck is green.
mssql-wait:
    @for attempt in $(seq 1 60); do \
      if docker inspect loanslam-mssql 2>/dev/null | grep -q '"Status": "healthy"'; then \
        docker compose -f docker-compose.mssql.yml ps mssql; \
        exit 0; \
      fi; \
      printf 'Waiting for SQL Server healthcheck (%s/60)\n' "$attempt"; \
      sleep 2; \
    done; \
    docker compose -f docker-compose.mssql.yml logs --tail=80 mssql; \
    exit 1

# Stop the local SQL Server container while preserving its named data volume.
mssql-stop:
    docker compose -f docker-compose.mssql.yml stop mssql

# Remove the local SQL Server container and volume.
mssql-down:
    docker compose -f docker-compose.mssql.yml down -v

# Print the local SQL Server URL for Prisma or app env.
mssql-url db="loanslam" host="localhost":
    @password="${MSSQL_SA_PASSWORD:-LocalDev!Passw0rd}"; \
      port="${MSSQL_PORT:-1434}"; \
      printf 'sqlserver://%s:%s;database=%s;user=sa;password=%s;trustServerCertificate=true\n' "{{host}}" "$port" "{{db}}" "$password"

# Create the local Loanslam database if it does not already exist.
mssql-create-db db="loanslam":
    @set -e; \
      password="${MSSQL_SA_PASSWORD:-LocalDev!Passw0rd}"; \
      just mssql-up; \
      just mssql-wait; \
      docker exec loanslam-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "$password" -Q "IF DB_ID(N'{{db}}') IS NULL CREATE DATABASE [{{db}}];"; \
      echo "Database '{{db}}' is ready."

# Start SQL Server, wait for readiness, create the default DB, and print DATABASE_URL.
local-db:
    @just mssql-create-db loanslam
    @printf 'DATABASE_URL='
    @just mssql-url loanslam

# Open an interactive sqlcmd shell inside the local SQL Server container.
mssql-shell db="loanslam":
    @password="${MSSQL_SA_PASSWORD:-LocalDev!Passw0rd}"; \
      docker exec -it loanslam-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "$password" -d "{{db}}"
