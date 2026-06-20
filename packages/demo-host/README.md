# LoanSlam embedded demo (host + widget)

A customer-facing demo of the LoanSlam engine: a branded contact page with the
support assistant injected as a sandboxed iframe — the same embed shape a real
site would use. It is deliberately separate from `packages/lab-ui`, which is the
developer inspector. This demo shows only what a customer would see.

Two new packages, no changes to the engine core:

- **`packages/demo-host`** — the static, generic-branded page and the vanilla
  `loader.js` that injects the widget iframe and reacts to its signals.
- **`packages/demo-widget`** — the Vue chat UI inside the iframe. It is a plain
  HTTP client of the demo-safe API over the proxied `/demo` routes and renders
  whatever UI primitive the server-side display model returns (`message`,
  `choice_list`, `intake_form`, `handoff_confirmation`, `safe_fallback`).

## Run it (three processes)

From the worktree root, install once so the new workspaces link:

```bash
npm install
```

Then start the engine, the widget, and the host page. Demo logging now writes
to Postgres through Prisma, so set `DATABASE_URL` or
`DEMO_INTERACTION_DATABASE_URL` first; for throwaway local UI checks, add
`--no-demo-log` to the engine command.

```bash
npm run core:serve -- --port 8788 --demo-only  # demo API on http://127.0.0.1:8788
npm run demo-widget:dev                       # widget on http://127.0.0.1:5174 (proxies /demo -> 8788)
npm run demo-host:dev               # host page on http://127.0.0.1:5180
```

Or all three at once: `just demo`. For throwaway local UI checks without
Postgres owner logging, use `just demo-local`.

Open **http://127.0.0.1:5180** and use the launcher in the bottom-right corner.

Stakeholder demo interactions are logged server-side by default when the engine
runs in `--demo-only` mode:

```bash
just demo-log-summary
just demo-log-session -- <conversationRef>
just demo-log-turn -- <conversationRef> <turn> --full
```

The demo log is an owner-only debugging record in Postgres; it is not exposed as
a browser/admin UI.

## How the pieces talk

```
host page (5180) ──iframe──> widget (5174) ──/demo proxy──> demo API (8788)
        ^                          │
        └──── postMessage ─────────┘   (ready / open / close / session-context)
```

- The widget calls `POST /demo/sessions`,
  `POST /demo/sessions/:ref/messages`, and
  `POST /demo/sessions/:ref/reset`. The browser receives customer-facing UI,
  host context, content-free telemetry, and an opaque continuation token. It does
  not receive full state, traces, planner proposals, or retrieval internals.
- After each turn the widget posts a coarse `session-context`
  (`general` / `vulnerability` / `handoff`) supplied by the demo response. The
  host page highlights the matching contact card. No message content crosses the
  host/widget boundary.

## Deploying / pointing at a hosted engine

- The widget's demo API target is the Vite proxy; override it with
  `LAB_API_TARGET` when running `demo-widget`.
- The host page picks the widget URL from an inline config in `index.html`
  (`?widget=remote` switches to the deployed widget URL placeholder).
