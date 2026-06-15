# LoanSlam embedded demo (host + widget)

A customer-facing demo of the LoanSlam engine: a branded contact page with the
support assistant injected as a sandboxed iframe — the same embed shape a real
site would use. It is deliberately separate from `packages/lab-ui`, which is the
developer inspector. This demo shows only what a customer would see.

Two new packages, no changes to the engine core:

- **`packages/demo-host`** — the static, generic-branded page and the vanilla
  `loader.js` that injects the widget iframe and reacts to its signals.
- **`packages/demo-widget`** — the Vue chat UI inside the iframe. It is a plain
  HTTP client of the engine's lab server over the proxied `/sessions` routes and
  renders whatever UI primitive the engine returns (`message`, `choice_list`,
  `intake_form`, `handoff_confirmation`, `safe_fallback`).

## Run it (three processes)

From the worktree root, install once so the new workspaces link:

```bash
npm install
```

Then start the engine, the widget, and the host page:

```bash
npm run core:serve -- --port 8788   # engine lab server on http://127.0.0.1:8788
npm run demo-widget:dev             # widget on http://127.0.0.1:5174 (proxies /sessions -> 8788)
npm run demo-host:dev               # host page on http://127.0.0.1:5180
```

Open **http://127.0.0.1:5180** and use the launcher in the bottom-right corner.

## How the pieces talk

```
host page (5180) ──iframe──> widget (5174) ──/sessions proxy──> engine (8788)
        ^                          │
        └──── postMessage ─────────┘   (ready / open / close / session-context)
```

- The widget calls `POST /sessions`, `POST /sessions/:ref/messages`, and
  `POST /sessions/:ref/reset`. The engine owns OpenAI, retrieval, grounding, and
  policy; the widget never sees any of that.
- After each turn the widget posts a coarse `session-context`
  (`general` / `vulnerability` / `handoff`) derived from the engine's
  `safetyFlags` and `finalAction`. The host page highlights the matching contact
  card. No message content crosses the boundary.

## Deploying / pointing at a hosted engine

- The widget's engine target is the Vite proxy; override it with
  `LAB_API_TARGET` when running `demo-widget`.
- The host page picks the widget URL from an inline config in `index.html`
  (`?widget=remote` switches to the deployed widget URL placeholder).
