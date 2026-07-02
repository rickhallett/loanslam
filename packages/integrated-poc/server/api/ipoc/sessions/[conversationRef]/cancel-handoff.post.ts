import { createError } from "h3";

import { cancelHandoff } from "@loanslam/core/engine";

import type { IpocSessionResponse } from "../../../../../shared/ipoc";
import { appendMessage, getIpocSession } from "../../../../utils/ipocStore";

// Mirrors the demo API's cancel-handoff semantics (D042): the engine's own
// exported state helper clears the pending handoff so the customer can keep
// chatting; no engine behavior is changed.
export default defineEventHandler(
  async (event): Promise<IpocSessionResponse> => {
    const conversationRef = getRouterParam(event, "conversationRef");

    if (!conversationRef) {
      throw createError({
        statusCode: 400,
        statusMessage: "Missing conversation reference.",
      });
    }

    const session = getIpocSession(conversationRef);

    if (!session) {
      throw createError({
        statusCode: 404,
        statusMessage: `Session ${conversationRef} was not found.`,
      });
    }

    session.state = cancelHandoff(session.state);
    appendMessage(session, {
      role: "assistant",
      content:
        "No problem — ask me anything else about your LoanSlam loan.",
    });

    return {
      conversationRef,
      messages: session.messages,
    };
  },
);
