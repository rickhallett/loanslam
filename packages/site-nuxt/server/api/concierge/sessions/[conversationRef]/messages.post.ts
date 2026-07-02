import { createError, getRequestIP, readBody } from "h3";

import {
  conciergeEnabled,
  conciergeRateLimitExceeded,
  getConciergeSession,
  runConciergeTurn,
} from "../../../../utils/concierge";

interface ConciergeMessageRequest {
  message?: unknown;
  formState?: unknown;
  pageContext?: unknown;
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

  const reply = await runConciergeTurn({
    session,
    message,
    formState: asObject(body.formState),
    pageContext: asObject(body.pageContext),
  });
  return { conversationRef, assistant: { message: reply } };
});
