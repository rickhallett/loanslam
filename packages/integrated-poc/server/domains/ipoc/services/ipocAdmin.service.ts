import type { IpocAdminTicket, IpocTicketStatus } from "../models/ipoc.model";
import {
  addIpocTicketNote,
  getIpocAdminTicket,
  updateIpocTicketStatus,
} from "../stores/ipocSession.store";

export const maxIpocAdminNoteLength = 500;

export type IpocNoteValidationResult =
  | { ok: true; note: string }
  | { ok: false; message: string };

export type IpocAdminTicketResult =
  | { ok: true; ticket: IpocAdminTicket }
  | { ok: false; reason: "not_found" };

export type IpocAdminStatusResult =
  | { ok: true; ticket: IpocAdminTicket }
  | { ok: false; reason: "not_found" }
  | {
      ok: false;
      reason: "invalid_transition";
      from: IpocTicketStatus | undefined;
    };

export function validateIpocAdminNote(note: unknown): IpocNoteValidationResult {
  const normalized = typeof note === "string" ? note.trim() : "";

  if (!normalized) {
    return { ok: false, message: "note is required." };
  }

  if (normalized.length > maxIpocAdminNoteLength) {
    return {
      ok: false,
      message: `note must be ${maxIpocAdminNoteLength} characters or fewer.`,
    };
  }

  return { ok: true, note: normalized };
}

export function addIpocAdminTicketNote({
  ticketId,
  note,
}: {
  ticketId: string;
  note: string;
}): IpocAdminTicketResult {
  const updated = addIpocTicketNote(ticketId, note);

  if (!updated) {
    return { ok: false, reason: "not_found" };
  }

  const ticket = getIpocAdminTicket(ticketId);
  return ticket ? { ok: true, ticket } : { ok: false, reason: "not_found" };
}

export function changeIpocAdminTicketStatus({
  ticketId,
  status,
}: {
  ticketId: string;
  status: IpocTicketStatus;
}): IpocAdminStatusResult {
  const result = updateIpocTicketStatus(ticketId, status);

  if (!result.ok) {
    if (result.reason === "not_found") {
      return { ok: false, reason: "not_found" };
    }

    return {
      ok: false,
      reason: "invalid_transition",
      from: result.from,
    };
  }

  const ticket = getIpocAdminTicket(ticketId);
  return ticket ? { ok: true, ticket } : { ok: false, reason: "not_found" };
}
