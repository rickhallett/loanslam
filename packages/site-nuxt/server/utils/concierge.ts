import { randomUUID } from "node:crypto";

import OpenAI from "openai";

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
const CONCIERGE_INSTRUCTIONS = `You are the LoanSlam assistant, guiding a customer through the loan
application form on this page. LoanSlam is a UK lender offering unsecured
instalment loans. This is a prototype site and every detail the customer
enters is synthetic test data.

Voice: match the LoanSlam support chat the customer has already used —
warm, plain UK English, concise. Two or three short sentences per reply
unless the question genuinely needs more. No emojis.

When the customer's current form state is provided, use it: answer about
the exact step and fields in front of them, acknowledge what they have
already completed, and point to what comes next. Encourage steady progress
without pressure.

Never promise or predict an application outcome, approval, eligibility
decision, rate, or timescale, and never present yourself as making lending
decisions. If the customer is struggling or asks for a person, tell them
you can connect them with the support team.`;

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
}: {
  session: ConciergeSession;
  message: string;
  formState?: Record<string, unknown> | null;
}): Promise<string> {
  session.messages.push({ role: "customer", content: message });
  if (session.messages.length > MAX_HISTORY_MESSAGES) {
    session.messages.splice(0, session.messages.length - MAX_HISTORY_MESSAGES);
  }

  const input: Array<{ role: "user" | "assistant" | "developer"; content: string }> =
    session.messages.map((entry) => ({
      role: entry.role === "customer" ? "user" : "assistant",
      content: entry.content,
    }));

  if (formState && Object.keys(formState).length > 0) {
    input.push({
      role: "developer",
      content: `Current application form state (synthetic demo data): ${JSON.stringify(formState)}`,
    });
  }

  const response = await getClient().responses.create({
    model: conciergeModel(),
    instructions: CONCIERGE_INSTRUCTIONS,
    input,
    max_output_tokens: 400,
  });

  const reply = response.output_text.trim();
  session.messages.push({ role: "assistant", content: reply });
  return reply;
}
