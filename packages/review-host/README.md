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
  `hostBridge`, and proxied `/sessions` routes. The old `chat.api.ts` /
  `@mal-ai-chat/contracts` transport is dropped entirely.

## Run it (three processes)

From the worktree root, install once so the new workspaces link:

```bash
npm install
```

Then start the engine, the widget, and the host page:

```bash
npm run core:serve -- --port 8788   # engine lab server on http://127.0.0.1:8788
npm run review-widget:dev           # widget on http://127.0.0.1:5175 (proxies /sessions -> 8788)
npm run review-host:dev             # host page on http://127.0.0.1:5181
```

Or all three at once: `just review`.

Open **http://127.0.0.1:5181** and use the launcher in the bottom-right corner.
Append `?demo=true` to the host URL for manual context-reveal buttons.

## How the pieces talk

```
host page (5181) ──iframe──> widget (5175) ──/sessions proxy──> engine (8788)
        ^                          │
        └──── postMessage ─────────┘   (ready / open / close / session-context)
```

- The widget calls `POST /sessions`, `POST /sessions/:ref/messages`, and
  `POST /sessions/:ref/reset`. The engine owns OpenAI, retrieval, grounding, and
  policy; the widget never sees any of that.
- After each turn the widget posts a coarse `session-context`
  (`general` / `vulnerability` / `handoff`) derived from the engine's
  `safetyFlags` and `finalAction`. The page promotes the matching contact block.
  No message content crosses the boundary.
