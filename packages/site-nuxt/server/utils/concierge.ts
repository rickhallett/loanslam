import { rewriteDisplayedSiteUrls } from "../../lib/siteUrls";
import type {
  ConciergeMessage,
  ConciergeSession,
} from "../domains/concierge/concierge.model";
import {
  conciergeModel,
  createConciergeReply,
} from "../domains/concierge/services/conciergeOpenAi.client";
import {
  buildConciergePromptInput,
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
export { conciergeModel };
export { conciergeRateLimitExceeded };

export function conciergeEnabled(): boolean {
  return process.env.CONCIERGE_KILL_SWITCH !== "1";
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

  let reply = await createConciergeReply({ input, onDelta });

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
