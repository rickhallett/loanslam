import { createError, readBody } from "h3";

import type {
  IpocAddTicketNoteRequest,
  IpocAdminTicketResponse,
} from "../../../../../domains/ipoc/models/ipoc.model";
import {
  addIpocTicketNote,
  getIpocAdminTicket,
} from "../../../../../domains/ipoc/stores/ipocSession.store";

const maxNoteLength = 500;

export default defineEventHandler(
  async (event): Promise<IpocAdminTicketResponse> => {
    const ticketId = getRouterParam(event, "ticketId");

    if (!ticketId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Missing ticket id.",
      });
    }

    const body = await readBody<IpocAddTicketNoteRequest>(event);
    const note = typeof body?.note === "string" ? body.note.trim() : "";

    if (!note) {
      throw createError({
        statusCode: 400,
        statusMessage: "note is required.",
      });
    }

    if (note.length > maxNoteLength) {
      throw createError({
        statusCode: 400,
        statusMessage: `note must be ${maxNoteLength} characters or fewer.`,
      });
    }

    const updated = addIpocTicketNote(ticketId, note);

    if (!updated) {
      throw createError({
        statusCode: 404,
        statusMessage: `Ticket ${ticketId} was not found.`,
      });
    }

    const ticket = getIpocAdminTicket(ticketId);

    if (!ticket) {
      throw createError({
        statusCode: 404,
        statusMessage: `Ticket ${ticketId} was not found.`,
      });
    }

    return { ticket };
  },
);
