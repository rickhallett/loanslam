#!/usr/bin/env node
// Integrated POC integration battery (ipoc-arc-003).
//
// Drives the REAL ipoc HTTP surface end-to-end: session, demo lookup,
// account answers, engine boundary, ticket workflow. The engine turn is a
// live OpenAI-backed call through the standard planner config; there is no
// mocked path in this battery.
//
// Usage: with the ipoc dev server running (see proof receipts):
//   node scripts/ipoc-integration-battery.mjs [--base http://127.0.0.1:3631]
//
// Writes artifacts/integrated-poc/ipoc-integration-battery-<stamp>.json and
// exits non-zero on any failed case.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const baseFlagIndex = process.argv.indexOf("--base");
const base =
  baseFlagIndex === -1
    ? "http://127.0.0.1:3631"
    : process.argv[baseFlagIndex + 1];

// Values that exist only inside the server-side mock store. If any of them
// shows up in a response body outside the sanctioned demo-answer strings,
// the store boundary leaked.
const mockOnlyValues = ["£1,240.50", "2026-07-28", "1985-06-15", "£310.00"];

const matchingLookupFields = {
  fullName: "Demo Applicant",
  dateOfBirth: "1990-01-01",
  address: "1 Demo Street, Demotown, AB12 3CD",
  loanReference: "LS-10001",
};

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
    // leave json null for non-JSON error bodies
  }
  return { status: response.status, text, json };
}

async function createSession() {
  const { status, json } = await api("/api/ipoc/sessions", { method: "POST" });
  if (status !== 200 || !json?.conversationRef) {
    throw new Error(`session create failed with status ${status}`);
  }
  return json.conversationRef;
}

// Case 1: session creation.
const ref = await createSession();
record("session-create", Boolean(ref), `conversationRef ${ref}`);

// Case 2: matched lookup returns only the display-safe pair.
{
  const { status, json, text } = await api(`/api/ipoc/sessions/${ref}/lookup`, {
    method: "POST",
    body: JSON.stringify({ fields: matchingLookupFields }),
  });
  const leaked = mockOnlyValues.filter((value) => text.includes(value));
  record(
    "lookup-match",
    status === 200 &&
      json?.matched === true &&
      json?.customer?.loanReference === "LS-10001" &&
      leaked.length === 0,
    leaked.length > 0
      ? `mock-only values leaked: ${leaked.join(", ")}`
      : `matched with display-safe pair only`,
  );
}

// Case 3: no-match discloses nothing.
{
  const ref2 = await createSession();
  const { status, json, text } = await api(
    `/api/ipoc/sessions/${ref2}/lookup`,
    {
      method: "POST",
      body: JSON.stringify({
        fields: { ...matchingLookupFields, dateOfBirth: "1991-02-02" },
      }),
    },
  );
  const leaked = mockOnlyValues.filter((value) => text.includes(value));
  record(
    "lookup-no-match",
    status === 200 &&
      json?.matched === false &&
      json?.customer === null &&
      leaked.length === 0,
    leaked.length > 0
      ? `mock-only values leaked: ${leaked.join(", ")}`
      : "no match, no data disclosed",
  );

  // Case 4: answers are gated for unmatched sessions.
  const gated = await api(`/api/ipoc/sessions/${ref2}/account-answers`, {
    method: "POST",
    body: JSON.stringify({ question: "nextPaymentDate" }),
  });
  record(
    "answers-gated-unmatched",
    gated.status === 403,
    `status ${gated.status}`,
  );
}

// Case 5: missing lookup field rejected.
{
  const { status } = await api(`/api/ipoc/sessions/${ref}/lookup`, {
    method: "POST",
    body: JSON.stringify({
      fields: { fullName: "Demo Applicant", dateOfBirth: "1990-01-01" },
    }),
  });
  record("lookup-validation", status === 400, `status ${status}`);
}

// Case 6: matched answers render the sanctioned strings.
{
  const expected = {
    nextPaymentDate: "Your next demo payment for LS-10001 is due on 2026-07-28.",
    outstandingBalance:
      "Your demo outstanding balance for LS-10001 is £1,240.50.",
    loanStatus: "Your demo loan LS-10001 is currently active.",
  };
  for (const [question, answer] of Object.entries(expected)) {
    const { status, json } = await api(
      `/api/ipoc/sessions/${ref}/account-answers`,
      { method: "POST", body: JSON.stringify({ question }) },
    );
    record(
      `answer-${question}`,
      status === 200 && json?.answer === answer,
      status === 200 ? json?.answer : `status ${status}`,
    );
  }

  const bad = await api(`/api/ipoc/sessions/${ref}/account-answers`, {
    method: "POST",
    body: JSON.stringify({ question: "sortCode" }),
  });
  record("answer-invalid-question", bad.status === 400, `status ${bad.status}`);
}

// Case 7 (LIVE ENGINE): a matched session asking the engine an
// account-specific question must get the safe handoff path, never the mock
// record's values. The engine cannot see the mock store; this proves it.
{
  const { status, json } = await api(`/api/ipoc/sessions/${ref}/messages`, {
    method: "POST",
    body: JSON.stringify({ message: "What is my outstanding balance?" }),
  });
  // The transcript legitimately echoes earlier sanctioned demo answers, so
  // the leak check targets the engine's own utterance and ticket preview.
  const engineText = `${json?.assistant?.message ?? ""} ${json?.ticket?.assistantPreview ?? ""}`;
  const leaked = mockOnlyValues.filter((value) => engineText.includes(value));
  const finalAction = json?.assistant?.finalAction;
  const handoffShaped = [
    "request_handoff_intake",
    "create_ticket",
    "escalate",
  ].includes(finalAction);
  record(
    "engine-boundary-matched-session",
    status === 200 && leaked.length === 0 && handoffShaped,
    leaked.length > 0
      ? `mock-only values leaked into engine turn: ${leaked.join(", ")}`
      : `finalAction ${finalAction}, no mock values in engine response`,
  );

  // Case 8: ticket workflow over the ticket created by the engine turn.
  const ticketId = json?.ticket?.id;
  record("engine-turn-ticket", Boolean(ticketId), `ticket ${ticketId}`);

  if (ticketId) {
    const review = await api(`/api/ipoc/admin/tickets/${ticketId}/status`, {
      method: "POST",
      body: JSON.stringify({ status: "in_review" }),
    });
    record(
      "ticket-status-in-review",
      review.status === 200 && review.json?.ticket?.status === "in_review",
      `status ${review.status}`,
    );

    const invalid = await api(`/api/ipoc/admin/tickets/${ticketId}/status`, {
      method: "POST",
      body: JSON.stringify({ status: "in_review" }),
    });
    record(
      "ticket-invalid-transition",
      invalid.status === 409,
      `status ${invalid.status}`,
    );

    const note = await api(`/api/ipoc/admin/tickets/${ticketId}/notes`, {
      method: "POST",
      body: JSON.stringify({ note: "Battery: reviewed demo activity." }),
    });
    record(
      "ticket-note",
      note.status === 200 && note.json?.ticket?.agentNotes?.length === 1,
      `status ${note.status}`,
    );

    const resolved = await api(`/api/ipoc/admin/tickets/${ticketId}/status`, {
      method: "POST",
      body: JSON.stringify({ status: "resolved" }),
    });
    record(
      "ticket-status-resolved",
      resolved.status === 200 && resolved.json?.ticket?.status === "resolved",
      `status ${resolved.status}`,
    );

    const activity = resolved.json?.ticket?.activity ?? [];
    const kinds = activity.map((event) => event.kind);
    record(
      "ticket-activity-readback",
      kinds.includes("lookup_matched") && kinds.includes("account_answer"),
      `activity kinds: ${kinds.join(", ") || "none"}`,
    );
  }
}

const failed = results.filter((result) => !result.pass);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportPath = resolve(
  process.cwd(),
  `artifacts/integrated-poc/ipoc-integration-battery-${stamp}.json`,
);
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(
  reportPath,
  `${JSON.stringify({ base, ranAt: new Date().toISOString(), results }, null, 2)}\n`,
);

console.log(
  `\n${results.length - failed.length}/${results.length} cases passed. Report: ${reportPath}`,
);

if (failed.length > 0) {
  process.exitCode = 1;
}
