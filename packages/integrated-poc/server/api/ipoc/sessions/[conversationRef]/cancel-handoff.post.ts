import type { IpocSessionResponse } from "../../../../domains/ipoc/models/ipoc.model";
import { cancelIpocHandoff } from "../../../../domains/ipoc/services/ipocSession.service";
import { requireIpocSession } from "../../../../utils/ipocRoute";

// Mirrors the demo API's cancel-handoff semantics (D042): the engine's own
// exported state helper clears the pending handoff so the customer can keep
// chatting; no engine behavior is changed.
export default defineEventHandler(
  async (event): Promise<IpocSessionResponse> => {
    const { conversationRef, session } = requireIpocSession(event);
    return cancelIpocHandoff({ conversationRef, session });
  },
);
