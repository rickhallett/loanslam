#!/usr/bin/env node
// dc-004 concierge route probe (demo-concierge-001, D045): concierge turns
// served live from the frontier model on the segregated route; kill switch
// disables the surface.
//
// Usage:
//   node scripts/dc004-concierge-probe.mjs [--base URL] [--expect-disabled]
//
// Run once against the normal server, once against a server started with
// CONCIERGE_KILL_SWITCH=1 (--expect-disabled).

const args = process.argv.slice(2);
const baseIndex = args.indexOf("--base");
const base = baseIndex === -1 ? "http://127.0.0.1:3641" : args[baseIndex + 1];
const expectDisabled = args.includes("--expect-disabled");

const results = [];
const check = (id, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${detail}`);
};

async function api(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    // non-JSON body
  }
  return { status: response.status, json };
}

const status = await api("/api/concierge/status");

if (expectDisabled) {
  check("status-disabled", status.status === 200 && status.json?.enabled === false,
    JSON.stringify(status.json));
  const session = await api("/api/concierge/sessions", { method: "POST" });
  check("sessions-503", session.status === 503, `status ${session.status}`);
} else {
  check("status-enabled", status.status === 200 && status.json?.enabled === true,
    JSON.stringify(status.json));

  const session = await api("/api/concierge/sessions", { method: "POST" });
  check("session-created", session.status === 200 && !!session.json?.conversationRef,
    session.json?.conversationRef ?? `status ${session.status}`);
  const ref = session.json.conversationRef;

  // Live model turn with form state: the reply must engage with the field.
  const turn = await api(`/api/concierge/sessions/${ref}/messages`, {
    method: "POST",
    body: JSON.stringify({
      message: "What should I put in the loan purpose field?",
      formState: { step: "about-your-loan", loanAmount: "2000", loanPurpose: "" },
    }),
  });
  const reply = turn.json?.assistant?.message ?? "";
  check("live-turn", turn.status === 200 && reply.length > 20, `${reply.length} chars`);
  check("reply-engages-form", /purpose|loan/i.test(reply), reply.slice(0, 120));

  // Second turn continues the same session (history retained server-side).
  const followup = await api(`/api/concierge/sessions/${ref}/messages`, {
    method: "POST",
    body: JSON.stringify({ message: "And what did I say my loan amount was?" }),
  });
  const followupReply = followup.json?.assistant?.message ?? "";
  check("session-continuity", followup.status === 200 && /2,?000/.test(followupReply),
    followupReply.slice(0, 120));

  // Validation and unknown-session behavior.
  const empty = await api(`/api/concierge/sessions/${ref}/messages`, {
    method: "POST",
    body: JSON.stringify({ message: "" }),
  });
  check("empty-message-400", empty.status === 400, `status ${empty.status}`);
  const unknown = await api(`/api/concierge/sessions/does-not-exist/messages`, {
    method: "POST",
    body: JSON.stringify({ message: "hello" }),
  });
  check("unknown-session-404", unknown.status === 404, `status ${unknown.status}`);

  console.log(`\nSample reply: ${reply}`);
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed (${expectDisabled ? "kill-switch" : "live"} mode).`);
if (passed !== results.length) process.exitCode = 1;
