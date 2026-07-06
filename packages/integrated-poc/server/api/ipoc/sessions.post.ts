import { createIpocSession } from "../../domains/ipoc/stores/ipocSession.store";

export default defineEventHandler(() => {
  const session = createIpocSession();

  return {
    conversationRef: session.state.conversationRef,
    messages: session.messages,
  };
});
