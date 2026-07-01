import { randomUUID } from "node:crypto";

import type { ConversationState, TurnTrace } from "@loanslam/contracts";

import type {
  IpocChatMessage,
  IpocHandoffIntake,
  IpocLookupFieldValues,
  IpocTicket,
} from "../../shared/ipoc";

export interface IpocSession {
  state: ConversationState;
  traces: TurnTrace[];
  messages: IpocChatMessage[];
  matchedLoanReference: string | null;
}

export interface IpocMockCustomerRecord {
  loanReference: string;
  fullName: string;
  dateOfBirth: string;
  address: string;
  nextPaymentDate: string;
  outstandingBalance: string;
  loanStatus: "active" | "arrears" | "settled";
}

// Synthetic demo records only (D037/D038). Never seed real customer data.
const mockCustomerRecords: IpocMockCustomerRecord[] = [
  {
    loanReference: "LS-10001",
    fullName: "Demo Applicant",
    dateOfBirth: "1990-01-01",
    address: "1 Demo Street, Demotown, AB12 3CD",
    nextPaymentDate: "2026-07-28",
    outstandingBalance: "£1,240.50",
    loanStatus: "active",
  },
  {
    loanReference: "LS-10002",
    fullName: "Sample Customer",
    dateOfBirth: "1985-06-15",
    address: "22 Placeholder Road, Testville, ZZ9 9ZZ",
    nextPaymentDate: "2026-07-15",
    outstandingBalance: "£310.00",
    loanStatus: "arrears",
  },
];

const sessions = new Map<string, IpocSession>();
const tickets = new Map<string, IpocTicket>();

function normalizeLookupValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function findMockCustomer(
  fields: IpocLookupFieldValues,
): IpocMockCustomerRecord | null {
  return (
    mockCustomerRecords.find(
      (record) =>
        normalizeLookupValue(record.fullName) ===
          normalizeLookupValue(fields.fullName) &&
        record.dateOfBirth === fields.dateOfBirth.trim() &&
        normalizeLookupValue(record.address) ===
          normalizeLookupValue(fields.address) &&
        record.loanReference.toLowerCase() ===
          fields.loanReference.trim().toLowerCase(),
    ) ?? null
  );
}

export function getMockCustomerByLoanReference(
  loanReference: string,
): IpocMockCustomerRecord | null {
  return (
    mockCustomerRecords.find(
      (record) => record.loanReference === loanReference,
    ) ?? null
  );
}

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
    matchedLoanReference: null,
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

export function updateIpocTicketIntake({
  ticketId,
  conversationRef,
  fields,
  capturedAt = new Date(),
}: {
  ticketId: string;
  conversationRef: string;
  fields: IpocHandoffIntake;
  capturedAt?: Date;
}): IpocTicket | null {
  const ticket = tickets.get(ticketId);

  if (!ticket || ticket.conversationRef !== conversationRef) {
    return null;
  }

  const updatedTicket: IpocTicket = {
    ...ticket,
    status: "intake_captured",
    structuredIntake: {
      fields,
      capturedAt: capturedAt.toISOString(),
      piiPolicy: "synthetic_demo_fields_only",
    },
  };
  tickets.set(ticketId, updatedTicket);
  return updatedTicket;
}

export function listIpocTickets(): IpocTicket[] {
  return [...tickets.values()].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}
