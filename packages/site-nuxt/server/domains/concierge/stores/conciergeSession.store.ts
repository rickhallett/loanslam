import { randomUUID } from "node:crypto";

import type { ConciergeMessage, ConciergeSession } from "../concierge.model";

export const maxConciergeHistoryMessages = 20;

const sessions = new Map<string, ConciergeSession>();

export function createConciergeSession(): ConciergeSession {
  const session: ConciergeSession = {
    conversationRef: randomUUID(),
    createdAt: new Date().toISOString(),
    messages: [],
  };
  sessions.set(session.conversationRef, session);
  return session;
}

export function getConciergeSession(
  ref: string,
): ConciergeSession | undefined {
  return sessions.get(ref);
}

export function seedConciergeTranscript(
  session: ConciergeSession,
  transcript: readonly ConciergeMessage[] | null | undefined,
): void {
  if (session.messages.length > 0 || !transcript || transcript.length === 0) {
    return;
  }

  session.messages.push(...transcript.slice(-maxConciergeHistoryMessages));
}

export function appendConciergeMessage(
  session: ConciergeSession,
  message: ConciergeMessage,
): void {
  session.messages.push(message);
}

export function trimConciergeHistory(session: ConciergeSession): void {
  if (session.messages.length <= maxConciergeHistoryMessages) {
    return;
  }

  session.messages.splice(
    0,
    session.messages.length - maxConciergeHistoryMessages,
  );
}
