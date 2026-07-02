#!/usr/bin/env node
// dc-007 exposure proof (demo-concierge-001, D045): per-IP rate limits on
// the concierge routes, provable without model cost (empty messages 400
// before any model call but still count toward the window; session creation
// never calls the model).
//
// Usage: node scripts/dc007-exposure-proof.mjs [--base URL]

const args = process.argv.slice(2);
const baseIndex = args.indexOf("--base");
const base = baseIndex === -1 ? "http://127.0.0.1:3641" : args[baseIndex + 1];

const results = [];
const check = (id, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${detail}`);
};

async function post(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return response.status;
}

// Session limit: 10 per 5-minute window per IP.
const sessionStatuses = [];
for (let i = 0; i < 12; i += 1) sessionStatuses.push(await post("/api/concierge/sessions"));
check(
  "sessions-rate-limited",
  sessionStatuses.slice(0, 10).every((s) => s === 200) && sessionStatuses.at(-1) === 429,
  `statuses: ${sessionStatuses.join(",")}`,
);

// Message limit: 30 per window; empty messages cost validation 400s, not
// model calls, and still consume the window.
const sessionResponse = await fetch(`${base}/api/concierge/sessions`, { method: "POST" });
// (This create may itself be 429 from the hammering above; fall back to a
// bogus ref — the limiter fires before session lookup.)
const ref =
  sessionResponse.status === 200
    ? (await sessionResponse.json()).conversationRef
    : "rate-limit-probe";
const messageStatuses = [];
for (let i = 0; i < 32; i += 1) {
  messageStatuses.push(await post(`/api/concierge/sessions/${ref}/messages`, { message: "" }));
}
check(
  "messages-rate-limited",
  messageStatuses.at(-1) === 429 && messageStatuses[0] !== 429,
  `first: ${messageStatuses[0]}, last: ${messageStatuses.at(-1)}`,
);
check(
  "no-model-cost",
  messageStatuses.every((s) => s === 400 || s === 404 || s === 429),
  "hammer produced only validation/limit statuses",
);

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed against ${base}`);
if (passed !== results.length) process.exitCode = 1;
