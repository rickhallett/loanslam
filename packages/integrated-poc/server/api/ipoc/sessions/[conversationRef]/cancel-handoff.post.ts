import { cancelHandoff } from "@loanslam/core/engine";

import type { IpocSessionResponse } from "../../../../../shared/ipoc";
import { appendMessage } from "../../../../utils/ipocStore";
import { requireIpocSession } from "../../../../utils/ipocRoute";

// Mirrors the demo API's cancel-handoff semantics (D042): the engine's own
// exported state helper clears the pending handoff so the customer can keep
// chatting; no engine behavior is changed.
export default defineEventHandler(
  async (event): Promise<IpocSessionResponse> => {
    const { conversationRef, session } = requireIpocSession(event);
    session.state = cancelHandoff(session.state);
    appendMessage(session, {
      role: "assistant",
      content: "No problem — ask me anything else about your LoanSlam loan.",
    });

    return {
      conversationRef,
      messages: session.messages,
    };
  },
);
