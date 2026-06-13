# Bring The Brief To Life Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first runnable Loanslam customer-support chat widget slice: Vue iframe widget, Express API, shared contracts, SQL Server audit persistence, and real OpenAI model/RAG providers from day one.

**Architecture:** Use the existing brief and architecture docs as the approved product spec. The backend owns every business and safety decision through `ChatService`: session lookup -> audit inbound -> vulnerability gate -> retrieval/grounding -> action classification -> answer/handoff/fallback -> audit outbound. The widget is intentionally thin and renders only backend-provided states, messages, and forms.

**Tech Stack:** npm workspaces, TypeScript ESM, Vue 3 + Vite, Express 5, Zod contracts, Prisma 7 + SQL Server, Vitest, OpenAI Responses API structured outputs, OpenAI vector stores for managed KB retrieval.

---

## Source Requirements

- `docs/product-brief.md:30-40`: MVP starts anonymous conversations, holds context, answers grounded general questions, routes unsafe/account-specific requests, persists full audit trail, and deploys on AWS.
- `docs/product-brief.md:126-147`: widget creates sessions, sends structured requests, includes credentials/CSRF, renders backend decisions only, and stores no PII/transcripts locally.
- `docs/product-brief.md:149-165`: backend owns sessions, validation, CSRF, vulnerability-first routing, grounded retrieval, handoff intake, ticket adapter, transcripts, and audit events.
- `docs/product-brief.md:335-350`: non-negotiable release rules, especially no raw session IDs in browser JS, no ungrounded answers, fail-closed vulnerability, and no missing audit entries.
- `docs/architecture.md:7-19`: TypeScript npm workspace with Vue widget, Express API, contracts, Prisma SQL Server, OpenAI/RAG adapters, Vitest, Vite build, ESLint, and Prettier.
- User clarification on 2026-06-13: full model/RAG providers from day one; webhook contract is not known yet.

## File Structure

Root tooling:

- `package.json`: npm workspace scripts and shared dev dependencies.
- `package-lock.json`: locked dependency graph.
- `tsconfig.base.json`: shared strict TypeScript settings.
- `.prettierrc.json`, `eslint.config.js`: style gates.
- `vitest.workspace.ts`: workspace test discovery.
- `.env.example`: add app, OpenAI, session, CORS, and webhook placeholder settings without secrets.
- `Justfile`: add app/operator recipes while preserving MSSQL recipes.

Contracts package:

- `contracts/package.json`, `contracts/tsconfig.json`, `contracts/src/index.ts`
- `contracts/src/service-response.ts`: uniform envelope.
- `contracts/src/chat.ts`: API schemas, conversation states, UI message/form schemas.
- `contracts/src/provider.ts`: provider result schemas shared by backend tests.
- `contracts/src/index.test.ts`: schema smoke tests.

Backend package:

- `backend/package.json`, `backend/tsconfig.json`, `backend/vitest.config.ts`
- `backend/prisma/schema.prisma`, `backend/prisma/migrations/000001_init/migration.sql`, `backend/prisma.config.ts`
- `backend/src/server.ts`: process entrypoint only.
- `backend/src/app.ts`: Express composition.
- `backend/src/config/env.ts`, `backend/src/config/logger.ts`, `backend/src/config/openai.ts`, `backend/src/config/prisma.ts`
- `backend/src/middleware/request-context.ts`, `backend/src/middleware/session.ts`, `backend/src/middleware/csrf.ts`, `backend/src/middleware/errors.ts`
- `backend/src/features/chat/chat.routes.ts`, `chat.controller.ts`, `chat.service.ts`, `chat.repository.ts`, `chat.models.ts`
- `backend/src/features/chat/providers/model-provider.ts`, `openai-model-provider.ts`, `rag-provider.ts`, `openai-rag-provider.ts`, `ticket-provider.ts`, `null-ticket-provider.ts`
- `backend/src/features/chat/providers/kb-sync.ts`: OpenAI vector store sync from `data/public-info/loanslam-synthetic-kb.json`.
- `backend/src/features/chat/__tests__/*.test.ts`: service and route behaviour.

Widget package:

- `widget/package.json`, `widget/tsconfig.json`, `widget/vite.config.ts`, `widget/index.html`
- `widget/src/main.ts`, `widget/src/App.vue`
- `widget/src/api/chat-client.ts`: credentialed API client with CSRF header.
- `widget/src/components/ChatWidget.vue`, `MessageList.vue`, `IntakeForm.vue`
- `widget/src/styles.css`
- `widget/src/*.test.ts`: UI and transport tests.

## Provider Design

- Default model provider: OpenAI SDK using `OPENAI_API_KEY`, `OPENAI_MODEL`, and Responses API structured outputs.
- Default RAG provider: OpenAI vector store search using `OPENAI_VECTOR_STORE_ID`; `npm run kb:sync -w backend` creates or updates the vector store from the synthetic KB and prints the ID to put in env.
- Local/test mode may use fake provider instances only inside tests. Runtime app paths should fail closed if provider config is absent unless `ALLOW_FAKE_PROVIDERS=true` is explicitly set for local smoke work.
- Ticket provider: `NullTicketProvider` records an auditable pending handoff and returns a local reference. When `TICKET_WEBHOOK_URL` is set, `HttpTicketProvider` posts a conservative envelope with correlation, state, intake, and transcript summary. The exact external payload remains adapter-owned until the contract is known.

## Task 1: Root Workspace And Quality Gates

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.prettierrc.json`
- Create: `eslint.config.js`
- Create: `vitest.workspace.ts`
- Modify: `.env.example`
- Modify: `Justfile`

- [ ] **Step 1: Write the root workspace files**

Create root `package.json`:

```json
{
  "name": "loanslam",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=24 <26"
  },
  "workspaces": ["contracts", "backend", "widget"],
  "scripts": {
    "build": "npm run build --workspaces",
    "dev": "npm run dev -w backend",
    "dev:backend": "npm run dev -w backend",
    "dev:widget": "npm run dev -w widget",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "typecheck": "npm run typecheck --workspaces",
    "verify": "npm run format:check && npm run lint && npm run typecheck && npm test && npm run build"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.0",
    "@types/node": "^25.0.0",
    "eslint": "^9.39.0",
    "prettier": "^3.7.0",
    "typescript": "^5.9.0",
    "typescript-eslint": "^8.49.0",
    "vitest": "^4.1.8"
  }
}
```

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "sourceMap": true,
    "declaration": true
  }
}
```

Create `.prettierrc.json`:

```json
{
  "printWidth": 100,
  "singleQuote": true,
  "trailingComma": "all"
}
```

Create `eslint.config.js`:

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', 'backend/generated/**'],
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
);
```

Create `vitest.workspace.ts`:

```ts
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace(['contracts', 'backend', 'widget']);
```

- [ ] **Step 2: Extend environment and Just recipes**

Add non-secret app/provider keys to `.env.example`:

```dotenv
NODE_ENV=development
PORT=4010
WIDGET_ORIGIN=http://localhost:5173
API_BASE_URL=http://localhost:4010
SESSION_COOKIE_NAME=loanslam_sid
SESSION_SECRET=local-dev-session-secret-change-me
CSRF_COOKIE_NAME=loanslam_csrf
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
OPENAI_VECTOR_STORE_ID=
OPENAI_VECTOR_STORE_NAME=loanslam-support-kb
OPENAI_RAG_SCORE_THRESHOLD=0.45
TICKET_WEBHOOK_URL=
TICKET_WEBHOOK_SECRET=
ALLOW_FAKE_PROVIDERS=false
```

Add Just recipes:

```make
install:
    npm install

verify:
    npm run verify

dev:
    npm run dev:backend

dev-widget:
    npm run dev:widget

kb-sync:
    npm run kb:sync -w backend
```

- [ ] **Step 3: Install dependencies and verify root gates parse**

Run:

```bash
npm install
npm run format:check
```

Expected:

```text
Checking formatting...
All matched files use Prettier code style!
```

Commit:

```bash
git add package.json package-lock.json tsconfig.base.json .prettierrc.json eslint.config.js vitest.workspace.ts .env.example Justfile
git commit -m "chore: scaffold workspace tooling"
```

## Task 2: Shared Contracts

**Files:**
- Create: `contracts/package.json`
- Create: `contracts/tsconfig.json`
- Create: `contracts/src/service-response.ts`
- Create: `contracts/src/chat.ts`
- Create: `contracts/src/provider.ts`
- Create: `contracts/src/index.ts`
- Create: `contracts/src/index.test.ts`

- [ ] **Step 1: Create package and TS config**

`contracts/package.json`:

```json
{
  "name": "@loanslam/contracts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^4.1.13"
  }
}
```

`contracts/tsconfig.json`:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 2: Add schemas**

Create schemas for:

- `ServiceResponse<T>` envelope: `{ success, message, responseObject, statusCode }`
- `conversationState`: `active`, `collecting`, `awaiting_handoff_intake`, `handoff_pending`, `safe_fallback`
- `ChatMessage`: `{ id, role: user|assistant, text, createdAt }`
- `ChatResponse`: `{ conversationRef, requestRef, csrfToken, state, messages, form?, audit }`
- `CreateSessionResponse`, `SendMessageRequest`, `IntakeSubmitRequest`, `ResetRequest`
- Provider schemas: vulnerability result, classifier action, grounding citation, retrieval result, ticket result.

Use Zod and export inferred types. The frontend and backend must import from this package rather than duplicating wire types.

- [ ] **Step 3: Add contract tests**

Tests must cover:

- invalid message payloads fail validation
- handoff forms require only allowed fields
- response state discriminates the presence of `form`
- `ServiceResponse` preserves status code and response object

Run:

```bash
npm test -w contracts
npm run typecheck -w contracts
```

Commit:

```bash
git add contracts
git commit -m "feat(contracts): define chat API schemas"
```

## Task 3: Backend Persistence, Sessions, And Audit

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/vitest.config.ts`
- Create: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/000001_init/migration.sql`
- Create: `backend/prisma.config.ts`
- Create: `backend/src/config/env.ts`
- Create: `backend/src/config/logger.ts`
- Create: `backend/src/config/prisma.ts`
- Create: `backend/src/features/chat/chat.models.ts`
- Create: `backend/src/features/chat/chat.repository.ts`
- Create: `backend/src/features/chat/__tests__/chat.repository.test.ts`

- [ ] **Step 1: Create backend package**

Use dependencies:

```json
{
  "name": "@loanslam/backend",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsx watch src/server.ts",
    "start": "node dist/server.js",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "prisma:generate": "prisma generate --schema prisma/schema.prisma",
    "prisma:migrate": "prisma migrate dev --schema prisma/schema.prisma",
    "kb:sync": "tsx src/features/chat/providers/kb-sync.ts"
  },
  "dependencies": {
    "@loanslam/contracts": "0.0.0",
    "@prisma/adapter-mssql": "^7.8.0",
    "@prisma/client": "^7.8.0",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "dotenv": "^17.2.3",
    "express": "^5.2.1",
    "helmet": "^8.1.0",
    "mssql": "^12.1.1",
    "openai": "^6.42.0",
    "pino": "^10.1.0",
    "pino-http": "^11.0.0",
    "zod": "^4.1.13"
  },
  "devDependencies": {
    "@types/cookie-parser": "^1.4.10",
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.6",
    "prisma": "^7.8.0",
    "tsx": "^4.21.0"
  }
}
```

- [ ] **Step 2: Define Prisma schema and migration**

Models:

- `ChatSession`: `id`, `conversationRef`, `csrfTokenHash`, `state`, `structuredState Json`, timestamps.
- `TranscriptEntry`: `sessionId`, `requestRef`, `direction`, `role`, `content`, `metadata Json`, timestamp.
- `AuditEvent`: `sessionId`, `requestRef`, `eventType`, `reasonCode`, `payload Json`, timestamp.
- `ClientMessage`: `sessionId`, `clientMessageId`, `requestRef`, unique `(sessionId, clientMessageId)`.
- `TicketHandoff`: `sessionId`, `requestRef`, `provider`, `providerReference`, `status`, `payload Json`, timestamp.

Keep SQL Server provider in `schema.prisma` and put the URL in `prisma.config.ts`, matching Prisma 7 SQL Server guidance.

- [ ] **Step 3: Implement repository**

Repository methods:

- `createSession({ csrfTokenHash })`
- `getSessionById(sessionId)`
- `rotateCsrf(sessionId, csrfTokenHash)`
- `appendTranscript(entry)`
- `appendAudit(event)`
- `recordClientMessage(sessionId, clientMessageId, requestRef)`
- `updateSessionState(sessionId, state, structuredState)`
- `recordTicketHandoff(ticket)`

Tests should use an in-memory fake repository class for service tests and reserve Prisma integration for a later Docker-backed gate. This keeps the first scaffold verifiable without mutating Docker.

Run:

```bash
npm run typecheck -w backend
npm test -w backend
```

Commit:

```bash
git add backend
git commit -m "feat(backend): add chat persistence layer"
```

## Task 4: Backend HTTP API And Chat Service

**Files:**
- Create: `backend/src/app.ts`
- Create: `backend/src/server.ts`
- Create: `backend/src/middleware/request-context.ts`
- Create: `backend/src/middleware/session.ts`
- Create: `backend/src/middleware/csrf.ts`
- Create: `backend/src/middleware/errors.ts`
- Create: `backend/src/features/chat/chat.routes.ts`
- Create: `backend/src/features/chat/chat.controller.ts`
- Create: `backend/src/features/chat/chat.service.ts`
- Create: `backend/src/features/chat/providers/model-provider.ts`
- Create: `backend/src/features/chat/providers/openai-model-provider.ts`
- Create: `backend/src/features/chat/providers/rag-provider.ts`
- Create: `backend/src/features/chat/providers/openai-rag-provider.ts`
- Create: `backend/src/features/chat/providers/ticket-provider.ts`
- Create: `backend/src/features/chat/providers/null-ticket-provider.ts`
- Create: `backend/src/features/chat/providers/http-ticket-provider.ts`
- Create: `backend/src/features/chat/__tests__/chat.service.test.ts`
- Create: `backend/src/features/chat/__tests__/chat.routes.test.ts`

- [ ] **Step 1: Implement API endpoints**

Routes:

- `GET /health`
- `POST /chat/session`
- `POST /chat/message`
- `POST /chat/intake`
- `POST /chat/reset`

Cookie rules:

- session cookie is `HttpOnly`, `Secure` outside local development, `SameSite=None`, and `Partitioned` when supported by Express cookie serialization.
- CSRF token is returned in response body and readable cookie; unsafe calls require `x-csrf-token`.
- raw session ID is never returned to browser JS.

- [ ] **Step 2: Implement service pipeline**

`sendMessage` flow:

1. Validate request and session.
2. Record client message idempotency.
3. Append inbound transcript and audit event before provider calls.
4. Call vulnerability provider. If it errors, emit `vulnerability_provider_failed` and route to `awaiting_handoff_intake`.
5. If vulnerability is detected or uncertain, do not classify normally; return approved escalation copy and handoff form.
6. Search RAG provider and require citations/scores above threshold for answer mode.
7. Call classifier with conversation state, retrieval evidence, and allowed actions.
8. If answerable, generate grounded response using citations only.
9. If account-specific/change/excluded/unsupported, return handoff or fallback state.
10. Append outbound transcript and routing audit.

`submitIntake` flow:

1. Validate form fields.
2. Append inbound intake audit.
3. Call ticket provider.
4. Return handoff confirmation with local or external reference.
5. Append outbound transcript and ticket audit.

- [ ] **Step 3: Implement OpenAI providers**

Use the official OpenAI SDK. Model calls use `responses.parse` with Zod structured outputs for vulnerability and classification. RAG calls use vector store search with `OPENAI_VECTOR_STORE_ID`, `OPENAI_RAG_SCORE_THRESHOLD`, and returned citations. Runtime config missing for model/RAG fails closed unless explicitly in fake-provider local mode.

- [ ] **Step 4: Add tests**

Service tests must prove:

- inbound and outbound messages are audited
- vulnerability provider errors route to handoff
- vulnerability detection bypasses normal classifier
- ungrounded retrieval routes to handoff/fallback
- account-specific actions return intake form
- answer action includes grounding citations
- duplicate `clientMessageId` returns the original request reference rather than double-writing

Route tests must prove:

- session creation sets cookies and returns conversation reference, not session ID
- message calls require CSRF
- invalid payloads return safe envelope

Run:

```bash
npm test -w backend
npm run typecheck -w backend
```

Commit:

```bash
git add backend
git commit -m "feat(backend): implement chat API pipeline"
```

## Task 5: Knowledge Base Sync

**Files:**
- Create: `backend/src/features/chat/providers/kb-sync.ts`
- Create: `backend/src/features/chat/providers/kb-sync.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Implement KB sync command**

`kb-sync.ts` must:

- read `data/public-info/loanslam-synthetic-kb.json`
- create a markdown or JSONL upload where each item includes `id`, `serving_mode`, `question`, variants, answer text when present, links, and route reason
- create or update an OpenAI vector store named by `OPENAI_VECTOR_STORE_NAME`
- upload the KB file and attach it to the vector store
- print `OPENAI_VECTOR_STORE_ID=<id>` only, with no secrets

- [ ] **Step 2: Document provider setup**

README provider section:

```bash
npm install
cp .env.example .env
just kb-sync
# paste the printed OPENAI_VECTOR_STORE_ID into .env
just verify
```

State clearly that the webhook contract is pending; local handoff references are audit records until the contract is supplied.

Run:

```bash
npm test -w backend -- kb-sync
npm run kb:sync -w backend
```

Commit:

```bash
git add backend README.md
git commit -m "feat(backend): sync support kb to OpenAI retrieval"
```

## Task 6: Vue Widget

**Files:**
- Create: `widget/package.json`
- Create: `widget/tsconfig.json`
- Create: `widget/vite.config.ts`
- Create: `widget/index.html`
- Create: `widget/src/main.ts`
- Create: `widget/src/App.vue`
- Create: `widget/src/api/chat-client.ts`
- Create: `widget/src/components/ChatWidget.vue`
- Create: `widget/src/components/MessageList.vue`
- Create: `widget/src/components/IntakeForm.vue`
- Create: `widget/src/styles.css`
- Create: `widget/src/chat-client.test.ts`
- Create: `widget/src/ChatWidget.test.ts`

- [ ] **Step 1: Scaffold widget package**

Dependencies:

```json
{
  "dependencies": {
    "@loanslam/contracts": "0.0.0",
    "@vitejs/plugin-vue": "^6.0.2",
    "vue": "^3.5.38",
    "zod": "^4.1.13"
  },
  "devDependencies": {
    "@vue/test-utils": "^2.4.6",
    "jsdom": "^27.3.0",
    "vite": "^8.0.16",
    "vue-tsc": "^3.1.8"
  }
}
```

- [ ] **Step 2: Implement thin client**

`chat-client.ts` must:

- call `/chat/session` on mount with `credentials: 'include'`
- store only `csrfToken` and non-secret `conversationRef` in memory
- send `x-csrf-token` for message, intake, and reset
- validate responses with contracts
- never write transcript, PII, or session ID to browser storage

- [ ] **Step 3: Implement UI**

The widget should:

- open as a compact fixed chat panel with Loanslam branding
- show assistant greeting after session creation
- render messages, grounded answer citations, safe fallback, and handoff form
- clear intake values after submit/reset
- expose `postMessage` events: `loanslam:ready`, `loanslam:resize`, `loanslam:close`
- avoid frontend business rules; map backend `state` to presentation only

- [ ] **Step 4: Add tests**

Tests must prove:

- session is created on mount
- messages send with CSRF and credentials
- intake form clears after successful submit
- no localStorage/sessionStorage writes occur
- backend-provided form config controls visible fields

Run:

```bash
npm test -w widget
npm run typecheck -w widget
npm run build -w widget
```

Commit:

```bash
git add widget
git commit -m "feat(widget): add support chat iframe UI"
```

## Task 7: End-To-End Operator Slice

**Files:**
- Modify: `Justfile`
- Modify: `README.md`
- Create: `backend/src/features/chat/__tests__/chat.integration.test.ts`

- [ ] **Step 1: Add operator recipes**

Recipes:

```make
dev-all:
    npm run dev:backend & npm run dev:widget

api-health:
    curl -fsS http://localhost:4010/health

smoke-chat:
    npm run smoke:chat -w backend
```

- [ ] **Step 2: Add smoke script**

The smoke script should:

- create a session
- send a general KB-backed message
- send an account-specific message
- prove the first includes grounding citations
- prove the second returns an intake form
- print conversation/request references only

- [ ] **Step 3: Run full verification**

Run:

```bash
npm run verify
docker compose -f docker-compose.mssql.yml config --quiet
jq empty data/public-info/*.json
jq -e '.item_count == (.items | length)' data/public-info/loan-slam-faq.json data/public-info/loanslam-synthetic-kb.json
jq -e 'all(.items[]; (.serving_mode == "answer") == (.answer_text != null))' data/public-info/loanslam-synthetic-kb.json
```

Commit:

```bash
git add Justfile README.md backend
git commit -m "feat(dev): add chat smoke workflow"
```

## Self-Review

- Spec coverage: covers anonymous sessions, stateful backend-owned flow, thin frontend, CSRF/session protection, grounded answer path, vulnerability fail-closed routing, account-specific handoff, audit persistence, provider adapters, and verification gates.
- Known gap: real external ticket webhook payload cannot be finalized because the contract is not known. The implementation keeps the adapter boundary real and auditable with `NullTicketProvider` plus `HttpTicketProvider` placeholder envelope.
- Placeholder scan: no `TBD`/`TODO` requirements are left as product behaviour. The unknown webhook contract is explicitly isolated.
- Type consistency: all API names use the `chat/session`, `chat/message`, `chat/intake`, and `chat/reset` shape from the brief.
