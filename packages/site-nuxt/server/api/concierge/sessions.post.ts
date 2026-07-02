import { createError } from "h3";

import { conciergeEnabled, createConciergeSession } from "../../utils/concierge";

export default defineEventHandler(() => {
  if (!conciergeEnabled()) {
    throw createError({ statusCode: 503, statusMessage: "Concierge is disabled." });
  }
  const session = createConciergeSession();
  return { conversationRef: session.conversationRef };
});
