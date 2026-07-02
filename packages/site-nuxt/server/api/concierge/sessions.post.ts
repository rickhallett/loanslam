import { createError, getRequestIP } from "h3";

import {
  conciergeEnabled,
  conciergeRateLimitExceeded,
  createConciergeSession,
} from "../../utils/concierge";

export default defineEventHandler((event) => {
  if (!conciergeEnabled()) {
    throw createError({ statusCode: 503, statusMessage: "Concierge is disabled." });
  }
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? "unknown";
  if (conciergeRateLimitExceeded("sessions", ip)) {
    throw createError({ statusCode: 429, statusMessage: "Too many requests." });
  }
  const session = createConciergeSession();
  return { conversationRef: session.conversationRef };
});
