set dotenv-load

default:
    @just --list

install:
    npm install

verify:
    npm run verify

dev:
    npm run dev:backend

dev-widget:
    npm run dev:widget

# Start SQL Server, apply migrations, and launch backend + widget with real provider env.
dev-full:
    @set -e; \
      if [ -z "${OPENAI_API_KEY:-}" ]; then \
        echo "OPENAI_API_KEY is missing. Add it to .env before running just dev-full."; \
        exit 1; \
      fi; \
      if [ -z "${DATABASE_URL:-}" ]; then \
        DATABASE_URL="$(just mssql-url loanslam)"; \
        export DATABASE_URL; \
      fi; \
      if [ -z "${OPENAI_VECTOR_STORE_ID:-}" ]; then \
        echo "OPENAI_VECTOR_STORE_ID is missing; syncing the KB with OPENAI_API_KEY from .env."; \
        vector_output="$(npm --silent run kb:sync -w backend)"; \
        case "$vector_output" in \
          OPENAI_VECTOR_STORE_ID=*) \
            OPENAI_VECTOR_STORE_ID="${vector_output#OPENAI_VECTOR_STORE_ID=}"; \
            export OPENAI_VECTOR_STORE_ID; \
            printf '%s\n' "$vector_output"; \
            ;; \
          *) \
            printf '%s\n' "$vector_output"; \
            echo "Could not read OPENAI_VECTOR_STORE_ID from KB sync output."; \
            exit 1; \
            ;; \
        esac; \
      fi; \
      just mssql-create-db loanslam; \
      npm run prisma:migrate:deploy -w backend; \
      api_base_url="${API_BASE_URL:-http://localhost:4010}"; \
      widget_origin="${WIDGET_ORIGIN:-http://localhost:5173}"; \
      printf 'Backend: %s\nWidget:  %s\n\n' "$api_base_url" "$widget_origin"; \
      cleanup() { \
        jobs -p | while read -r pid; do kill "$pid" 2>/dev/null || true; done; \
      }; \
      trap cleanup INT TERM EXIT; \
      npm run dev:backend & \
      VITE_API_BASE_URL="$api_base_url" npm run dev:widget & \
      wait

kb-sync:
    @npm --silent run kb:sync -w backend

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
