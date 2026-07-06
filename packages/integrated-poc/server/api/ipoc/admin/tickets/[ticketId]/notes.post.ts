import { createError, readBody } from "h3";

import type {
  IpocAddTicketNoteRequest,
  IpocAdminTicketResponse,
} from "../../../../../domains/ipoc/models/ipoc.model";
import {
  addIpocAdminTicketNote,
  validateIpocAdminNote,
} from "../../../../../domains/ipoc/services/ipocAdmin.service";

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
    const validation = validateIpocAdminNote(body?.note);

    if (!validation.ok) {
      throw createError({
        statusCode: 400,
        statusMessage: validation.message,
      });
    }

    const result = addIpocAdminTicketNote({
      ticketId,
      note: validation.note,
    });

    if (!result.ok) {
      throw createError({
        statusCode: 404,
        statusMessage: `Ticket ${ticketId} was not found.`,
      });
    }

    return { ticket: result.ticket };
  },
);
