import { randomUUID } from "node:crypto";

import type { ConversationState, TurnTrace } from "@loanslam/contracts";

import type {
  IpocActivityEvent,
  IpocActivityKind,
  IpocAdminTicket,
  IpocChatMessage,
  IpocHandoffIntake,
  IpocLookupFieldValues,
  IpocTicket,
  IpocTicketStatus,
} from "../models/ipoc.model";

export interface IpocSession {
  state: ConversationState;
  traces: TurnTrace[];
  messages: IpocChatMessage[];
  matchedLoanReference: string | null;
  activity: IpocActivityEvent[];
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

export type TicketStatusUpdateResult =
  | { ok: true; ticket: IpocTicket }
  | {
      ok: false;
      reason: "not_found" | "invalid_transition";
      from?: IpocTicketStatus;
    };

export interface IpocSessionStore {
  findMockCustomer(fields: IpocLookupFieldValues): IpocMockCustomerRecord | null;
  getMockCustomerByLoanReference(
    loanReference: string,
  ): IpocMockCustomerRecord | null;
  createSession(now?: Date): IpocSession;
  getSession(conversationRef: string): IpocSession | null;
  appendMessage(
    session: IpocSession,
    message: Omit<IpocChatMessage, "id" | "createdAt">,
    now?: Date,
  ): IpocChatMessage;
  saveTicket(ticket: IpocTicket): IpocTicket;
  updateTicketIntake(args: {
    ticketId: string;
    conversationRef: string;
    fields: IpocHandoffIntake;
    capturedAt?: Date;
  }): IpocTicket | null;
  recordSessionActivity(
    session: IpocSession,
    kind: IpocActivityKind,
    detail: string,
    now?: Date,
  ): IpocActivityEvent;
  updateTicketStatus(
    ticketId: string,
    status: IpocTicketStatus,
  ): TicketStatusUpdateResult;
  addTicketNote(ticketId: string, note: string, now?: Date): IpocTicket | null;
  getAdminTicket(ticketId: string): IpocAdminTicket | null;
  listTickets(): IpocAdminTicket[];
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

const allowedStatusTransitions: Record<IpocTicketStatus, IpocTicketStatus[]> = {
  open: ["in_review"],
  intake_captured: ["in_review"],
  in_review: ["resolved"],
  resolved: [],
};

function normalizeLookupValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

class InMemoryIpocSessionStore implements IpocSessionStore {
  private readonly sessions = new Map<string, IpocSession>();
  private readonly tickets = new Map<string, IpocTicket>();

  findMockCustomer(
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

  getMockCustomerByLoanReference(
    loanReference: string,
  ): IpocMockCustomerRecord | null {
    return (
      mockCustomerRecords.find(
        (record) => record.loanReference === loanReference,
      ) ?? null
    );
  }

  createSession(now = new Date()): IpocSession {
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
      activity: [],
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
    this.sessions.set(conversationRef, session);
    return session;
  }

  getSession(conversationRef: string): IpocSession | null {
    return this.sessions.get(conversationRef) ?? null;
  }

  appendMessage(
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

  saveTicket(ticket: IpocTicket): IpocTicket {
    this.tickets.set(ticket.id, ticket);
    return ticket;
  }

  updateTicketIntake({
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
    const ticket = this.tickets.get(ticketId);

    if (!ticket || ticket.conversationRef !== conversationRef) {
      return null;
    }

    const updatedTicket: IpocTicket = {
      ...ticket,
      // Only advance open tickets; never regress an in_review/resolved ticket.
      status: ticket.status === "open" ? "intake_captured" : ticket.status,
      structuredIntake: {
        fields,
        capturedAt: capturedAt.toISOString(),
        piiPolicy: "synthetic_demo_fields_only",
      },
    };
    this.tickets.set(ticketId, updatedTicket);
    return updatedTicket;
  }

  recordSessionActivity(
    session: IpocSession,
    kind: IpocActivityKind,
    detail: string,
    now = new Date(),
  ): IpocActivityEvent {
    const event: IpocActivityEvent = {
      id: randomUUID(),
      kind,
      detail,
      createdAt: now.toISOString(),
    };
    session.activity.push(event);
    return event;
  }

  updateTicketStatus(
    ticketId: string,
    status: IpocTicketStatus,
  ): TicketStatusUpdateResult {
    const ticket = this.tickets.get(ticketId);

    if (!ticket) {
      return { ok: false, reason: "not_found" };
    }

    if (!allowedStatusTransitions[ticket.status].includes(status)) {
      return { ok: false, reason: "invalid_transition", from: ticket.status };
    }

    const updated: IpocTicket = { ...ticket, status };
    this.tickets.set(ticketId, updated);
    return { ok: true, ticket: updated };
  }

  addTicketNote(
    ticketId: string,
    note: string,
    now = new Date(),
  ): IpocTicket | null {
    const ticket = this.tickets.get(ticketId);

    if (!ticket) {
      return null;
    }

    const updated: IpocTicket = {
      ...ticket,
      agentNotes: [
        ...ticket.agentNotes,
        { id: randomUUID(), note, createdAt: now.toISOString() },
      ],
    };
    this.tickets.set(ticketId, updated);
    return updated;
  }

  getAdminTicket(ticketId: string): IpocAdminTicket | null {
    const ticket = this.tickets.get(ticketId);
    return ticket ? this.withActivity(ticket) : null;
  }

  listTickets(): IpocAdminTicket[] {
    return [...this.tickets.values()]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((ticket) => this.withActivity(ticket));
  }

  private withActivity(ticket: IpocTicket): IpocAdminTicket {
    return {
      ...ticket,
      activity: this.sessions.get(ticket.conversationRef)?.activity ?? [],
    };
  }
}

export const ipocSessionStore: IpocSessionStore =
  new InMemoryIpocSessionStore();

export function findMockCustomer(
  fields: IpocLookupFieldValues,
): IpocMockCustomerRecord | null {
  return ipocSessionStore.findMockCustomer(fields);
}

export function getMockCustomerByLoanReference(
  loanReference: string,
): IpocMockCustomerRecord | null {
  return ipocSessionStore.getMockCustomerByLoanReference(loanReference);
}

export function createIpocSession(now = new Date()): IpocSession {
  return ipocSessionStore.createSession(now);
}

export function getIpocSession(conversationRef: string): IpocSession | null {
  return ipocSessionStore.getSession(conversationRef);
}

export function appendMessage(
  session: IpocSession,
  message: Omit<IpocChatMessage, "id" | "createdAt">,
  now = new Date(),
): IpocChatMessage {
  return ipocSessionStore.appendMessage(session, message, now);
}

export function saveIpocTicket(ticket: IpocTicket): IpocTicket {
  return ipocSessionStore.saveTicket(ticket);
}

export function updateIpocTicketIntake(args: {
  ticketId: string;
  conversationRef: string;
  fields: IpocHandoffIntake;
  capturedAt?: Date;
}): IpocTicket | null {
  return ipocSessionStore.updateTicketIntake(args);
}

export function recordSessionActivity(
  session: IpocSession,
  kind: IpocActivityKind,
  detail: string,
  now = new Date(),
): IpocActivityEvent {
  return ipocSessionStore.recordSessionActivity(session, kind, detail, now);
}

export function updateIpocTicketStatus(
  ticketId: string,
  status: IpocTicketStatus,
): TicketStatusUpdateResult {
  return ipocSessionStore.updateTicketStatus(ticketId, status);
}

export function addIpocTicketNote(
  ticketId: string,
  note: string,
  now = new Date(),
): IpocTicket | null {
  return ipocSessionStore.addTicketNote(ticketId, note, now);
}

export function getIpocAdminTicket(ticketId: string): IpocAdminTicket | null {
  return ipocSessionStore.getAdminTicket(ticketId);
}

export function listIpocTickets(): IpocAdminTicket[] {
  return ipocSessionStore.listTickets();
}
