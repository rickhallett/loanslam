# MAL review demo (host + widget)

This is the **original mock shown at the MAL review** — the "Loans by MAL"
contact page with the support assistant injected as a sandboxed iframe — ported
into loanslam and rewired so the chat is driven by the **loanslam engine**
instead of the old `mal-ai-chat` backend.

It exists to show MAL the same UI they already saw, running on the newer engine.
It is deliberately separate from `packages/demo-host` / `packages/demo-widget`
(the generic-branded demo kept for further development) and from
`packages/lab-ui` (the developer inspector).

Two packages, no changes to the engine core:

- **`packages/review-host`** — the MAL-branded contact page and the vanilla
  `loader.js` that injects the widget iframe and reacts to its signals. Ported
  verbatim from `mal-ai-chat/mock` apart from the widget URL.
- **`packages/review-widget`** — the MAL-styled Vue chat UI inside the iframe.
  Its transport is identical to `packages/demo-widget`: the same `engineClient`,
  `hostBridge`, and proxied `/demo` routes. The old `chat.api.ts` /
  `@mal-ai-chat/contracts` transport is dropped entirely.

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
npm run review-widget:dev                     # widget on http://127.0.0.1:5175 (proxies /demo -> 8788)
npm run review-host:dev             # host page on http://127.0.0.1:5181
```

Or all three at once: `just review`.

Open **http://127.0.0.1:5181** and use the launcher in the bottom-right corner.
Append `?demo=true` to the host URL for manual context-reveal buttons.

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
host page (5181) ──iframe──> widget (5175) ──/demo proxy──> demo API (8788)
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
  page promotes the matching contact block. No message content crosses the
  host/widget boundary.
