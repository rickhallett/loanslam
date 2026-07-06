import { cancelHandoff } from "@loanslam/core/engine";

import type { IpocSessionResponse } from "../models/ipoc.model";
import type { IpocSession } from "../stores/ipocSession.store";
import {
  appendMessage,
  createIpocSession,
} from "../stores/ipocSession.store";

export function startIpocSession(): IpocSessionResponse {
  const session = createIpocSession();

  return {
    conversationRef: session.state.conversationRef,
    messages: session.messages,
  };
}

export function cancelIpocHandoff({
  conversationRef,
  session,
}: {
  conversationRef: string;
  session: IpocSession;
}): IpocSessionResponse {
  session.state = cancelHandoff(session.state);
  appendMessage(session, {
    role: "assistant",
    content: "No problem — ask me anything else about your LoanSlam loan.",
  });

  return {
    conversationRef,
    messages: session.messages,
  };
}
