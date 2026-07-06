import OpenAI from "openai";

import { rewriteDisplayedSiteUrls } from "../../lib/siteUrls";
import type {
  ConciergeMessage,
  ConciergeSession,
} from "../domains/concierge/concierge.model";
import {
  buildConciergePromptInput,
  conciergeInstructions,
} from "../domains/concierge/services/conciergePrompt.service";
import { conciergeRateLimitExceeded } from "../domains/concierge/services/conciergeRateLimit.service";
import {
  appendConciergeMessage,
  createConciergeSession,
  getConciergeSession,
  seedConciergeTranscript,
  trimConciergeHistory,
} from "../domains/concierge/stores/conciergeSession.store";

// Demo-concierge surface (D045): a segregated, demo-only route serving
// apply-journey assistance straight from a frontier OpenAI model. No
// validator, no grounding rule — guardrails are system-prompt-only by
// accepted decision. This module never touches the validated processTurn
// path; the support chat and its engine are a different surface entirely.
// Kill switch: CONCIERGE_KILL_SWITCH=1 disables the routes and the UI
// affordances (via /api/concierge/status).

export type { ConciergeMessage, ConciergeSession };
export { createConciergeSession, getConciergeSession };
export { conciergeRateLimitExceeded };

export function conciergeEnabled(): boolean {
  return process.env.CONCIERGE_KILL_SWITCH !== "1";
}

export function conciergeModel(): string {
  return process.env.CONCIERGE_MODEL ?? "gpt-5.5";
}

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
  seedConciergeTranscript(session, resumeTranscript);
  appendConciergeMessage(session, { role: "customer", content: message });
  trimConciergeHistory(session);

  const { input, displayOrigin } = buildConciergePromptInput({
    messages: session.messages,
    formState,
    pageContext,
    publicOrigin,
  });

  // Reasoning effort stays low and the output budget generous: on a
  // reasoning model a small max_output_tokens can be consumed entirely by
  // deliberation (observed on "use javascript" pressure turns), which
  // surfaced as empty or mid-sentence replies in the panel.
  let reply: string;
  if (onDelta) {
    const stream = await getClient().responses.create({
      model: conciergeModel(),
      instructions: conciergeInstructions,
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
      instructions: conciergeInstructions,
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

  appendConciergeMessage(session, { role: "assistant", content: reply });
  return reply;
}
