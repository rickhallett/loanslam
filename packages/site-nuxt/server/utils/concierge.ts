import { randomUUID } from "node:crypto";

import OpenAI from "openai";

import routeManifest from "../../route-manifest.json";

// Demo-concierge surface (D045): a segregated, demo-only route serving
// apply-journey assistance straight from a frontier OpenAI model. No
// validator, no grounding rule — guardrails are system-prompt-only by
// accepted decision. This module never touches the validated processTurn
// path; the support chat and its engine are a different surface entirely.
// Kill switch: CONCIERGE_KILL_SWITCH=1 disables the routes and the UI
// affordances (via /api/concierge/status).

export interface ConciergeMessage {
  role: "customer" | "assistant";
  content: string;
}

export interface ConciergeSession {
  conversationRef: string;
  createdAt: string;
  messages: ConciergeMessage[];
}

const sessions = new Map<string, ConciergeSession>();

// Bound the in-memory demo state and the per-call prompt size.
const MAX_HISTORY_MESSAGES = 20;

export function conciergeEnabled(): boolean {
  return process.env.CONCIERGE_KILL_SWITCH !== "1";
}

// Fixed-window per-IP rate limit (dc-007): exposure control for the public
// URL — protects the OpenAI budget, not the content (D045). Counted before
// body validation so hammering costs no model calls.
const RATE_WINDOW_MS = 5 * 60_000;
const RATE_LIMITS = { sessions: 10, messages: 30 } as const;
const rateBuckets = new Map<string, { windowStart: number; count: number }>();

export function conciergeRateLimitExceeded(
  kind: keyof typeof RATE_LIMITS,
  ip: string,
): boolean {
  const now = Date.now();
  if (rateBuckets.size > 1000) {
    for (const [key, bucket] of rateBuckets) {
      if (now - bucket.windowStart >= RATE_WINDOW_MS) rateBuckets.delete(key);
    }
  }
  const key = `${kind}:${ip}`;
  let bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.windowStart >= RATE_WINDOW_MS) {
    bucket = { windowStart: now, count: 0 };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMITS[kind];
}

export function conciergeModel(): string {
  return process.env.CONCIERGE_MODEL ?? "gpt-5.5";
}

export function createConciergeSession(): ConciergeSession {
  const session: ConciergeSession = {
    conversationRef: randomUUID(),
    createdAt: new Date().toISOString(),
    messages: [],
  };
  sessions.set(session.conversationRef, session);
  return session;
}

export function getConciergeSession(ref: string): ConciergeSession | undefined {
  return sessions.get(ref);
}

// House voice matched to the support chat the customer has already used;
// the no-promises instruction is the accepted D045 guardrail.
const CONCIERGE_INSTRUCTIONS = `You are the LoanSlam assistant, a guide across the LoanSlam website.
LoanSlam is a UK lender offering unsecured instalment loans. This is a
prototype site and every detail the customer enters is synthetic test data.

Voice: warm, plain UK English, concise. Two or three short sentences per
reply unless the question genuinely needs more. No emojis.

When the customer's current page is provided, ground your help in it:
explain what the page covers, answer questions about its content, and point
to what is in front of them. On the application form, use the provided form
state — answer about the exact step and fields, acknowledge what they have
already completed, and point to what comes next. Encourage steady progress
without pressure.

On the application form, when the customer has told you their details in
conversation, you may propose values through formFill — only fields the
customer actually gave you, never invented or guessed. Formats: dob is
DD/MM/YYYY; mobile is 11 digits starting 07; employmentStatus is exactly one
of "Employed - full time", "Employed - part time", "Self employed",
"On benefits", "Retired". When you propose a fill, say so in your reply.

Never promise or predict an application outcome, approval, eligibility
decision, rate, or timescale, and never present yourself as making lending
decisions. Anything account-specific (balances, payments, their loan)
belongs with the support team, not you. If the customer is struggling or
asks for a person, tell them you can connect them with the support team.`;

// dc3-001 (D046): the model may PROPOSE navigation; only allowlisted routes
// from the committed manifest survive, and nothing navigates without a
// user click in the widget.
const ALLOWED_ROUTES = new Set(
  (routeManifest.routes as Array<{ route: string; kind: string }>)
    .filter((entry) => entry.kind === "page")
    .map((entry) => entry.route),
);

// dc3-002 (D046): the model may PROPOSE values for the application form's
// details step — known field names only, applied client-side only after an
// explicit user click.
const FORM_FILL_FIELDS = [
  "monthlyIncome",
  "employmentStatus",
  "firstName",
  "lastName",
  "dob",
  "mobile",
  "email",
  "postcode",
  "line1",
  "city",
] as const;

export interface ConciergeTurnResult {
  reply: string;
  navigateTo: string | null;
  formFill: Record<string, string> | null;
}

const CONCIERGE_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "Your reply to the customer." },
    navigateTo: {
      type: ["string", "null"],
      description:
        "A route path from the available-routes list when taking the customer to a page would genuinely help; otherwise null.",
    },
    formFill: {
      type: ["object", "null"],
      description:
        "On the application form only: values the customer has actually told you, offered as a fill proposal. Never invent values. Null when you have nothing to propose.",
      properties: Object.fromEntries(
        FORM_FILL_FIELDS.map((field) => [field, { type: ["string", "null"] }]),
      ),
      required: [...FORM_FILL_FIELDS],
      additionalProperties: false,
    },
  },
  required: ["reply", "navigateTo", "formFill"],
  additionalProperties: false,
} as const;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured for the concierge.");
  }
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export async function runConciergeTurn({
  session,
  message,
  formState,
  pageContext,
}: {
  session: ConciergeSession;
  message: string;
  formState?: Record<string, unknown> | null;
  pageContext?: Record<string, unknown> | null;
}): Promise<ConciergeTurnResult> {
  session.messages.push({ role: "customer", content: message });
  if (session.messages.length > MAX_HISTORY_MESSAGES) {
    session.messages.splice(0, session.messages.length - MAX_HISTORY_MESSAGES);
  }

  const input: Array<{ role: "user" | "assistant" | "developer"; content: string }> =
    session.messages.map((entry) => ({
      role: entry.role === "customer" ? "user" : "assistant",
      content: entry.content,
    }));

  if (pageContext && Object.keys(pageContext).length > 0) {
    // Cap defensively; the client already truncates the excerpt.
    input.push({
      role: "developer",
      content: `Customer's current page: ${JSON.stringify(pageContext).slice(0, 3000)}`,
    });
  }

  if (formState && Object.keys(formState).length > 0) {
    input.push({
      role: "developer",
      content: `Current application form state (synthetic demo data): ${JSON.stringify(formState)}`,
    });
  }

  input.push({
    role: "developer",
    content:
      `Available routes for navigateTo (propose at most one, only when it genuinely helps): ` +
      [...ALLOWED_ROUTES].join(" "),
  });

  const response = await getClient().responses.create({
    model: conciergeModel(),
    instructions: CONCIERGE_INSTRUCTIONS,
    input,
    max_output_tokens: 600,
    text: {
      format: {
        type: "json_schema",
        name: "concierge_turn",
        schema: CONCIERGE_OUTPUT_SCHEMA as unknown as Record<string, unknown>,
        strict: true,
      },
    },
  });

  let reply = response.output_text.trim();
  let navigateTo: string | null = null;
  let formFill: Record<string, string> | null = null;
  try {
    const parsed = JSON.parse(response.output_text) as {
      reply?: unknown;
      navigateTo?: unknown;
      formFill?: unknown;
    };
    reply = String(parsed.reply ?? "").trim();
    // Allowlist enforcement: off-manifest proposals are dropped here and
    // never reach the browser.
    navigateTo =
      typeof parsed.navigateTo === "string" && ALLOWED_ROUTES.has(parsed.navigateTo)
        ? parsed.navigateTo
        : null;
    // Fill proposals only make sense on the form page (formState present),
    // and only known fields with string values survive.
    if (formState && parsed.formFill && typeof parsed.formFill === "object") {
      const filtered: Record<string, string> = {};
      for (const field of FORM_FILL_FIELDS) {
        const value = (parsed.formFill as Record<string, unknown>)[field];
        if (typeof value === "string" && value.trim()) filtered[field] = value.trim();
      }
      formFill = Object.keys(filtered).length > 0 ? filtered : null;
    }
  } catch {
    // Fall back to the raw text as the reply; no suggestion, no fill.
  }

  session.messages.push({ role: "assistant", content: reply });
  return { reply, navigateTo, formFill };
}
