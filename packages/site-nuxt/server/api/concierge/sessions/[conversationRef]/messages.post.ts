import { createError, getRequestIP, getRequestURL, readBody, setResponseHeaders } from "h3";

import {
  conciergeEnabled,
  conciergeRateLimitExceeded,
  getConciergeSession,
  runConciergeTurn,
} from "../../../../utils/concierge";
import { rewriteDisplayedSiteUrls } from "../../../../../lib/siteUrls";

interface ConciergeMessageRequest {
  message?: unknown;
  formState?: unknown;
  pageContext?: unknown;
  resumeTranscript?: unknown;
  stream?: unknown;
}

export default defineEventHandler(async (event) => {
  if (!conciergeEnabled()) {
    throw createError({ statusCode: 503, statusMessage: "Concierge is disabled." });
  }

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? "unknown";
  if (conciergeRateLimitExceeded("messages", ip)) {
    throw createError({ statusCode: 429, statusMessage: "Too many requests." });
  }

  const conversationRef = getRouterParam(event, "conversationRef");
  if (!conversationRef) {
    throw createError({ statusCode: 400, statusMessage: "Missing conversation reference." });
  }

  const session = getConciergeSession(conversationRef);
  if (!session) {
    throw createError({
      statusCode: 404,
      statusMessage: `Session ${conversationRef} was not found.`,
    });
  }

  const body = await readBody<ConciergeMessageRequest>(event);
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    throw createError({ statusCode: 400, statusMessage: "Message is required." });
  }

  const asObject = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;

  const resumeTranscript = Array.isArray(body.resumeTranscript)
    ? body.resumeTranscript
        .filter(
          (entry): entry is { role: "customer" | "assistant"; content: string } =>
            !!entry &&
            typeof entry === "object" &&
            (entry.role === "customer" || entry.role === "assistant") &&
            typeof entry.content === "string",
        )
        .map((entry) => ({ role: entry.role, content: entry.content }))
    : null;

  const publicOrigin = getRequestURL(event, {
    xForwardedHost: true,
    xForwardedProto: true,
  }).origin;

  const turn = {
    session,
    message,
    formState: asObject(body.formState),
    pageContext: asObject(body.pageContext),
    publicOrigin,
    resumeTranscript,
  };

  // dr-002 (D047): opt-in SSE streaming for the plain-text reply path. All
  // request validation (kill switch, rate limit, 404, 400) happens above,
  // before any bytes stream — the dr-001 resurrection path still sees a
  // plain 404 status. Non-streaming JSON remains the default for scripts
  // and API consumers.
  if (body.stream === true) {
    setResponseHeaders(event, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    });
    const encoder = new TextEncoder();
    const frame = (payload: Record<string, unknown>) =>
      encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
    return new ReadableStream({
      async start(controller) {
        try {
          let rawReply = "";
          const reply = await runConciergeTurn({
            ...turn,
            onDelta: (delta) => {
              rawReply += delta;
              controller.enqueue(
                frame({ text: rewriteDisplayedSiteUrls(rawReply, publicOrigin) }),
              );
            },
          });
          controller.enqueue(frame({ done: true, conversationRef, message: reply }));
        } catch {
          controller.enqueue(
            frame({ error: "The assistant hit a problem mid-reply. Please try again." }),
          );
        }
        controller.close();
      },
    });
  }

  const reply = await runConciergeTurn(turn);
  return { conversationRef, assistant: { message: reply } };
});
