import {
  ipocHandoffFields,
  type IpocHandoffIntake,
  type IpocSubmitIntakeRequest,
} from "../models/ipoc.model";
import type { IpocSession } from "../stores/ipocSession.store";
import {
  appendMessage,
  updateIpocTicketIntake,
} from "../stores/ipocSession.store";

export type IpocIntakeValidationResult =
  | { ok: true; fields: IpocHandoffIntake }
  | { ok: false; message: string };

export function validateIpocIntakeFields(
  fields: IpocSubmitIntakeRequest["fields"] | undefined,
): IpocIntakeValidationResult {
  if (!fields || typeof fields !== "object") {
    return { ok: false, message: "Handoff fields are required." };
  }

  const normalized = {} as IpocHandoffIntake;

  for (const field of ipocHandoffFields) {
    const value = fields[field]?.trim() ?? "";

    if (!value) {
      return { ok: false, message: `${field} is required.` };
    }

    normalized[field] = value;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized.dateOfBirth)) {
    return {
      ok: false,
      message: "dateOfBirth must use YYYY-MM-DD for the demo form.",
    };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) {
    return { ok: false, message: "email must be a valid demo email address." };
  }

  const phoneDigits = normalized.phone.replace(/\D/g, "");

  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    return { ok: false, message: "phone must contain 10 to 15 digits." };
  }

  return { ok: true, fields: normalized };
}

export function captureIpocIntake({
  session,
  conversationRef,
  ticketId,
  fields,
}: {
  session: IpocSession;
  conversationRef: string;
  ticketId: string;
  fields: IpocHandoffIntake;
}) {
  const ticket = updateIpocTicketIntake({
    ticketId,
    conversationRef,
    fields,
  });

  if (!ticket) {
    return null;
  }

  appendMessage(session, {
    role: "assistant",
    content: `Demo handoff fields captured for ticket ${ticket.id}. A human agent can now read them back.`,
  });

  return ticket;
}
