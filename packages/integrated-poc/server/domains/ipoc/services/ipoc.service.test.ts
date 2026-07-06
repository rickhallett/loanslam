import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { IpocTicket } from "../models/ipoc.model";
import { isIpocTicketStatus } from "../models/ipoc.model";
import { getIpocSession, saveIpocTicket } from "../stores/ipocSession.store";
import {
  addIpocAdminTicketNote,
  changeIpocAdminTicketStatus,
  listIpocAdminTickets,
  validateIpocAdminNote,
} from "./ipocAdmin.service";
import { cancelIpocHandoff, startIpocSession } from "./ipocSession.service";

describe("IPOC domain services", () => {
  it("starts and cancels sessions through the session service", () => {
    const started = startIpocSession();
    const session = getIpocSession(started.conversationRef);

    expect(session).not.toBeNull();
    expect(started.messages[0]?.role).toBe("assistant");

    if (!session) {
      throw new Error("expected IPOC session to be stored");
    }

    session.state.handoffPending = true;
    session.state.requestedFields = ["fullName", "email"];
    session.state.safetyFlags = ["account_specific_request"];

    const cancelled = cancelIpocHandoff({
      conversationRef: started.conversationRef,
      session,
    });

    expect(cancelled.conversationRef).toBe(started.conversationRef);
    expect(session.state.handoffPending).toBe(false);
    expect(session.state.requestedFields).toEqual([]);
    expect(session.state.safetyFlags).toEqual([]);
    expect(cancelled.messages.at(-1)?.content).toContain("No problem");
  });

  it("validates admin notes and ticket status inputs", () => {
    expect(validateIpocAdminNote("  follow up  ")).toEqual({
      ok: true,
      note: "follow up",
    });
    expect(validateIpocAdminNote("   ")).toEqual({
      ok: false,
      message: "note is required.",
    });
    expect(isIpocTicketStatus("in_review")).toBe(true);
    expect(isIpocTicketStatus("closed")).toBe(false);
  });

  it("routes admin ticket listing, notes, and transitions through services", () => {
    const session = startIpocSession();
    const ticket = saveIpocTicket(makeTicket(session.conversationRef));

    const listed = listIpocAdminTickets().find((item) => item.id === ticket.id);
    expect(listed?.activity).toEqual([]);

    const withNote = addIpocAdminTicketNote({
      ticketId: ticket.id,
      note: "Agent is reviewing the demo handoff.",
    });
    expect(withNote.ok).toBe(true);
    expect(withNote.ok ? withNote.ticket.agentNotes : []).toHaveLength(1);

    const invalid = changeIpocAdminTicketStatus({
      ticketId: ticket.id,
      status: "resolved",
    });
    expect(invalid).toEqual({
      ok: false,
      reason: "invalid_transition",
      from: "open",
    });

    const inReview = changeIpocAdminTicketStatus({
      ticketId: ticket.id,
      status: "in_review",
    });
    expect(inReview.ok ? inReview.ticket.status : null).toBe("in_review");
  });
});

function makeTicket(conversationRef: string): IpocTicket {
  const now = new Date().toISOString();

  return {
    id: `test-${randomUUID()}`,
    conversationRef,
    requestRef: null,
    status: "open",
    queue: "support",
    createdAt: now,
    customerContext: {
      journey: "application-help",
      summary: "Synthetic service test ticket.",
      piiPolicy: "raw_customer_message_omitted",
    },
    engine: {
      finalAction: "request_handoff_intake",
      uiPrimitive: "intake_form",
      servingMode: "handoff_account_specific",
      safetyFlags: [],
      requestedFields: ["fullName"],
      validatorOverrideCodes: [],
    },
    structuredIntake: null,
    assistantPreview: "Synthetic service test ticket.",
    agentNotes: [],
  };
}
