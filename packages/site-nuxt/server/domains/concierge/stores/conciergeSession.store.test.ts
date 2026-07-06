import { describe, expect, it } from "vitest";

import type { ConciergeMessage } from "../concierge.model";
import {
  appendConciergeMessage,
  createConciergeSession,
  getConciergeSession,
  maxConciergeHistoryMessages,
  seedConciergeTranscript,
  trimConciergeHistory,
} from "./conciergeSession.store";

describe("concierge session store", () => {
  it("stores sessions by conversation reference", () => {
    const session = createConciergeSession();

    expect(getConciergeSession(session.conversationRef)).toBe(session);
  });

  it("seeds only empty sessions from the bounded transcript tail", () => {
    const session = createConciergeSession();
    const transcript = Array.from(
      { length: maxConciergeHistoryMessages + 3 },
      (_, index): ConciergeMessage => ({
        role: index % 2 === 0 ? "customer" : "assistant",
        content: `message ${index}`,
      }),
    );

    seedConciergeTranscript(session, transcript);

    expect(session.messages).toHaveLength(maxConciergeHistoryMessages);
    expect(session.messages[0]?.content).toBe("message 3");

    seedConciergeTranscript(session, [
      { role: "assistant", content: "should not replace history" },
    ]);
    expect(session.messages[0]?.content).toBe("message 3");
  });

  it("bounds history when trimmed", () => {
    const session = createConciergeSession();

    for (let index = 0; index < maxConciergeHistoryMessages + 2; index += 1) {
      appendConciergeMessage(session, {
        role: "customer",
        content: `turn ${index}`,
      });
    }

    expect(session.messages).toHaveLength(maxConciergeHistoryMessages + 2);
    trimConciergeHistory(session);
    expect(session.messages).toHaveLength(maxConciergeHistoryMessages);
    expect(session.messages[0]?.content).toBe("turn 2");
  });
});
