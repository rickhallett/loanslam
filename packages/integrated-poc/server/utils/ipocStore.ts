import { randomUUID } from "node:crypto";

import type { ConversationState, TurnTrace } from "@loanslam/contracts";

import type { IpocChatMessage, IpocTicket } from "../../shared/ipoc";

export interface IpocSession {
  state: ConversationState;
  traces: TurnTrace[];
  messages: IpocChatMessage[];
}

const sessions = new Map<string, IpocSession>();
const tickets = new Map<string, IpocTicket>();

export function createIpocSession(now = new Date()): IpocSession {
  const conversationRef = randomUUID();
  const createdAt = now.toISOString();
  const session: IpocSession = {
    state: {
      conversationRef,
      history: [],
      collectedFacts: {},
      requestedFields: [],
      safetyFlags: [],
      handoffPending: false,
    },
    traces: [],
    messages: [
      {
        id: randomUUID(),
        role: "assistant",
        content:
          "Hi, I can help with questions about applying or connect you with support.",
        createdAt,
      },
    ],
  };
  sessions.set(conversationRef, session);
  return session;
}

export function getIpocSession(conversationRef: string): IpocSession | null {
  return sessions.get(conversationRef) ?? null;
}

export function appendMessage(
  session: IpocSession,
  message: Omit<IpocChatMessage, "id" | "createdAt">,
  now = new Date(),
): IpocChatMessage {
  const item = {
    ...message,
    id: randomUUID(),
    createdAt: now.toISOString(),
  };
  session.messages.push(item);
  return item;
}

export function saveIpocTicket(ticket: IpocTicket): IpocTicket {
  tickets.set(ticket.id, ticket);
  return ticket;
}

export function listIpocTickets(): IpocTicket[] {
  return [...tickets.values()].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}
