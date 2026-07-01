import { createIpocSession } from "../../utils/ipocStore";

export default defineEventHandler(() => {
  const session = createIpocSession();

  return {
    conversationRef: session.state.conversationRef,
    messages: session.messages,
  };
});
