import { randomUUID } from "node:crypto";

import OpenAI from "openai";

import { siteMapLines } from "../../lib/siteMap";
import { normalizePublicOrigin, rewriteDisplayedSiteUrls } from "../../lib/siteUrls";

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
// body validation so hammering costs no model calls. Defaults are sized for
// a stakeholder reveal where up to four demos may share one venue IP
// (4x the original single-user budget); tune per deploy via the env vars
// without repacking.
const RATE_WINDOW_MS = 5 * 60_000;

function rateLimitFromEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const RATE_LIMITS = {
  sessions: rateLimitFromEnv("CONCIERGE_RATE_SESSIONS", 40),
  messages: rateLimitFromEnv("CONCIERGE_RATE_MESSAGES", 120),
};
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

The chat panel renders plain text only — it does not format markdown. Never
use asterisks, headings, code blocks, or markdown list syntax. If you need a
list, write short plain lines each starting with a dash.

This is the complete site map. When the customer asks whether a page
exists or where to find something, answer from this list and name the
matching page. Never say a page on this list does not exist, and never
say a topic is only covered on the current page when a dedicated page is
listed here:
${siteMapLines()}
These are relative paths on this prototype site. Never write out full
web addresses or invent a domain name — refer to pages by name and let
the customer use the button the panel shows.
If the customer explicitly asks for a web address, use only the current
site origin provided by the server and a relative path from the site map.
Never use source, scraped, legacy, or Loans by MAL hostnames.

When the customer's current page is provided, ground your help in it:
explain what the page covers, answer questions about its content, and point
to what is in front of them. The page context includes the site header
navigation (nav) and the links and buttons in the page body — when you
tell the customer what to click, use those exact labels and no others,
and remember the nav is on every page. On the application form, use the provided form
state — answer about the exact step and fields, acknowledge what they have
already completed, and point to what comes next. The form state's journey
section remembers every step completed so far, including the loan offer
figures, so questions like "what was my offer?" are answerable from any
step — use it instead of saying you cannot see earlier steps. Encourage
steady progress without pressure.

When you name the application form, the homepage, the FAQs, the contact
page, the Open Banking page, or the instalment loans page, the chat panel
shows the customer a one-tap button that takes them there. So never say
you cannot navigate or can only guide: name the right page and invite
them to use the button. If the customer wants a new loan or wants to
apply, point them to the application form.

Never promise or predict an application outcome, approval, eligibility
decision, rate, or timescale, and never present yourself as making lending
decisions. Anything account-specific (balances, payments, their existing
loan) belongs with the support team, not you. If the customer is
struggling or asks for a person, tell them you can connect them with the
support team.`;

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
  resumeTranscript,
  publicOrigin,
  onDelta,
}: {
  session: ConciergeSession;
  message: string;
  formState?: Record<string, unknown> | null;
  pageContext?: Record<string, unknown> | null;
  resumeTranscript?: Array<{ role: "customer" | "assistant"; content: string }> | null;
  publicOrigin?: string | null;
  // dr-002 (D047): when provided, the reply streams and each text delta is
  // forwarded as it arrives; the returned string is still the full reply.
  onDelta?: (delta: string) => void;
}): Promise<string> {
  // dr-001 (D047): session resurrection. If a lost server session was
  // reseeded on the client, seed this fresh session's history from the
  // replayed transcript (text-only) before the new turn.
  if (session.messages.length === 0 && resumeTranscript && resumeTranscript.length > 0) {
    session.messages.push(...resumeTranscript.slice(-MAX_HISTORY_MESSAGES));
  }

  session.messages.push({ role: "customer", content: message });
  if (session.messages.length > MAX_HISTORY_MESSAGES) {
    session.messages.splice(0, session.messages.length - MAX_HISTORY_MESSAGES);
  }

  const input: Array<{ role: "user" | "assistant" | "developer"; content: string }> =
    session.messages.map((entry) => ({
      role: entry.role === "customer" ? "user" : "assistant",
      content: entry.content,
    }));

  const displayOrigin = publicOrigin ? normalizePublicOrigin(publicOrigin) : null;
  if (displayOrigin) {
    input.push({
      role: "developer",
      content: `Current public site origin: ${displayOrigin}. If the customer explicitly asks for a URL, combine this exact origin only with paths from the site map.`,
    });
  }

  if (pageContext && Object.keys(pageContext).length > 0) {
    // Cap defensively; the client already truncates the excerpt.
    input.push({
      role: "developer",
      content: `Customer's current page: ${JSON.stringify(pageContext).slice(0, 4500)}`,
    });
  }

  if (formState && Object.keys(formState).length > 0) {
    input.push({
      role: "developer",
      content: `Current application form state (synthetic demo data): ${JSON.stringify(formState)}`,
    });
  }

  // Reasoning effort stays low and the output budget generous: on a
  // reasoning model a small max_output_tokens can be consumed entirely by
  // deliberation (observed on "use javascript" pressure turns), which
  // surfaced as empty or mid-sentence replies in the panel.
  let reply: string;
  if (onDelta) {
    const stream = await getClient().responses.create({
      model: conciergeModel(),
      instructions: CONCIERGE_INSTRUCTIONS,
      input,
      reasoning: { effort: "low" },
      max_output_tokens: 1200,
      stream: true,
    });
    let full = "";
    for await (const chunk of stream) {
      if (chunk.type === "response.output_text.delta") {
        full += chunk.delta;
        onDelta(chunk.delta);
      }
    }
    reply = full.trim();
  } else {
    const response = await getClient().responses.create({
      model: conciergeModel(),
      instructions: CONCIERGE_INSTRUCTIONS,
      input,
      reasoning: { effort: "low" },
      max_output_tokens: 1200,
    });
    reply = response.output_text.trim();
  }

  if (reply === "") {
    // Do not record a silent turn; the route handler converts this into the
    // stream error frame (or a 500 on the JSON path) so the panel shows a
    // retryable error instead of nothing.
    throw new Error("The concierge model returned an empty reply.");
  }

  if (displayOrigin) {
    reply = rewriteDisplayedSiteUrls(reply, displayOrigin);
  }

  session.messages.push({ role: "assistant", content: reply });
  return reply;
}
