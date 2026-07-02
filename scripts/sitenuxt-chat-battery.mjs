#!/usr/bin/env node
// Contact-chat integration battery (sitenuxt-arc-002, D042).
//
// Drives the REAL site-nuxt chat surface with the live engine: session,
// engine turn (account question -> safe handoff, never an invented account
// answer), intake validation and capture, cancel-handoff, and post-cancel
// recovery. No mocked paths.
//
// Usage: with the site-nuxt server running under secrets:
//   node scripts/sitenuxt-chat-battery.mjs [--base http://127.0.0.1:3641]

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const baseFlagIndex = process.argv.indexOf("--base");
const base = baseFlagIndex === -1 ? "http://127.0.0.1:3641" : process.argv[baseFlagIndex + 1];

const results = [];
function record(id, pass, detail) {
  results.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${detail}`);
}

async function api(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-JSON error body
  }
  return { status: response.status, json };
}

async function createSession() {
  const { status, json } = await api("/api/ipoc/sessions", { method: "POST" });
  if (status !== 200 || !json?.conversationRef) {
    throw new Error(`session create failed: ${status}`);
  }
  return json.conversationRef;
}

// Case 1: session create.
const ref = await createSession();
record("session-create", Boolean(ref), ref);

// Case 2 (LIVE ENGINE): account-specific question routes to safe handoff and
// never invents an account answer (this surface has no lookup/answers routes).
{
  const { status, json } = await api(`/api/ipoc/sessions/${ref}/messages`, {
    method: "POST",
    body: JSON.stringify({ message: "What is my outstanding balance?" }),
  });
  const finalAction = json?.assistant?.finalAction;
  const handoffShaped = ["request_handoff_intake", "create_ticket", "escalate"].includes(finalAction);
  record(
    "engine-account-question-handoff",
    status === 200 && handoffShaped && json?.assistant?.ui?.primitive === "intake_form",
    `finalAction ${finalAction}, ui ${json?.assistant?.ui?.primitive}`,
  );

  // Case 3: lookup/answers demo routes are NOT exposed on the site surface.
  const lookup = await api(`/api/ipoc/sessions/${ref}/lookup`, {
    method: "POST",
    body: JSON.stringify({ fields: {} }),
  });
  record("lookup-not-exposed", lookup.status === 404, `status ${lookup.status}`);

  // Case 4: cancel-handoff clears the pending handoff.
  const cancel = await api(`/api/ipoc/sessions/${ref}/cancel-handoff`, { method: "POST" });
  record("cancel-handoff", cancel.status === 200, `status ${cancel.status}`);

  // Case 5 (LIVE ENGINE): chat recovers to a grounded answer after cancel.
  const after = await api(`/api/ipoc/sessions/${ref}/messages`, {
    method: "POST",
    body: JSON.stringify({ message: "How do I apply for a loan?" }),
  });
  record(
    "post-cancel-grounded-answer",
    after.status === 200 && after.json?.assistant?.finalAction === "answer",
    `finalAction ${after.json?.assistant?.finalAction}`,
  );
}

// Case 6: intake validation and capture on a fresh handoff.
{
  const ref2 = await createSession();
  const turn = await api(`/api/ipoc/sessions/${ref2}/messages`, {
    method: "POST",
    body: JSON.stringify({
      message: "I need help with my loan application and would like someone to contact me.",
    }),
  });
  const ticketId = turn.json?.ticket?.id;
  record("handoff-ticket", Boolean(ticketId), `ticket ${ticketId}`);

  const invalid = await api(`/api/ipoc/sessions/${ref2}/intake`, {
    method: "POST",
    body: JSON.stringify({ ticketId, fields: { fullName: "Demo Applicant" } }),
  });
  record("intake-validation", invalid.status === 400, `status ${invalid.status}`);

  const ok = await api(`/api/ipoc/sessions/${ref2}/intake`, {
    method: "POST",
    body: JSON.stringify({
      ticketId,
      fields: {
        fullName: "Demo Applicant",
        dateOfBirth: "1990-01-01",
        postcode: "AB12 3CD",
        email: "demo.applicant@example.invalid",
        phone: "07000000000",
      },
    }),
  });
  record(
    "intake-capture",
    ok.status === 200 && ok.json?.ticket?.status === "intake_captured",
    `ticket status ${ok.json?.ticket?.status}`,
  );

  // Case 7: cancel on an unknown session 404s.
  const missing = await api(`/api/ipoc/sessions/not-a-session/cancel-handoff`, { method: "POST" });
  record("cancel-unknown-session", missing.status === 404, `status ${missing.status}`);
}

const failed = results.filter((result) => !result.pass);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportPath = resolve(
  process.cwd(),
  `artifacts/site-nuxt/sitenuxt-chat-battery-${stamp}.json`,
);
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(
  reportPath,
  `${JSON.stringify({ base, ranAt: new Date().toISOString(), results }, null, 2)}\n`,
);
console.log(`\n${results.length - failed.length}/${results.length} cases passed. Report: ${reportPath}`);
if (failed.length > 0) process.exitCode = 1;
